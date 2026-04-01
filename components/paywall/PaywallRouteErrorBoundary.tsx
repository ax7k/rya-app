import { ErrorBoundaryProps } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function PaywallRouteErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f2f0eb', padding: 16 }}>
      <View style={{ flex: 1, justifyContent: 'center', gap: 12 }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color: '#111319' }}>Paywall crashed</Text>
        <Text style={{ fontSize: 14, color: '#3f3f46' }}>
          {error?.message || 'Unknown paywall error'}
        </Text>
        <Pressable
          style={{
            alignSelf: 'flex-start',
            borderWidth: 1,
            borderColor: '#111319',
            backgroundColor: '#111319',
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 10,
          }}
          onPress={retry}
        >
          <Text style={{ color: '#ffffff', fontWeight: '700' }}>Retry</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
