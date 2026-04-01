import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

type PaywallInfoSheetProps = {
  visible: boolean;
  sheetHeight: number;
  onClose: () => void;
};

export function PaywallInfoSheet({ visible, sheetHeight, onClose }: PaywallInfoSheetProps) {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-paywall-scrim">
        <Pressable className="flex-1" onPress={onClose} />

        <View
          className="rounded-t-3xl border-t border-paywall-sheet-border bg-paywall-sheet"
          style={{ height: sheetHeight }}
        >
          <View className="items-center pt-3 pb-1">
            <View className="h-1.5 w-12 rounded-full bg-paywall-sheet-handle" />
          </View>

          <View className="px-5 pt-2 pb-4">
            <Text className="text-paywall-sheet-foreground text-4xl font-black">Subscription Details</Text>
          </View>

          <ScrollView
            className="flex-1 px-5"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 28 }}
          >
            <Text className="text-paywall-sheet-muted text-lg leading-8">
              Your Rya subscription is linked to your account and works across your supported devices when you sign in.
            </Text>

            <Text className="text-paywall-sheet-muted text-lg leading-8 mt-5">
              Billing: Charges renew automatically based on your selected plan unless you cancel before the next renewal date.
            </Text>

            <Text className="text-paywall-sheet-muted text-lg leading-8 mt-5">
              Managing subscription: You can update, cancel, or switch plans anytime in your store subscription settings.
            </Text>

            <Text className="text-paywall-sheet-muted text-lg leading-8 mt-5">
              Access: If you cancel, your premium access stays active until the end of the current billing period.
            </Text>

            <Pressable className="mt-8 items-center" onPress={onClose}>
              <Text className="text-paywall-sheet-foreground text-lg font-semibold underline">Terms & Conditions</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
