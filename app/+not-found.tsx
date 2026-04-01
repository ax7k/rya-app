import { Link, Stack } from 'expo-router';
import { Text, View } from 'react-native';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <View className="flex-1 items-center justify-center bg-background px-6">
        <Text className="text-foreground text-xl font-semibold">This screen does not exist.</Text>
        <Link href="/" className="mt-4 text-primary font-medium">
          Go to home
        </Link>
      </View>
    </>
  );
}
