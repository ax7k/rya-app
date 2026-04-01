import { Platform } from 'react-native';
import Purchases, {
  LOG_LEVEL,
} from 'react-native-purchases';
import type { CustomerInfo, PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';

export const RYA_PRO_ENTITLEMENT_ID = 'Rya Pro';
export const RYA_MONTHLY_PRODUCT_ID = 'monthly';
export const RYA_YEARLY_PRODUCT_ID = 'yearly';

let isConfigured = false;
let configuredUserId: string | null = null;
let hasWarnedMissingKey = false;
let configurationPromise: Promise<boolean> | null = null;

function getRevenueCatPlatformKey(): string | null {
  const iosKey = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS || '';
  const androidKey = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID || '';
  const fallbackKey = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY || '';

  if (Platform.OS === 'ios') {
    return iosKey || fallbackKey || null;
  }

  if (Platform.OS === 'android') {
    return androidKey || fallbackKey || null;
  }

  return iosKey || androidKey || fallbackKey || null;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  return fallback;
}

function isPurchaseCancelledError(error: any): boolean {
  return (
    error?.code === Purchases.PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR
    || Boolean(error?.userCancelled)
  );
}

export function hasRevenueCatApiKey(): boolean {
  return Boolean(getRevenueCatPlatformKey());
}

export async function syncRevenueCatIdentity(userId: string | null): Promise<boolean> {
  const apiKey = getRevenueCatPlatformKey();

  if (!apiKey) {
    if (__DEV__ && !hasWarnedMissingKey) {
      hasWarnedMissingKey = true;
      console.warn('RevenueCat API key is missing. Set EXPO_PUBLIC_REVENUECAT_API_KEY_IOS and EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID.');
    }
    return false;
  }

  if (!isConfigured) {
    if (!configurationPromise) {
      configurationPromise = (async () => {
        try {
          await Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.INFO);
          Purchases.configure({
            apiKey,
            appUserID: userId || undefined,
          });
          isConfigured = true;
          configuredUserId = userId;
          return true;
        } catch (error) {
          isConfigured = false;
          configuredUserId = null;

          if (__DEV__) {
            console.warn('RevenueCat configure failed:', getErrorMessage(error, 'Unknown configure error'));
          }

          return false;
        }
      })().finally(() => {
        configurationPromise = null;
      });
    }

    const configured = await configurationPromise;
    if (!configured) {
      return false;
    }
  }

  try {
    if (userId && userId !== configuredUserId) {
      await Purchases.logIn(userId);
      configuredUserId = userId;
      return true;
    }

    if (!userId && configuredUserId) {
      await Purchases.logOut();
      configuredUserId = null;
      return true;
    }
  } catch (error) {
    if (__DEV__) {
      console.warn('RevenueCat identity sync failed:', getErrorMessage(error, 'Unknown identity sync error'));
    }

    return false;
  }

  return true;
}

export function hasRyaProEntitlement(customerInfo: CustomerInfo | null | undefined): boolean {
  return Boolean(customerInfo?.entitlements?.active?.[RYA_PRO_ENTITLEMENT_ID]?.isActive);
}

export async function getCustomerInfoSafe(): Promise<CustomerInfo | null> {
  try {
    return await Purchases.getCustomerInfo();
  } catch {
    return null;
  }
}

export async function getCurrentOfferingSafe(): Promise<PurchasesOffering | null> {
  try {
    const offerings = await Purchases.getOfferings();
    if (offerings.current) {
      return offerings.current;
    }

    const fallbackOffering = Object.values(offerings.all || {})[0] || null;
    if (__DEV__ && !offerings.current) {
      console.warn(
        'RevenueCat current offering is missing. Falling back to first available offering:',
        fallbackOffering?.identifier || 'none',
        'all offerings:',
        Object.keys(offerings.all || {})
      );
    }

    return fallbackOffering;
  } catch {
    return null;
  }
}

export function getMonthlyAndYearlyPackages(offering: PurchasesOffering | null): {
  monthlyPackage: PurchasesPackage | null;
  yearlyPackage: PurchasesPackage | null;
} {
  if (!offering) {
    return { monthlyPackage: null, yearlyPackage: null };
  }

  const availablePackages = offering.availablePackages || [];

  const monthlyPackage = offering.monthly
    || availablePackages.find((pkg) => pkg.identifier.toLowerCase() === 'monthly')
    || availablePackages.find((pkg) => pkg.product.identifier === RYA_MONTHLY_PRODUCT_ID)
    || null;

  const yearlyPackage = offering.annual
    || availablePackages.find((pkg) => pkg.identifier.toLowerCase() === 'yearly')
    || availablePackages.find((pkg) => pkg.product.identifier === RYA_YEARLY_PRODUCT_ID)
    || null;

  return {
    monthlyPackage,
    yearlyPackage,
  };
}

export async function purchasePackageWithHandling(aPackage: PurchasesPackage): Promise<{
  cancelled: boolean;
  customerInfo: CustomerInfo | null;
  errorMessage: string | null;
}> {
  try {
    const result = await Purchases.purchasePackage(aPackage);
    return {
      cancelled: false,
      customerInfo: result.customerInfo,
      errorMessage: null,
    };
  } catch (error: any) {
    return {
      cancelled: isPurchaseCancelledError(error),
      customerInfo: null,
      errorMessage: getErrorMessage(error, 'Purchase failed.'),
    };
  }
}

export async function restorePurchasesWithHandling(): Promise<{
  customerInfo: CustomerInfo | null;
  errorMessage: string | null;
}> {
  try {
    const customerInfo = await Purchases.restorePurchases();
    return {
      customerInfo,
      errorMessage: null,
    };
  } catch (error) {
    return {
      customerInfo: null,
      errorMessage: getErrorMessage(error, 'Restore failed. Please try again.'),
    };
  }
}

export async function presentRyaProPaywall(offering?: PurchasesOffering | null): Promise<{
  result: PAYWALL_RESULT | null;
  errorMessage: string | null;
}> {
  try {
    const result = await RevenueCatUI.presentPaywallIfNeeded({
      requiredEntitlementIdentifier: RYA_PRO_ENTITLEMENT_ID,
      offering: offering || undefined,
      displayCloseButton: true,
    });

    return {
      result,
      errorMessage: null,
    };
  } catch (error) {
    return {
      result: null,
      errorMessage: getErrorMessage(error, 'Unable to present paywall right now.'),
    };
  }
}

export async function presentCustomerCenterWithHandling(): Promise<string | null> {
  try {
    await RevenueCatUI.presentCustomerCenter();
    return null;
  } catch (error) {
    return getErrorMessage(error, 'Unable to open customer center right now.');
  }
}
