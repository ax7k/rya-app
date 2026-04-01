import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  LayoutChangeEvent,
  Linking,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../../../lib/supabase';
import { AlertTriangle, Flag, Loader2, SendHorizontal, WifiOff } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Markdown from 'react-native-markdown-display';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNetInfo } from '@react-native-community/netinfo';
import {
  flattenMessagesNewestFirst,
  useReportMessage,
  useRoomMessages,
} from '../../../../../lib/chat-queries';
import { streamRoomChat } from '../../../../../lib/chat';
import { LegendList } from '@legendapp/list';
import type { LegendListRef } from '@legendapp/list';
import { useTranslation } from 'react-i18next';

const USER_MARKDOWN_STYLE = {
  body: {
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 22,
  },
  text: {
    color: '#ffffff',
  },
  paragraph: {
    marginBottom: 6,
    marginTop: 0,
  },
  link: {
    color: '#bfdbfe',
  },
  code_inline: {
    backgroundColor: '#d1d5db',
    color: '#374151',
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  code_block: {
    backgroundColor: '#d1d5db',
    color: '#374151',
    borderRadius: 10,
    padding: 10,
  },
  fence: {
    backgroundColor: '#d1d5db',
    color: '#374151',
    borderRadius: 10,
    padding: 10,
  },
  mark: {
    backgroundColor: '#d1d5db',
    color: '#374151',
  },
};

const ASSISTANT_MARKDOWN_STYLE = {
  body: {
    color: '#f3f4f6',
    fontSize: 15,
    lineHeight: 22,
  },
  text: {
    color: '#f3f4f6',
  },
  paragraph: {
    marginBottom: 6,
    marginTop: 0,
  },
  link: {
    color: '#93c5fd',
  },
  code_inline: {
    backgroundColor: '#d1d5db',
    color: '#374151',
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  code_block: {
    backgroundColor: '#d1d5db',
    color: '#374151',
    borderRadius: 10,
    padding: 10,
  },
  fence: {
    backgroundColor: '#d1d5db',
    color: '#374151',
    borderRadius: 10,
    padding: 10,
  },
  mark: {
    backgroundColor: '#d1d5db',
    color: '#374151',
  },
};

function isNonFatalStreamingWarning(message: string): boolean {
  return message.toLowerCase().includes('getreader');
}

export default function ChatRoomScreen() {
  const { t } = useTranslation();
  const { room_id } = useLocalSearchParams<{ room_id: string }>();
  const queryClient = useQueryClient();
  const [composerText, setComposerText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [optimisticUserMessage, setOptimisticUserMessage] = useState<any | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);
  const [showReconnectedBanner, setShowReconnectedBanner] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const reconnectBannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasOfflineRef = useRef(false);
  const netInfo = useNetInfo();
  const isOffline = netInfo.isConnected === false;
  const listRef = useRef<LegendListRef | null>(null);
  const listViewportHeightRef = useRef(0);
  const messageLayoutsRef = useRef<Record<string, { y: number; height: number }>>({});
  const lastAutoScrollStateRef = useRef<{ id: string | null; contentLength: number }>({
    id: null,
    contentLength: 0,
  });

  // Auto-refresh the room status directly from Supabase
  const { data: room, isLoading } = useQuery({
    queryKey: ['room', room_id],
    enabled: !!room_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', room_id)
        .single();
      
      if (error) throw error;
      return data;
    },
    refetchInterval: (query) => {
      const roomData = query.state.data as any;
      return (roomData?.status === 'uploading' || roomData?.status === 'processing') ? 2000 : false;
    }
  });

  const messagesQuery = useRoomMessages(room_id!);
  const reportMessage = useReportMessage(room_id!);

  const serverMessages = useMemo(
    () => flattenMessagesNewestFirst(messagesQuery.data?.pages).slice().reverse(),
    [messagesQuery.data?.pages]
  );

  const displayMessages = useMemo(() => {
    const trailingMessages: any[] = [];

    if (optimisticUserMessage) {
      trailingMessages.push(optimisticUserMessage);
    }

    if (streamingText) {
      trailingMessages.push({
        id: 'streaming-assistant',
        role: 'assistant',
        content: streamingText,
        created_at: new Date().toISOString(),
        isStreaming: true,
      });
    }

    return [...serverMessages, ...trailingMessages];
  }, [optimisticUserMessage, serverMessages, streamingText]);

  const scrollToEnd = useCallback((animated: boolean) => {
    listRef.current?.scrollToEnd({ animated });
  }, []);

  const scrollAssistantMessageToTop = useCallback((messageId: string, animated: boolean) => {
    const layout = messageLayoutsRef.current[messageId];
    const viewportHeight = listViewportHeightRef.current;

    if (!layout || viewportHeight <= 0) {
      scrollToEnd(animated);
      return;
    }

    const shouldAnchorToTop = layout.height >= viewportHeight * 0.92;
    if (shouldAnchorToTop) {
      listRef.current?.scrollToOffset({ offset: Math.max(layout.y - 8, 0), animated });
      return;
    }

    scrollToEnd(animated);
  }, [scrollToEnd]);

  const refreshMessages = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['roomMessages', room_id] });
  }, [queryClient, room_id]);

  useEffect(() => {
    if (!displayMessages.length) {
      return;
    }

    const lastMessage = displayMessages[displayMessages.length - 1] as any;
    const currentId = String(lastMessage?.id || '');
    const currentLength = String(lastMessage?.content || '').length;
    const previousState = lastAutoScrollStateRef.current;
    const isStreamingMessage = lastMessage?.id === 'streaming-assistant' || Boolean(lastMessage?.isStreaming);

    const didLastMessageChange = currentId !== previousState.id;
    const didStreamingGrow = isStreamingMessage
      && currentId === previousState.id
      && currentLength !== previousState.contentLength;

    lastAutoScrollStateRef.current = {
      id: currentId,
      contentLength: currentLength,
    };

    if (!didLastMessageChange && !didStreamingGrow) {
      return;
    }

    const timer = setTimeout(() => {
      if (lastMessage?.role === 'assistant' && (didLastMessageChange || didStreamingGrow)) {
        scrollAssistantMessageToTop(currentId, true);
        return;
      }

      scrollToEnd(true);
    }, 40);

    return () => clearTimeout(timer);
  }, [displayMessages, scrollAssistantMessageToTop, scrollToEnd]);

  const sendMessage = useCallback(
    async (rawMessage: string) => {
      const trimmed = rawMessage.trim();
      if (!trimmed || isStreaming || room?.status !== 'ready' || isOffline) {
        return;
      }

      setStreamError(null);
      setStreamingText('');
      setLastFailedMessage(trimmed);

      const optimistic = {
        id: `temp-user-${Date.now()}`,
        role: 'user',
        content: trimmed,
        created_at: new Date().toISOString(),
        isOptimistic: true,
      };
      setOptimisticUserMessage(optimistic);
      setComposerText('');
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      let doneReceived = false;
      let sawTerminalError = false;
      try {
        await streamRoomChat(
          room_id!,
          trimmed,
          {
            onToken: (token) => {
              setStreamingText((prev) => prev + token);
            },
            onDone: () => {
              doneReceived = true;
            },
            onSafety: (message) => {
              sawTerminalError = true;
              setStreamError(message);
            },
            onError: (payload) => {
              const message = payload.message || 'Chat stream failed. Please retry.';
              if (isNonFatalStreamingWarning(message)) {
                return;
              }
              sawTerminalError = true;
              setStreamError(message);
            },
          },
          controller.signal
        );

        if (doneReceived && !sawTerminalError) {
          setLastFailedMessage(null);
        }

        if (!doneReceived && !sawTerminalError) {
          setStreamError('The stream ended unexpectedly. Please retry.');
        }
      } catch (error: any) {
        if (controller.signal.aborted) {
          return;
        }
        const message = error?.message || 'Chat stream failed. Please retry.';
        if (isNonFatalStreamingWarning(message)) {
          return;
        }
        setStreamError(message);
      } finally {
        setIsStreaming(false);
        setStreamingText('');
        setOptimisticUserMessage(null);
        abortRef.current = null;
        refreshMessages();
      }
    },
    [isStreaming, refreshMessages, room?.status, room_id, isOffline]
  );

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (reconnectBannerTimeoutRef.current) {
        clearTimeout(reconnectBannerTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!room_id) {
      return;
    }

    if (isOffline) {
      setShowReconnectedBanner(false);
      wasOfflineRef.current = true;

      if (isStreaming) {
        abortRef.current?.abort();
        setStreamError(t('chat.errorConnectionLost'));
      }
      return;
    }

    if (!wasOfflineRef.current) {
      return;
    }

    wasOfflineRef.current = false;
    setShowReconnectedBanner(true);

    if (reconnectBannerTimeoutRef.current) {
      clearTimeout(reconnectBannerTimeoutRef.current);
    }
    reconnectBannerTimeoutRef.current = setTimeout(() => {
      setShowReconnectedBanner(false);
    }, 2400);

    refreshMessages();
    queryClient.invalidateQueries({ queryKey: ['room', room_id] });
  }, [isOffline, isStreaming, queryClient, refreshMessages, room_id]);

  const handleLinkPress = useCallback((url: string) => {
    if (!url) {
      return false;
    }
    void Linking.openURL(url);
    return false;
  }, []);

  const handleRetry = () => {
    if (!lastFailedMessage) {
      return;
    }
    if (isOffline) {
      Alert.alert(t('chat.offlineRetry'), t('chat.offlineRetryMessage'));
      return;
    }
    void sendMessage(lastFailedMessage);
  };

  const handleReport = (messageId: string) => {
    Alert.alert(
      t('chat.reportTitle'),
      t('chat.reportMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('chat.reportTitle'),
          style: 'destructive',
          onPress: () => {
            reportMessage.mutate(
              { messageId, reason: 'unsafe_or_incorrect' },
              {
                onSuccess: () =>
                  Alert.alert(t('chat.reportThanks'), t('chat.reportThanksMessage')),
                onError: () =>
                  Alert.alert(t('chat.reportFailed'), t('chat.reportFailedMessage')),
              }
            );
          },
        },
      ]
    );
  };

  if (isLoading || !room) {
    return (
      <View className="flex-1 bg-background justify-center items-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </View>
    );
  }

  // If the room failed to process
  if (room.status === 'error') {
    return (
      <View className="flex-1 bg-background justify-center items-center p-6">
        <Stack.Screen
          options={{
            title: t('chat.error.screenTitle'),
            headerShown: true,
            statusBarTranslucent: false,
          }}
        />
        <Text className="text-destructive font-bold text-xl mb-2">
          {t('chat.error.title')}
        </Text>
        <Text className="text-muted-foreground text-center">{t('chat.error.message')}</Text>
      </View>
    );
  }

  // If the room is currently heavily processing
  if (room.status !== 'ready') {
    return (
      <View className="flex-1 bg-background justify-center items-center p-6 space-y-6">
        <Stack.Screen
          options={{
            title: t('chat.processing.screenTitle'),
            headerShown: true,
            statusBarTranslucent: false,
          }}
        />
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
        <Text className="text-2xl font-bold mt-4">{t('chat.processing.title')}</Text>
        <Text className="text-muted-foreground text-center">{t('chat.processing.message')}</Text>
      </View>
    );
  }

  // The actual Chat UI
  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} className="flex-1 bg-background" style={{ flex: 1 }}>
      <KeyboardAvoidingView
        className="flex-1 bg-background"
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 92 : 0}
      >
        <Stack.Screen options={{ 
          title: room.book_title || 'Room', 
          headerShown: true,
          headerBackTitle: 'Hubs',
          statusBarTranslucent: false,
        }} />

        {isOffline ? (
          <View className="bg-destructive/10 px-4 py-2 flex-row items-center justify-center">
            <WifiOff size={16} color="#ef4444" />
            <Text className="ml-2 text-destructive font-medium text-sm">
              {t('chat.offline')}
            </Text>
          </View>
        ) : showReconnectedBanner ? (
          <View className="bg-success/10 px-4 py-2 flex-row items-center justify-center">
            <Text className="text-success font-medium text-sm">{t('chat.reconnected')}</Text>
          </View>
        ) : null}

        {streamError ? (
        <View className="mx-4 mt-3 rounded-xl border border-warning/40 bg-warning/10 p-3">
          <View className="flex-row items-start">
            <AlertTriangle size={18} color="#d97706" />
            <Text className="ml-2 flex-1 text-foreground text-sm">{streamError}</Text>
          </View>
          {lastFailedMessage ? (
            <Pressable
              className="mt-3 self-start rounded-md bg-warning/20 px-3 py-1.5 disabled:opacity-60"
              disabled={isOffline}
              onPress={handleRetry}
            >
              <Text className="text-warning font-semibold text-xs">
                {isOffline ? t('chat.retryWhenOnline') : t('chat.retry')}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <LegendList
        ref={listRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 8, paddingHorizontal: 16 }}
        recycleItems
        alignItemsAtEnd
        data={displayMessages}
        keyExtractor={(item) => item.id}
        onLayout={(event: LayoutChangeEvent) => {
          listViewportHeightRef.current = event.nativeEvent.layout.height;
        }}
        keyboardShouldPersistTaps="handled"
        onStartReachedThreshold={0.2}
        onStartReached={() => {
          if (messagesQuery.hasNextPage && !messagesQuery.isFetchingNextPage) {
            void messagesQuery.fetchNextPage();
          }
        }}
        ListHeaderComponent={
          messagesQuery.isFetchingNextPage ? (
            <View className="py-3">
              <ActivityIndicator size="small" />
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const isUser = item.role === 'user';
          const isStreamingMessage = item.id === 'streaming-assistant';

          return (
            <View
              className={`mb-3 ${isUser ? 'items-end' : 'items-start'}`}
              onLayout={(event) => {
                const { y, height } = event.nativeEvent.layout;
                messageLayoutsRef.current[item.id] = { y, height };
              }}
            >
              <View className={`max-w-[88%] rounded-2xl px-3 py-2 ${isUser ? 'bg-primary' : 'bg-slate-800 border border-slate-700'}`}>
                <Markdown
                  style={isUser ? USER_MARKDOWN_STYLE : ASSISTANT_MARKDOWN_STYLE}
                  onLinkPress={handleLinkPress}
                >
                  {item.content || ''}
                </Markdown>

                {!isUser && !isStreamingMessage ? (
                  <View className="mt-2 flex-row justify-end">
                    <Pressable className="rounded-md px-2 py-1" onPress={() => handleReport(item.id)}>
                      <Flag size={14} color="#9ca3af" />
                    </Pressable>
                  </View>
                ) : null}
              </View>

              {isStreamingMessage ? (
                <View className="mt-1 ml-1 flex-row items-center">
                  <Loader2 className="w-3 h-3 text-muted animate-spin" />
                  <Text className="ml-1 text-xs text-muted">{t('chat.streaming')}</Text>
                </View>
              ) : null}
            </View>
          );
        }}
      />

      <View className="border-t border-border bg-card px-3 pt-2 pb-3">
        <View className="flex-row items-end">
          <TextInput
            value={composerText}
            onChangeText={setComposerText}
            placeholder={
              isOffline
                ? t('chat.inputPlaceholderOffline')
                : isStreaming
                ? t('chat.inputPlaceholderStreaming')
                : t('chat.inputPlaceholder')
            }
            editable={!isStreaming && !isOffline}
            multiline
            className="flex-1 max-h-28 min-h-11 rounded-xl bg-background px-3 py-2 text-foreground"
            placeholderTextColor="#9ca3af"
          />

          <Pressable
            className={`ml-2 h-11 w-11 items-center justify-center rounded-xl ${
              isStreaming || isOffline || !composerText.trim() ? 'bg-muted' : 'bg-primary'
            }`}
            disabled={isStreaming || isOffline || !composerText.trim()}
            onPress={() => {
              void sendMessage(composerText);
            }}
          >
            <SendHorizontal
              size={18}
              color={
                isStreaming || isOffline || !composerText.trim() ? '#9ca3af' : '#ffffff'
              }
            />
          </Pressable>
        </View>

        {isOffline ? (
          <Text className="mt-2 text-xs text-muted">{t('chat.waitForConnection')}</Text>
        ) : isStreaming ? (
          <Text className="mt-2 text-xs text-muted">{t('chat.waitForResponse')}</Text>
        ) : null}
      </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
