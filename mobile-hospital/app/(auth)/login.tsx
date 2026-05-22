import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandHeader } from '@/components/BrandHeader';
import { getLoginErrorMessage, loginWithPassword } from '@/features/auth/api';
import { colors } from '@/theme/colors';
import { sharedStyles } from '@/theme/styles';

export default function LoginScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError('');
    setLoading(true);
    try {
      await loginWithPassword(email, password);
      router.replace('/(app)/(tabs)/home' as never);
    } catch (err) {
      setError(getLoginErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[sharedStyles.screen, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, flexGrow: 1, justifyContent: 'center', paddingVertical: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <BrandHeader subtitle={t('auth.loginTitle')} />

        <Text style={sharedStyles.label}>{t('auth.email')}</Text>
        <TextInput
          style={sharedStyles.input}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="username"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor={colors.textMuted}
        />

        <Text style={[sharedStyles.label, { marginTop: 16 }]}>{t('auth.password')}</Text>
        <TextInput
          style={sharedStyles.input}
          secureTextEntry
          textContentType="password"
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          placeholderTextColor={colors.textMuted}
        />

        {error ? <Text style={sharedStyles.errorText}>{error}</Text> : null}

        <Pressable
          style={[sharedStyles.button, { marginTop: 24, opacity: loading ? 0.7 : 1 }]}
          onPress={() => void onSubmit()}
          disabled={loading}
        >
          <Text style={sharedStyles.buttonText}>{loading ? t('auth.signingIn') : t('auth.signIn')}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
