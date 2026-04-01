import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import type { ErrorBoundaryProps } from 'expo-router';
import type { PurchasesOffering } from 'react-native-purchases';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchApi } from '../lib/api';
import {
  getCurrentOfferingSafe,
  hasRevenueCatApiKey,
  purchasePackageWithHandling,
  syncRevenueCatIdentity,
} from '../lib/revenuecat';
import {
  PLAN_DEFINITIONS,
  PRO_ENTITLEMENT_IDS,
  ULTRA_ENTITLEMENT_IDS,
  computeDiscountPercent,
  formatCurrency,
  hasAnyActiveEntitlement,
  resolvePlanPackages,
} from '../lib/paywall-config';
import type { BillingPeriod } from '../lib/paywall-config';
import { useAuthStore } from '../stores/auth';
import { PaywallPricingStatusPlain } from '../components/paywall/PaywallPricingStatusPlain';
import { PaywallRouteErrorBoundary } from '../components/paywall/PaywallRouteErrorBoundary';

const CARD_GAP = 12;

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  return fallback;
}

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return <PaywallRouteErrorBoundary error={error} retry={retry} />;
}

export default function PaywallScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { width } = useWindowDimensions();

  const [activePlanIndex, setActivePlanIndex] = useState(0);
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('annual');
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [isPricingLoading, setIsPricingLoading] = useState(true);
  const [pricingError, setPricingError] = useState<string | null>(null);
  const [pricingReloadNonce, setPricingReloadNonce] = useState(0);
  const [isPurchasing, setIsPurchasing] = useState(false);

  const activePlan = PLAN_DEFINITIONS[activePlanIndex] ?? PLAN_DEFINITIONS[0];
  const planPackages = useMemo(() => resolvePlanPackages(offering), [offering]);
  const activePlanPackages = planPackages[activePlan.id];

  const activeMonthlyPrice = activePlanPackages.monthlyPackage?.product.price ?? 0;
  const activeAnnualPrice = activePlanPackages.annualPackage?.product.price ?? 0;

  const activeMonthlyPriceLabel = isPricingLoading
    ? 'Loading...'
    : (activePlanPackages.monthlyPackage?.product.priceString ?? 'Unavailable');

  const activeAnnualPriceLabel = isPricingLoading
    ? 'Loading...'
    : (activePlanPackages.annualPackage?.product.priceString ?? 'Unavailable');

  const annualPerMonthFromStore = activePlanPackages.annualPackage?.product.pricePerMonthString ?? null;
  const computedAnnualPerMonthLabel = activeAnnualPrice > 0 ? formatCurrency(activeAnnualPrice / 12) : null;

  const activeAnnualMonthlyPriceLabel = isPricingLoading
    ? 'Loading...'
    : (
      annualPerMonthFromStore
      && annualPerMonthFromStore !== activeAnnualPriceLabel
        ? annualPerMonthFromStore
        : (computedAnnualPerMonthLabel ?? 'Unavailable')
    );

  const annualDiscount = useMemo(
    () => computeDiscountPercent(activeMonthlyPrice, activeAnnualPrice),
    [activeMonthlyPrice, activeAnnualPrice]
  );

  const cardWidth = Math.max(280, width - 72);

  useEffect(() => {
    let isCancelled = false;

    async function loadOffering() {
      setIsPricingLoading(true);
      setPricingError(null);

      if (__DEV__) {
        console.log('[Paywall] Loading offerings for user:', user?.id || 'anonymous');
      }

      try {
        if (!hasRevenueCatApiKey()) {
          throw new Error('RevenueCat API key is missing.');
        }

        const isIdentityReady = await syncRevenueCatIdentity(user?.id ?? null);
        if (!isIdentityReady) {
          throw new Error('RevenueCat initialization failed.');
        }

        const currentOffering = await getCurrentOfferingSafe();
        if (isCancelled) {
          return;
        }

        if (!currentOffering) {
          setOffering(null);
          setPricingError('No offering is available. In RevenueCat, set one offering as Current and attach packages.');
          if (__DEV__) {
            console.log('[Paywall] Offerings returned empty current/fallback offering.');
          }
          return;
        }

        if (__DEV__) {
          console.log('[Paywall] Loaded offering:', currentOffering.identifier, 'packages:', currentOffering.availablePackages?.length || 0);
        }

        setOffering(currentOffering);
      } catch (error) {
        if (!isCancelled) {
          setOffering(null);
          const message = getErrorMessage(error, 'Could not load subscription options right now.');
          setPricingError(message);
          if (__DEV__) {
            console.log('[Paywall] Offering load error:', message);
          }
        }
      } finally {
        if (!isCancelled) {
          setIsPricingLoading(false);
        }
      }
    }

    void loadOffering();

    return () => {
      isCancelled = true;
    };
  }, [user?.id, pricingReloadNonce]);

  async function syncBackendTierRevalidation() {
    try {
      await fetchApi('/profile/revalidate-subscription', {
        method: 'POST',
      });
    } catch {
      // Keep purchase UX responsive even if backend revalidation fails.
    }
  }

  async function handlePurchase(period: BillingPeriod) {
    setBillingPeriod(period);

    if (isPurchasing || isPricingLoading) {
      return;
    }

    const targetPackage = period === 'annual'
      ? activePlanPackages.annualPackage
      : activePlanPackages.monthlyPackage;

    if (!targetPackage) {
      Alert.alert('Unavailable', `${activePlan.name} ${period} package is not available.`);
      return;
    }

    setIsPurchasing(true);
    try {
      const { cancelled, customerInfo, errorMessage } = await purchasePackageWithHandling(targetPackage);

      if (cancelled) {
        return;
      }

      if (errorMessage) {
        Alert.alert('Purchase failed', errorMessage);
        return;
      }

      await syncBackendTierRevalidation();

      const hasPro = hasAnyActiveEntitlement(customerInfo, PRO_ENTITLEMENT_IDS);
      const hasUltra = hasAnyActiveEntitlement(customerInfo, ULTRA_ENTITLEMENT_IDS);
      const isUnlocked = activePlan.id === 'ultra' ? hasUltra : (hasPro || hasUltra);

      if (isUnlocked) {
        Alert.alert('Success', `${activePlan.name} unlocked successfully.`, [
          { text: 'Continue', onPress: () => router.replace('/(tabs)') },
        ]);
        return;
      }

      Alert.alert('Purchase complete', 'Your purchase was completed. Access will refresh shortly.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } finally {
      setIsPurchasing(false);
    }
  }

  function handleCardSnap(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const offsetX = event.nativeEvent.contentOffset.x;
    const nextIndex = Math.round(offsetX / (cardWidth + CARD_GAP));
    const boundedIndex = Math.max(0, Math.min(PLAN_DEFINITIONS.length - 1, nextIndex));
    setActivePlanIndex(boundedIndex);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f2f0eb' }}>
      <Stack.Screen options={{ headerShown: false, presentation: 'modal' }} />

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: 12 + (Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0),
          paddingBottom: 20,
          paddingHorizontal: 16,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable
            style={{ height: 44, width: 44, alignItems: 'center', justifyContent: 'center' }}
            onPress={() => router.back()}
          >
            <Text style={{ fontSize: 30, lineHeight: 34, color: '#111319' }}>×</Text>
          </Pressable>

          <Text style={{ flex: 1, textAlign: 'center', fontSize: 30, fontWeight: '800', color: '#111319' }}>
            Study boldly.
          </Text>

          <View style={{ height: 44, width: 44 }} />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingVertical: 16 }}
          snapToInterval={cardWidth + CARD_GAP}
          decelerationRate="fast"
          onMomentumScrollEnd={handleCardSnap}
          onScrollEndDrag={handleCardSnap}
        >
          {PLAN_DEFINITIONS.map((plan, index) => {
            const isActive = index === activePlanIndex;
            const isUltra = plan.id === 'ultra';

            return (
              <Pressable
                key={plan.id}
                onPress={() => setActivePlanIndex(index)}
                style={{
                  width: cardWidth,
                  marginRight: CARD_GAP,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: isActive ? '#111319' : '#d4d4d8',
                  backgroundColor: isUltra ? (isActive ? '#c9a24c' : '#dec58f') : (isActive ? '#111319' : '#ffffff'),
                  paddingHorizontal: 18,
                  paddingTop: 20,
                  paddingBottom: 28,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 30, fontWeight: '800', color: isUltra ? '#241500' : (isActive ? '#ffffff' : '#111319') }}>
                    {plan.name}
                  </Text>
                  <View style={{ backgroundColor: '#ffffffcc', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 }}>
                    <Text style={{ color: '#111319', fontWeight: '700', fontSize: 12 }}>{plan.badge}</Text>
                  </View>
                </View>

                <Text style={{ marginTop: 14, color: isUltra ? '#3f2700' : (isActive ? '#d4d4d8' : '#52525b'), fontSize: 16 }}>
                  {plan.subtitle}
                </Text>

                <View style={{ marginTop: 16, gap: 8 }}>
                  {plan.features.map((feature) => (
                    <Text
                      key={`${plan.id}-${feature}`}
                      style={{ color: isUltra ? '#2d1c00' : (isActive ? '#e4e4e7' : '#3f3f46'), fontSize: 15 }}
                    >
                      ✓ {feature}
                    </Text>
                  ))}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 10 }}>
          {PLAN_DEFINITIONS.map((plan, index) => (
            <View
              key={`dot-${plan.id}`}
              style={{
                height: 10,
                width: index === activePlanIndex ? 22 : 10,
                borderRadius: 99,
                backgroundColor: index === activePlanIndex ? '#111319' : '#a1a1aa',
              }}
            />
          ))}
        </View>

        <PaywallPricingStatusPlain
          isPricingLoading={isPricingLoading}
          pricingError={pricingError}
          onRetry={() => setPricingReloadNonce((value) => value + 1)}
        />

        <View style={{ gap: 10 }}>
          <Pressable
            onPress={() => {
              void handlePurchase('annual');
            }}
            disabled={isPurchasing || isPricingLoading}
            style={{
              borderRadius: 14,
              borderWidth: 1,
              borderColor: billingPeriod === 'annual' ? '#111319' : '#d4d4d8',
              backgroundColor: billingPeriod === 'annual' ? '#111319' : '#ffffff',
              paddingHorizontal: 14,
              paddingVertical: 12,
              opacity: (isPurchasing || isPricingLoading) ? 0.7 : 1,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 24, fontWeight: '800', color: billingPeriod === 'annual' ? '#ffffff' : '#18181b' }}>
                Annual
              </Text>
              {annualDiscount > 0 ? (
                <View style={{ backgroundColor: '#ffffff', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 }}>
                  <Text style={{ color: '#111319', fontWeight: '700' }}>Save {annualDiscount}%</Text>
                </View>
              ) : null}
            </View>
            <Text style={{ marginTop: 8, fontSize: 16, color: billingPeriod === 'annual' ? '#d4d4d8' : '#52525b' }}>
              {activeAnnualMonthlyPriceLabel} / month, billed yearly at {activeAnnualPriceLabel}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              void handlePurchase('monthly');
            }}
            disabled={isPurchasing || isPricingLoading}
            style={{
              borderRadius: 14,
              borderWidth: 1,
              borderColor: billingPeriod === 'monthly' ? '#111319' : '#d4d4d8',
              backgroundColor: billingPeriod === 'monthly' ? '#111319' : '#ffffff',
              paddingHorizontal: 14,
              paddingVertical: 12,
              opacity: (isPurchasing || isPricingLoading) ? 0.7 : 1,
            }}
          >
            <Text style={{ fontSize: 24, fontWeight: '800', color: billingPeriod === 'monthly' ? '#ffffff' : '#18181b' }}>
              Monthly
            </Text>
            <Text style={{ marginTop: 8, fontSize: 16, color: billingPeriod === 'monthly' ? '#d4d4d8' : '#52525b' }}>
              {activeMonthlyPriceLabel} / month
            </Text>
          </Pressable>
        </View>

        <Text style={{ marginTop: 14, textAlign: 'center', color: '#52525b', lineHeight: 20 }}>
          After purchase, subscription renews automatically. Cancel any time in your store settings.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
