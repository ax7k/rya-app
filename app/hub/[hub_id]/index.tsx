import { View, Text, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import {
  useRooms,
  useCreateRoom,
  useDeleteRoom,
  useHubs,
  useRoomsRealtime,
} from '../../../lib/queries';
import { FileText, Plus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LegendList } from '@legendapp/list';
import { useTranslation } from 'react-i18next';

export default function HubRoomsScreen() {
  const { hub_id } = useLocalSearchParams<{ hub_id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  useRoomsRealtime(hub_id!);

  const { data: hubs } = useHubs();
  const hubName = hubs?.find((h: any) => h.id === hub_id)?.name || t('common.loading');

  const { data: rooms, isLoading } = useRooms(hub_id!);
  const createRoom = useCreateRoom();
  const deleteRoom = useDeleteRoom();

  const handleAddRoom = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];

      createRoom.mutate(
        {
          hubId: hub_id!,
          fileUri: file.uri,
          fileName: file.name,
          mimeType: file.mimeType || 'application/pdf',
        },
        {
          onError: (err: any) => Alert.alert(t('rooms.uploadFailed'), err.message),
        }
      );
    } catch (err) {
      console.error('Document picker error:', err);
    }
  };

  const handleDeleteRoom = (roomId: string, roomTitle: string) => {
    Alert.alert(
      t('rooms.deleteTitle'),
      t('rooms.deleteMessage', { title: roomTitle || 'this document' }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => deleteRoom.mutate({ hubId: hub_id!, roomId }),
        },
      ]
    );
  };

  const statusColor = (status: string) => {
    if (status === 'ready') return 'bg-success/20';
    if (status === 'error') return 'bg-danger/20';
    return 'bg-warning/20';
  };

  const statusTextColor = (status: string) => {
    if (status === 'ready') return 'text-success';
    if (status === 'error') return 'text-danger';
    return 'text-warning';
  };

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View
        className="flex-row items-center pb-4 px-4 bg-card border-b border-border shadow-sm"
        style={{ paddingTop: insets.top + 8 }}
      >
        <Pressable
          className="w-10 h-10 items-center justify-center mr-2 rounded-full active:bg-muted"
          onPress={() => router.back()}
        >
          <ChevronLeft size={24} colorClassName="text-foreground" />
        </Pressable>
        <Text className="flex-1 text-foreground text-xl font-bold" numberOfLines={1}>
          {hubName}
        </Text>
      </View>

      <View className="flex-1 p-4">
        <View className="flex-row items-center justify-between mb-6">
          <Text className="text-foreground text-2xl font-bold">{t('rooms.title')}</Text>
          <Pressable
            className="flex-row items-center px-4 py-2 rounded-xl bg-primary disabled:opacity-50"
            onPress={handleAddRoom}
            disabled={createRoom.isPending}
          >
            {createRoom.isPending ? (
              <ActivityIndicator colorClassName="text-primary-foreground" size="small" />
            ) : (
              <>
                <Plus size={20} colorClassName="text-primary-foreground" />
                <Text className="text-primary-foreground font-semibold ml-2">
                  {t('rooms.uploadPdf')}
                </Text>
              </>
            )}
          </Pressable>
        </View>

        {isLoading ? (
          <ActivityIndicator size="large" colorClassName="text-primary" className="mt-10" />
        ) : (
          <LegendList
            recycleItems
            data={rooms}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Pressable
                className="p-4 mb-3 rounded-2xl bg-card shadow-sm border border-border flex-row items-center active:opacity-75"
                onPress={() => router.push(`/hub/${hub_id}/room/${item.id}`)}
              >
                <View className="w-12 h-12 rounded-xl bg-accent/10 items-center justify-center mr-4">
                  <FileText size={24} colorClassName="text-accent" />
                </View>

                <View className="flex-1 mr-2">
                  <Text className="text-foreground font-semibold text-base mb-1" numberOfLines={1}>
                    {item.book_title || 'Document'}
                  </Text>
                  <View className="flex-row items-center">
                    <View className={`px-2 py-0.5 rounded-full ${statusColor(item.status)}`}>
                      <Text className={`text-xs font-medium ${statusTextColor(item.status)}`}>
                        {t(`rooms.status.${item.status}` as any, {
                          defaultValue: item.status.toUpperCase(),
                        })}
                      </Text>
                    </View>
                    <Text className="text-muted text-xs ml-2">
                      {new Date(item.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                </View>

                <Pressable
                  className="p-3 mr-1 rounded-full active:bg-danger/20"
                  onPress={() => handleDeleteRoom(item.id, item.book_title)}
                >
                  <Trash2 size={20} colorClassName="text-danger" />
                </Pressable>

                <ChevronRight size={20} colorClassName="text-muted" />
              </Pressable>
            )}
            ListEmptyComponent={
              <View className="items-center justify-center py-20">
                <FileText size={48} colorClassName="text-muted mb-4" opacity={0.5} />
                <Text className="text-muted text-base text-center">{t('rooms.empty')}</Text>
              </View>
            }
          />
        )}
      </View>
    </View>
  );
}
