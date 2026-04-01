import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';

type RoomMessage = {
  id: string;
  room_id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  ui_block: Record<string, unknown> | null;
  created_at: string;
};

type RoomMessagesPage = {
  items: RoomMessage[];
  nextCursor: string | null;
};

const PAGE_SIZE = 25;

export function useRoomMessages(roomId: string) {
  return useInfiniteQuery<RoomMessagesPage, Error>({
    queryKey: ['roomMessages', roomId],
    enabled: !!roomId,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      let query = supabase
        .from('messages')
        .select('id,room_id,user_id,role,content,ui_block,created_at')
        .eq('room_id', roomId)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE + 1);

      if (pageParam) {
        query = query.lt('created_at', pageParam);
      }

      const { data, error } = await query;
      if (error) {
        throw error;
      }

      const rows = (data || []) as RoomMessage[];
      const hasMore = rows.length > PAGE_SIZE;
      const items = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
      const nextCursor = hasMore ? items[items.length - 1]?.created_at || null : null;

      return { items, nextCursor };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
  });
}

export function flattenMessagesNewestFirst(pages: RoomMessagesPage[] | undefined): RoomMessage[] {
  if (!pages?.length) {
    return [];
  }
  return pages.flatMap((page) => page.items);
}

export function useReportMessage(roomId: string) {
  return useMutation({
    mutationFn: async ({ messageId, reason }: { messageId: string; reason?: string }) => {
      const authClient: any = supabase.auth as any;
      const userResponse = authClient.getUser
        ? await authClient.getUser()
        : { data: { user: authClient.user ? authClient.user() : null } };
      const user = userResponse?.data?.user ?? null;

      if (!user) {
        throw new Error('Not authenticated');
      }

      const { error } = await supabase.from('reported_messages').insert({
        message_id: messageId,
        user_id: user.id,
        reason: reason || 'inappropriate_or_incorrect',
        status: 'pending',
      });

      if (error) {
        throw error;
      }
    },
  });
}

export function useClearRoomMessages(roomId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('messages').delete().eq('room_id', roomId);
      if (error) {
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roomMessages', roomId] });
    },
  });
}
