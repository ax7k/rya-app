import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Uniwind } from 'uniwind';

import '../global.css';
import '../lib/i18n';
import { syncRevenueCatIdentity } from '../lib/revenuecat';
import { THEME_COLORS, useResolvedTheme } from '../lib/theme';

import { useAuthStore } from '../stores/auth';
import { useThemeStore } from '../stores/theme';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

export default function RootLayout() {
  const { session, isLoading, initializeAuth } = useAuthStore();
  const { preference: themePreference, resolvedTheme } = useResolvedTheme();
  const isThemeHydrated = useThemeStore((state) => state.isHydrated);
  const hydrateThemePreference = useThemeStore((state) => state.hydrateThemePreference);
  const segments = useSegments();
  const router = useRouter();
  
  const [loaded] = useFonts({
    // Add Google Sans / Product Sans here later
  });

  useEffect(() => {
    void initializeAuth();
  }, [initializeAuth]);

  useEffect(() => {
    void hydrateThemePreference();
  }, [hydrateThemePreference]);

  useEffect(() => {
    const systemBackground = THEME_COLORS[resolvedTheme].appBackground;

    // Keep Uniwind in system mode when selected so it can react to OS theme changes.
    Uniwind.setTheme(themePreference);
    void SystemUI.setBackgroundColorAsync(systemBackground);

    if (Platform.OS === 'android') {
      void NavigationBar.setButtonStyleAsync(resolvedTheme === 'dark' ? 'light' : 'dark');
    }
  }, [resolvedTheme, themePreference]);

  useEffect(() => {
    if (loaded && !isLoading && isThemeHydrated) {
      void SplashScreen.hideAsync();
    }
  }, [loaded, isLoading, isThemeHydrated]);

  useEffect(() => {
    if (isLoading) return;
    
    // Auth redirect logic
    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [session, isLoading, segments, router]);

  useEffect(() => {
    void syncRevenueCatIdentity(session?.user?.id ?? null);
  }, [session?.user?.id]);

  if (!loaded || isLoading || !isThemeHydrated) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider value={resolvedTheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack>
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="paywall" options={{ headerShown: false, presentation: 'modal' }} />
            <Stack.Screen name="+not-found" />
          </Stack>
          <StatusBar
            style={resolvedTheme === 'dark' ? 'light' : 'dark'}
            backgroundColor={THEME_COLORS[resolvedTheme].appBackground}
            translucent={false}
          />
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
