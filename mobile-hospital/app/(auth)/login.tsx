import { Redirect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
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
import { AuthBusyOverlay } from '@/components/AuthBusyOverlay';
import { getLoginErrorMessage, loginWithPassword } from '@/features/auth/api';
import { GoogleSignInButton } from '@/features/auth/GoogleSignInButton';
import { ensureGoogleSignInConfigured, isGoogleSignInConfigured } from '@/features/auth/googleLogin';
import { useSessionStore } from '@/auth/sessionStore';
import { colors } from '@/theme/colors';
import { sharedStyles } from '@/theme/styles';

export default function LoginScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const enterGuestMode = useSessionStore((s) => s.enterGuestMode);
  const accessToken = useSessionStore((s) => s.accessToken);
  const sessionRestoreInFlight = useSessionStore((s) => s.sessionRestoreInFlight);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const googleConfigured = isGoogleSignInConfigured();
  const authBusy = loading || googleLoading;

  useEffect(() => {
    if (googleConfigured && Platform.OS !== 'web') {
      ensureGoogleSignInConfigured();
    }
  }, [googleConfigured]);

  const onGoogleSuccess = useCallback(() => {
    router.replace('/(app)/(tabs)/home' as never);
  }, [router]);

  if (accessToken) {
    return <Redirect href={'/(app)/(tabs)/home' as never} />;
  }

  async function onSubmit() {
    setError('');
    setLoading(true);
    try {
      await loginWithPassword(email, password);
      router.replace('/(app)/(tabs)/home' as never);
    } catch (err) {
      setLoading(false);
      setError(getLoginErrorMessage(err));
    }
  }

  function onSkip() {
    if (authBusy) return;
    enterGuestMode();
    router.replace('/(app)/(tabs)/home' as never);
  }

  const busyMessage = googleLoading ? t('auth.googleSigningIn') : t('auth.signingIn');

  return (
    <KeyboardAvoidingView
      style={[sharedStyles.screen, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, flexGrow: 1, justifyContent: 'center', paddingVertical: 24 }}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={!authBusy}
      >
        <BrandHeader subtitle={t('auth.loginTitle')} />

        {sessionRestoreInFlight ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <ActivityIndicator color={colors.primary} />
            <Text style={{ color: colors.textMuted, fontSize: 15 }}>{t('auth.restoringSession')}</Text>
          </View>
        ) : null}

        <Text style={sharedStyles.label}>{t('auth.email')}</Text>
        <TextInput
          style={[sharedStyles.input, authBusy && { opacity: 0.5 }]}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="username"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor={colors.textMuted}
          editable={!authBusy}
        />

        <Text style={[sharedStyles.label, { marginTop: 16 }]}>{t('auth.password')}</Text>
        <TextInput
          style={[sharedStyles.input, authBusy && { opacity: 0.5 }]}
          secureTextEntry
          textContentType="password"
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          placeholderTextColor={colors.textMuted}
          editable={!authBusy}
        />

        {error ? (
          <Text style={[sharedStyles.errorText, { lineHeight: 20 }]} selectable>
            {error}
          </Text>
        ) : null}

        <Pressable
          style={[sharedStyles.button, { marginTop: 24, opacity: authBusy ? 0.5 : 1 }]}
          onPress={() => void onSubmit()}
          disabled={authBusy}
        >
          <Text style={sharedStyles.buttonText}>{loading ? t('auth.signingIn') : t('auth.signIn')}</Text>
        </Pressable>

        {googleConfigured ? (
          <GoogleSignInButton
            email={email}
            loading={loading}
            googleLoading={googleLoading}
            setGoogleLoading={setGoogleLoading}
            setError={setError}
            onSuccess={onGoogleSuccess}
            getLoginErrorMessage={getLoginErrorMessage}
          />
        ) : null}

        <Pressable
          style={{ marginTop: 20, alignItems: 'center', opacity: authBusy ? 0.4 : 1 }}
          onPress={onSkip}
          disabled={authBusy}
        >
          <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '600' }}>{t('auth.skipForNow')}</Text>
        </Pressable>
      </ScrollView>

      {authBusy ? <AuthBusyOverlay message={busyMessage} /> : null}
    </KeyboardAvoidingView>
  );
}
