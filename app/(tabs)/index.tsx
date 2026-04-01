import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { useHubs, useCreateHub, useDeleteHub } from '../../lib/queries';
import { useState } from 'react';
import { Folder, Plus, Trash2, ChevronRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { LegendList } from '@legendapp/list';
import { useTranslation } from 'react-i18next';

export default function HubsScreen() {
  const { data: hubs, isLoading } = useHubs();
  const createHub = useCreateHub();
  const deleteHub = useDeleteHub();
  const [newHubName, setNewHubName] = useState('');
  const router = useRouter();
  const { t } = useTranslation();

  const handleCreate = () => {
    if (!newHubName.trim()) return;
    createHub.mutate(newHubName.trim(), {
      onSuccess: () => setNewHubName(''),
    });
  };

  return (
    <View className="flex-1 bg-background p-4">
      <View className="flex-row items-center mb-6 gap-2">
        <TextInput
          className="flex-1 h-12 px-4 rounded-xl bg-card border border-border text-foreground"
          placeholder={t('hubs.newHubPlaceholder')}
          placeholderTextColorClassName="text-muted"
          value={newHubName}
          onChangeText={setNewHubName}
          onSubmitEditing={handleCreate}
        />
        <Pressable
          className="w-12 h-12 rounded-xl bg-primary items-center justify-center disabled:opacity-50"
          onPress={handleCreate}
          disabled={createHub.isPending || !newHubName.trim()}
        >
          {createHub.isPending ? (
            <ActivityIndicator colorClassName="text-primary-foreground" />
          ) : (
            <Plus size={24} colorClassName="text-primary-foreground" />
          )}
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" colorClassName="text-primary" className="mt-10" />
      ) : (
        <LegendList
          recycleItems
          data={hubs}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable
              className="flex-row items-center p-4 mb-3 rounded-2xl bg-card shadow-sm border border-border active:opacity-75"
              onPress={() => router.push(`/hub/${item.id}`)}
            >
              <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center mr-3">
                <Folder size={20} colorClassName="text-primary" />
              </View>
              <View className="flex-1">
                <Text className="text-foreground font-semibold text-lg">{item.name}</Text>
                <Text className="text-muted text-xs mt-1">
                  {t('hubs.created', { date: new Date(item.created_at).toLocaleDateString() })}
                </Text>
              </View>

              <Pressable className="p-2 mr-2" onPress={() => deleteHub.mutate(item.id)}>
                <Trash2 size={20} colorClassName="text-danger" />
              </Pressable>

              <ChevronRight size={20} colorClassName="text-muted" />
            </Pressable>
          )}
          ListEmptyComponent={
            <View className="items-center justify-center py-20">
              <Folder size={48} colorClassName="text-muted mb-4" opacity={0.5} />
              <Text className="text-muted text-base text-center">{t('hubs.empty')}</Text>
            </View>
          }
        />
      )}
    </View>
  );
}
