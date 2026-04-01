import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Home, User } from 'lucide-react-native';
import { THEME_COLORS, useResolvedTheme } from '../../lib/theme';

export default function TabLayout() {
  const { t } = useTranslation();
  const { resolvedTheme } = useResolvedTheme();

  const activeTint = THEME_COLORS[resolvedTheme].tabActive;
  const inactiveTint = THEME_COLORS[resolvedTheme].tabInactive;

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: activeTint,
        tabBarInactiveTintColor: inactiveTint,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.hubs', 'Hubs'),
          tabBarIcon: ({ color }) => <Home color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile', 'Profile'),
          headerShown: false,
          tabBarIcon: ({ color }) => <User color={color} size={24} />,
        }}
      />
    </Tabs>
  );
}
