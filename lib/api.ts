import { supabase } from './supabase';

export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

/**
 * Native fetch wrapper that automatically fetches the current Supabase session,
 * attaches it as a Bearer token, and handles 401 token refreshes natively.
 */
export async function fetchApi(endpoint: string, options: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  
  const headers = new Headers(options.headers || {});
  // Only set application/json if we are not sending FormData
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  // If using FormData, let native fetch auto-set the boundary header by deleting any enforced Content-Type
  if (options.body instanceof FormData) {
    headers.delete('Content-Type');
  }
  
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new ApiError(errorData?.detail || errorData?.error || response.statusText, response.status);
  }

  // 204 responses intentionally have no body.
  if (response.status === 204) {
    return null;
  }

  // Some successful endpoints may return an empty body.
  const raw = await response.text();
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}
