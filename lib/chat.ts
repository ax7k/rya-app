import { fetchEventSource } from 'react-native-fetch-event-source';
import { API_URL } from './api';
import { supabase } from './supabase';

export type ChatDonePayload = {
  message_id?: string;
  has_ui_block?: boolean;
};

export type ChatStreamErrorPayload = {
  code?: string;
  message?: string;
};

export type StreamRoomChatHandlers = {
  onStart?: () => void;
  onToken?: (text: string) => void;
  onDone?: (payload: ChatDonePayload) => void;
  onSafety?: (message: string) => void;
  onError?: (payload: ChatStreamErrorPayload) => void;
};

function parseJsonSafely(value: string): any {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function streamRoomChat(
  roomId: string,
  message: string,
  handlers: StreamRoomChatHandlers,
  signal?: AbortSignal
): Promise<void> {
  const authClient: any = supabase.auth as any;
  const sessionResponse = authClient.getSession
    ? await authClient.getSession()
    : { data: { session: authClient.session ? authClient.session() : null } };
  const session = sessionResponse?.data?.session ?? null;

  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  await fetchEventSource(`${API_URL}/rooms/${roomId}/chat`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({ message }),
    signal,
    async onopen(response) {
      if (!response.ok) {
        let detail = 'Unable to start chat stream';
        try {
          const body = await response.json();
          detail = body?.detail || body?.message || detail;
        } catch {
          // ignore parse failures
        }
        throw new Error(detail);
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/event-stream')) {
        throw new Error('Invalid streaming response');
      }
    },
    onmessage(event) {
      const data = parseJsonSafely(event.data || '{}') || {};

      if (event.event === 'start') {
        handlers.onStart?.();
        return;
      }

      if (event.event === 'token') {
        const token = typeof data.text === 'string' ? data.text : '';
        if (token) {
          handlers.onToken?.(token);
        }
        return;
      }

      if (event.event === 'done') {
        handlers.onDone?.(data as ChatDonePayload);
        return;
      }

      if (event.event === 'safety') {
        handlers.onSafety?.(typeof data.message === 'string' ? data.message : 'Safety policy triggered');
        return;
      }

      if (event.event === 'error') {
        handlers.onError?.(data as ChatStreamErrorPayload);
        throw new Error(typeof data.message === 'string' ? data.message : 'Streaming failed');
      }
    },
    onerror(error) {
      if (error instanceof Error) {
        handlers.onError?.({ message: error.message });
        throw error;
      }

      handlers.onError?.({ message: 'Streaming connection failed' });
      throw new Error('Streaming connection failed');
    },
  });
}
