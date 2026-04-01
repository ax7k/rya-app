import { ActivityIndicator, Pressable, Text, View } from 'react-native';

type PaywallPricingStatusPlainProps = {
  isPricingLoading: boolean;
  pricingError: string | null;
  onRetry: () => void;
};

export function PaywallPricingStatusPlain({
  isPricingLoading,
  pricingError,
  onRetry,
}: PaywallPricingStatusPlainProps) {
  if (!isPricingLoading && !pricingError) {
    return null;
  }

  return (
    <View style={{ borderWidth: 1, borderColor: '#d4d4d8', backgroundColor: '#ffffff', borderRadius: 16, padding: 14, marginBottom: 14 }}>
      {isPricingLoading ? (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <ActivityIndicator />
          <Text style={{ marginLeft: 10, color: '#18181b' }}>Loading subscription options...</Text>
        </View>
      ) : null}

      {pricingError ? (
        <>
          <Text style={{ marginTop: 8, color: '#18181b', fontWeight: '700' }}>Subscription options unavailable</Text>
          <Text style={{ marginTop: 4, color: '#52525b' }}>{pricingError}</Text>
        </>
      ) : null}

      {!isPricingLoading ? (
        <Pressable
          onPress={onRetry}
          style={{
            marginTop: 10,
            alignSelf: 'flex-start',
            borderRadius: 10,
            backgroundColor: '#111319',
            paddingHorizontal: 12,
            paddingVertical: 8,
          }}
        >
          <Text style={{ color: '#ffffff', fontWeight: '700' }}>Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
