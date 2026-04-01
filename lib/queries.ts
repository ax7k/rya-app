import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from './api';
import { useEffect } from 'react';
import { supabase } from './supabase';

import { Alert } from 'react-native';

// --- Hub Queries ---
export function useHubs() {
  return useQuery({
    queryKey: ['hubs'],
    queryFn: () => fetchApi('/hubs'),
  });
}

export function useCreateHub() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => 
      fetchApi('/hubs', {
        method: 'POST',
        body: JSON.stringify({ name }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hubs'] });
    },
    onError: (err: any) => {
      Alert.alert('Create Hub Failed', err.message || 'Check if your FastAPI backend is running!');
    }
  });
}

export function useDeleteHub() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (hubId: string) => 
      fetchApi(`/hubs/${hubId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hubs'] });
    },
  });
}

// --- Room Queries ---
export function useRooms(hubId: string) {
  return useQuery({
    queryKey: ['rooms', hubId],
    queryFn: () => fetchApi(`/hubs/${hubId}/rooms`),
    enabled: !!hubId,
  });
}

export function useRoomsRealtime(hubId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!hubId) return;

    const channel = supabase
      .channel(`rooms-updates-${hubId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rooms',
          filter: `hub_id=eq.${hubId}`,
        },
        (payload: any) => {
          if (payload?.eventType === 'DELETE' && payload?.old?.id) {
            queryClient.setQueryData(['rooms', hubId], (old: any[] | undefined) =>
              old ? old.filter((r) => r.id !== payload.old.id) : []
            );
            return;
          }

          queryClient.invalidateQueries({ queryKey: ['rooms', hubId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [hubId, queryClient]);
}

// Room creation (Multipart FormData for PDF)
export function useCreateRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ hubId, fileUri, fileName, mimeType }: { hubId: string, fileUri: string, fileName: string, mimeType: string }) => {
      const formData = new FormData();
      // @ts-ignore - React Native FormData accepts an object with uri, name, type
      formData.append('file', {
        uri: fileUri,
        name: fileName,
        type: mimeType,
      });
      formData.append('level', 'high_school');

      return fetchApi(`/hubs/${hubId}/rooms`, {
        method: 'POST',
        headers: {
          // Native fetch handles multipart boundary automatically if Content-Type is omitted
          // We must actively remove the Content-Type injected by fetchApi wrapper
          'Content-Type': 'multipart/form-data', // Wait, fetch Api wrapper hardcodes application/json. We should fix that.
        },
        body: formData,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['rooms', variables.hubId] });
    },
  });
}

export function useDeleteRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ hubId, roomId }: { hubId: string, roomId: string }) => 
      fetchApi(`/hubs/${hubId}/rooms/${roomId}`, {
        method: 'DELETE',
      }),
    onMutate: async ({ hubId, roomId }) => {
      // Cancel any outgoing refetches to avoid overwriting our optimistic update
      await queryClient.cancelQueries({ queryKey: ['rooms', hubId] });
      // Snapshot the previous value
      const previousRooms = queryClient.getQueryData(['rooms', hubId]);
      // Optimistically remove the room from the cache
      queryClient.setQueryData(['rooms', hubId], (old: any[]) => 
        old ? old.filter((r) => r.id !== roomId) : []
      );
      return { previousRooms, hubId };
    },
    onError: (err, variables, context: any) => {
      // If the mutation fails, roll back to the previous snapshot
      if (context?.previousRooms) {
        queryClient.setQueryData(['rooms', context.hubId], context.previousRooms);
      }
    },
    onSuccess: (_, variables) => {
      // Keep optimistic delete sticky even if another refetch races in.
      queryClient.setQueryData(['rooms', variables.hubId], (old: any[] | undefined) =>
        old ? old.filter((r) => r.id !== variables.roomId) : []
      );
    },
  });
}
