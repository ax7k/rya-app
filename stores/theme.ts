import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

export type ThemePreference = 'system' | 'light' | 'dark';

const THEME_PREFERENCE_KEY = 'rya_theme_preference';

interface ThemeState {
  preference: ThemePreference;
  isHydrated: boolean;
  hydrateThemePreference: () => Promise<void>;
  setThemePreference: (preference: ThemePreference) => Promise<void>;
}

function parsePreference(raw: string | null): ThemePreference | null {
  if (raw === 'system' || raw === 'light' || raw === 'dark') {
    return raw;
  }
  return null;
}

export const useThemeStore = create<ThemeState>((set) => ({
  preference: 'system',
  isHydrated: false,

  hydrateThemePreference: async () => {
    try {
      const rawValue = await SecureStore.getItemAsync(THEME_PREFERENCE_KEY);
      const parsed = parsePreference(rawValue);

      if (parsed) {
        set({ preference: parsed, isHydrated: true });
        return;
      }
    } catch {
      // Fall back to defaults if secure storage is unavailable.
    }

    set({ isHydrated: true });
  },

  setThemePreference: async (preference) => {
    set({ preference });

    try {
      await SecureStore.setItemAsync(THEME_PREFERENCE_KEY, preference);
    } catch {
      // Preference remains in memory even if persistence fails.
    }
  },
}));
