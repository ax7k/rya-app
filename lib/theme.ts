import { useColorScheme } from 'react-native';

import { ThemePreference, useThemeStore } from '../stores/theme';

export type ResolvedTheme = 'light' | 'dark';

export const THEME_COLORS: Record<ResolvedTheme, {
  appBackground: string;
  tabActive: string;
  tabInactive: string;
}> = {
  light: {
    appBackground: '#F2F0EB',
    tabActive: '#18181B',
    tabInactive: '#6B7280',
  },
  dark: {
    appBackground: '#000000',
    tabActive: '#F4F4F5',
    tabInactive: '#A7ADC0',
  },
};

export function resolveThemePreference(
  preference: ThemePreference,
  systemColorScheme: 'light' | 'dark' | null | undefined
): ResolvedTheme {
  if (preference === 'system') {
    return systemColorScheme === 'dark' ? 'dark' : 'light';
  }

  return preference;
}

export function useResolvedTheme() {
  const systemColorScheme = useColorScheme();
  const preference = useThemeStore((state) => state.preference);
  const resolvedTheme = resolveThemePreference(preference, systemColorScheme);

  return {
    preference,
    resolvedTheme,
  };
}
