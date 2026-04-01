import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();

  async function signInWithEmail() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      Alert.alert(t('auth.signInFailed'), error.message);
    }
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-background"
    >
      <View className="flex-1 justify-center px-6">
        <Text className="text-3xl font-bold text-foreground mb-2">{t('auth.appTitle')}</Text>
        <Text className="text-muted mb-8">{t('auth.appSubtitle')}</Text>

        <View className="gap-4">
          <View>
            <Text className="text-sm font-medium text-foreground-secondary mb-1">
              {t('auth.emailLabel')}
            </Text>
            <TextInput
              className="border border-border rounded-lg bg-card px-4 py-3 text-foreground"
              onChangeText={setEmail}
              value={email}
              placeholder={t('auth.emailPlaceholder')}
              placeholderTextColorClassName="accent-muted"
              autoCapitalize="none"
              keyboardType="email-address"
              cursorColorClassName="accent-primary"
            />
          </View>

          <View>
            <Text className="text-sm font-medium text-foreground-secondary mb-1">
              {t('auth.passwordLabel')}
            </Text>
            <TextInput
              className="border border-border rounded-lg bg-card px-4 py-3 text-foreground"
              onChangeText={setPassword}
              value={password}
              secureTextEntry
              placeholder={t('auth.passwordPlaceholder')}
              placeholderTextColorClassName="accent-muted"
              autoCapitalize="none"
              cursorColorClassName="accent-primary"
            />
          </View>

          <Pressable
            className={`mt-4 rounded-lg px-4 py-3 items-center justify-center ${
              loading ? 'bg-primary/50' : 'bg-primary active:bg-primary/90'
            }`}
            disabled={loading}
            onPress={signInWithEmail}
          >
            <Text className="text-white font-semibold text-base">
              {loading ? t('common.loading') : t('auth.signIn')}
            </Text>
          </Pressable>

          <View className="flex-row justify-center mt-4">
            <Text className="text-muted">{t('auth.noAccount')}</Text>
            <Link href="/(auth)/signup" asChild>
              <Pressable>
                <Text className="text-primary font-semibold">{t('auth.signUp')}</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
