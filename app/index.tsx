import { View, Text } from 'react-native';

export default function IndexScreen() {
  return (
    <View className="flex-1 bg-background justify-center items-center">
      <Text className="text-foreground text-2xl font-bold">Rya Alpha</Text>
      <Text className="text-muted text-base mt-2">Ready to unblock learning</Text>
    </View>
  );
}
