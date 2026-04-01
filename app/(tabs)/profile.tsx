import { View, Text, Pressable, Alert, ScrollView } from 'react-native';
import { useAuthStore } from '../../stores/auth';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Settings } from 'lucide-react-native';
import {
  getCustomerInfoSafe,
  hasRevenueCatApiKey,
  syncRevenueCatIdentity,
} from '../../lib/revenuecat';
import { useResolvedTheme } from '../../lib/theme';
import {
  PRO_ENTITLEMENT_IDS,
  ULTRA_ENTITLEMENT_IDS,
  hasAnyActiveEntitlement,
} from '../../lib/paywall-config';
import { useTranslation } from 'react-i18next';

type ActivityRowProps = {
  label: string;
  onPress: () => void;
  danger?: boolean;
};

function ActivityRow({ label, onPress, danger = false }: ActivityRowProps) {
  return (
    <Pressable
      className="border-b border-border py-5 flex-row items-center justify-between"
      onPress={onPress}
    >
      <Text className={`text-2xl font-semibold ${danger ? 'text-danger' : 'text-foreground'}`}>
        {label}
      </Text>
      <Text className={`text-2xl ${danger ? 'text-danger' : 'text-foreground'}`}>›</Text>
    </Pressable>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut } = useAuthStore();
  const { resolvedTheme } = useResolvedTheme();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [subscriptionLabel, setSubscriptionLabel] = useState('');
  const [isTierLoading, setIsTierLoading] = useState(false);
  const { t } = useTranslation();

  const hasRevenueCat = hasRevenueCatApiKey();

  const todayLabel = useMemo(
    () => new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' }),
    []
  );

  const joinedLabel = useMemo(() => {
    if (!user?.created_at) return 'Unknown';
    return new Date(user.created_at).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }, [user?.created_at]);

  const settingsIconColor = resolvedTheme === 'dark' ? '#f4f4f5' : '#18181b';

  async function loadSubscriptionTier() {
    if (!user?.id || !hasRevenueCat) {
      setSubscriptionLabel(t('profile.tiers.free'));
      return;
    }

    setIsTierLoading(true);
    try {
      const didSyncIdentity = await syncRevenueCatIdentity(user.id);
      if (!didSyncIdentity) {
        setSubscriptionLabel(t('profile.tiers.free'));
        return;
      }

      const customerInfo = await getCustomerInfoSafe();
      const hasUltra = hasAnyActiveEntitlement(customerInfo, ULTRA_ENTITLEMENT_IDS);
      const hasPro = hasAnyActiveEntitlement(customerInfo, PRO_ENTITLEMENT_IDS);

      if (hasUltra) {
        setSubscriptionLabel(t('profile.tiers.ultra'));
      } else if (hasPro) {
        setSubscriptionLabel(t('profile.tiers.pro'));
      } else {
        setSubscriptionLabel(t('profile.tiers.free'));
      }
    } catch {
      setSubscriptionLabel(t('profile.tiers.free'));
    } finally {
      setIsTierLoading(false);
    }
  }

  async function handleSignOut() {
    if (isSigningOut) return;
    setIsSigningOut(true);
    await signOut();
    setIsSigningOut(false);
  }

  function handleManageAccount() {
    Alert.alert(
      t('profile.signOutTitle'),
      user?.email || t('profile.manageAccount'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: isSigningOut ? t('profile.signingOut') : t('profile.signOutConfirm'),
          style: 'destructive',
          onPress: () => void handleSignOut(),
        },
      ]
    );
  }

  function handleOpenPaywall() {
    router.push('/paywall');
  }

  useEffect(() => {
    void loadSubscriptionTier();
  }, [user?.id, hasRevenueCat]);

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ padding: 16, paddingBottom: 30 }}
    >
      <View className="flex-row items-start justify-between mt-1">
        <View>
          <Text className="text-muted text-lg font-semibold">{todayLabel}</Text>
          <Text className="text-foreground text-5xl font-black mt-1">{t('profile.title')}</Text>
        </View>

        <Pressable
          className="h-12 w-12 items-center justify-center rounded-full bg-card border border-border"
          onPress={handleManageAccount}
        >
          <Settings size={20} color={settingsIconColor} />
        </Pressable>
      </View>

      <View className="mt-6 bg-card border border-border px-5 py-6">
        <Text className="text-foreground text-xl font-semibold">
          {t('profile.subscription')}:{' '}
          {isTierLoading ? t('profile.checking') : subscriptionLabel}
        </Text>
        <Text className="text-foreground text-4xl font-semibold mt-5">
          {t('profile.joined')}: {joinedLabel}
        </Text>

        <Pressable
          className="mt-6 rounded-full border border-foreground px-4 py-3 items-center"
          onPress={handleManageAccount}
        >
          <Text className="text-foreground text-2xl font-semibold">
            {t('profile.manageAccount')}
          </Text>
        </Pressable>

        <Pressable
          className="mt-4 rounded-full bg-foreground px-4 py-3 items-center"
          onPress={handleOpenPaywall}
        >
          <Text className="text-background text-2xl font-semibold">{t('profile.subscribe')}</Text>
        </Pressable>
      </View>

      <View className="mt-9">
        <Text className="text-foreground text-5xl font-black">{t('profile.myActivity')}</Text>

        <ActivityRow
          label={t('profile.manageHubs')}
          onPress={() => router.push('/(tabs)')}
        />
        <ActivityRow
          label={t('profile.continueStudying')}
          onPress={() => router.push('/(tabs)')}
        />
        <ActivityRow
          label={isSigningOut ? t('profile.signingOut') : t('profile.signOut')}
          onPress={() => void handleSignOut()}
          danger
        />
      </View>
    </ScrollView>
  );
}
