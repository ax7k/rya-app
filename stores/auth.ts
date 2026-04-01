import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthState {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  setSession: (session: Session | null) => void;
  initializeAuth: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  isLoading: true,
  
  setSession: (session) => set({ session, user: session?.user || null, isLoading: false }),
  
  initializeAuth: async () => {
    // Get initial session
    const { data: { session } } = await supabase.auth.getSession();
    set({ session, user: session?.user || null, isLoading: false });

    // Listen to auth changes (token refresh, sign in, sign out)
    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, user: session?.user || null, isLoading: false });
    });
  },

  signOut: async () => {
    set({ isLoading: true });
    await supabase.auth.signOut();
    set({ session: null, user: null, isLoading: false });
  }
}));
