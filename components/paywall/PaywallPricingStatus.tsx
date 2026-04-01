import { ActivityIndicator, Pressable, Text, View } from 'react-native';

type PaywallPricingStatusProps = {
  isPricingLoading: boolean;
  pricingError: string | null;
  onRetry: () => void;
};

export function PaywallPricingStatus({
  isPricingLoading,
  pricingError,
  onRetry,
}: PaywallPricingStatusProps) {
  if (!isPricingLoading && !pricingError) {
    return null;
  }

  return (
    <View className="mt-5 rounded-2xl border border-paywall-plan-unselected-border bg-paywall-plan-unselected px-4 py-3">
      {isPricingLoading ? (
        <View className="flex-row items-center">
          <ActivityIndicator />
          <Text className="ml-3 flex-1 text-paywall-plan-unselected-foreground">
            Loading subscription options...
          </Text>
        </View>
      ) : null}

      {pricingError ? (
        <>
          <Text className="mt-2 text-paywall-plan-unselected-foreground font-semibold">
            Subscription options unavailable
          </Text>
          <Text className="mt-1 text-paywall-plan-unselected-subtle">
            {pricingError}
          </Text>
        </>
      ) : null}

      {!isPricingLoading ? (
        <Pressable
          className="mt-3 self-start rounded-xl border border-paywall-plan-selected-border bg-paywall-plan-selected px-3 py-2"
          onPress={onRetry}
        >
          <Text className="text-paywall-plan-selected-foreground font-semibold">Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
