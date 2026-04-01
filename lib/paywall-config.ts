import type { CustomerInfo, PurchasesOffering, PurchasesPackage } from 'react-native-purchases';

export type PlanId = 'pro' | 'ultra';
export type BillingPeriod = 'annual' | 'monthly';

export type PlanDefinition = {
  id: PlanId;
  name: string;
  badge: string;
  subtitle: string;
  features: string[];
};

export type PlanPackageSelection = {
  monthlyPackage: PurchasesPackage | null;
  annualPackage: PurchasesPackage | null;
};

export type PlanPackageMap = Record<PlanId, PlanPackageSelection>;

export const PLAN_DEFINITIONS: PlanDefinition[] = [
  {
    id: 'pro',
    name: 'Pro',
    badge: 'Essential',
    subtitle: 'For focused learners who want more speed and stronger study tools.',
    features: [
      'Unlimited chat sessions',
      'Faster, higher-quality responses',
      'Flashcards, quizzes, and guided drills',
      'Priority support',
    ],
  },
  {
    id: 'ultra',
    name: 'Ultra',
    badge: 'All Access',
    subtitle: 'For power learners who want maximum depth and premium capabilities.',
    features: [
      'Everything in Pro',
      'Deepest reasoning mode',
      'Higher generation limits',
    ],
  },
];

export const PRO_ENTITLEMENT_IDS = ['pro', 'rya_pro', 'Rya Pro'];
export const ULTRA_ENTITLEMENT_IDS = ['ultra', 'rya_ultra', 'Rya Ultra'];

const PLAN_PRODUCT_IDENTIFIERS: Record<PlanId, { monthly: string[]; annual: string[] }> = {
  pro: {
    monthly: ['rea_pro_monthly', 'rya_pro_monthly', 'pro_monthly', 'monthly'],
    annual: ['rea_pro_yearly', 'rya_pro_yearly', 'pro_yearly', 'yearly', 'annual'],
  },
  ultra: {
    monthly: ['rea_ultra_monthly', 'rya_ultra_monthly', 'ultra_monthly'],
    annual: ['rea_ultra_yearly', 'rya_ultra_yearly', 'ultra_yearly', 'ultra_annual'],
  },
};

const EMPTY_PLAN_PACKAGES: PlanPackageMap = {
  pro: {
    monthlyPackage: null,
    annualPackage: null,
  },
  ultra: {
    monthlyPackage: null,
    annualPackage: null,
  },
};

export function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function computeDiscountPercent(monthlyPrice: number, annualPrice: number): number {
  const regularYearlyCost = monthlyPrice * 12;
  if (regularYearlyCost <= 0 || annualPrice >= regularYearlyCost) {
    return 0;
  }

  return Math.round(((regularYearlyCost - annualPrice) / regularYearlyCost) * 100);
}

function normalizeIdentifier(value: string | null | undefined): string {
  return (value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function hasAnyActiveEntitlement(customerInfo: CustomerInfo | null, entitlementIds: string[]): boolean {
  const activeEntitlements = customerInfo?.entitlements?.active;
  if (!activeEntitlements) {
    return false;
  }

  const activeKeys = Object.keys(activeEntitlements).map(normalizeIdentifier);
  return entitlementIds.some((identifier) => activeKeys.includes(normalizeIdentifier(identifier)));
}

function findPackageForPlanPeriod(
  offering: PurchasesOffering,
  planId: PlanId,
  period: BillingPeriod
): PurchasesPackage | null {
  const availablePackages = offering.availablePackages || [];
  const candidateIdentifiers = PLAN_PRODUCT_IDENTIFIERS[planId][period].map(normalizeIdentifier);

  const exactMatch = availablePackages.find((pkg) => {
    const productIdentifier = normalizeIdentifier(pkg.product.identifier);
    const packageIdentifier = normalizeIdentifier(pkg.identifier);
    return candidateIdentifiers.includes(productIdentifier) || candidateIdentifiers.includes(packageIdentifier);
  });

  if (exactMatch) {
    return exactMatch;
  }

  const periodTokens = period === 'annual' ? ['annual', 'yearly', 'year'] : ['monthly', 'month'];
  return availablePackages.find((pkg) => {
    const idBlob = `${normalizeIdentifier(pkg.product.identifier)} ${normalizeIdentifier(pkg.identifier)}`;
    return idBlob.includes(planId) && periodTokens.some((token) => idBlob.includes(token));
  }) || null;
}

export function resolvePlanPackages(offering: PurchasesOffering | null): PlanPackageMap {
  if (!offering) {
    return EMPTY_PLAN_PACKAGES;
  }

  const proMonthly = findPackageForPlanPeriod(offering, 'pro', 'monthly') || offering.monthly || null;
  const proAnnual = findPackageForPlanPeriod(offering, 'pro', 'annual') || offering.annual || null;

  return {
    pro: {
      monthlyPackage: proMonthly,
      annualPackage: proAnnual,
    },
    ultra: {
      monthlyPackage: findPackageForPlanPeriod(offering, 'ultra', 'monthly'),
      annualPackage: findPackageForPlanPeriod(offering, 'ultra', 'annual'),
    },
  };
}
