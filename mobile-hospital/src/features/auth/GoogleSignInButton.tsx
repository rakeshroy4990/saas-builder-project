import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, Text } from 'react-native';

import { sharedStyles } from '@/theme/styles';

import { isGoogleOAuthConfigured } from '@/config/env';

import { cancelPendingTokenRefresh } from '@/api/client';
import { useSessionStore } from '@/auth/sessionStore';
import { getOrCreateTraceId, ingestSessionTelemetry } from '@/analytics/sessionTelemetry';

import {
  completeGoogleSignIn,
  isGoogleWebAuthAvailable,
  signInWithGoogle,
  useGoogleWebAuthRequest
} from './googleLogin';
import { getGoogleSignInSetupLines } from './googleSetupHint';

function formatGoogleError(base: string): string {
  const headline = base.trim() || 'Google sign-in failed';
  return `${headline}\n\n${getGoogleSignInSetupLines(headline).join('\n')}`;
}

type GoogleSignInButtonProps = {
  email: string;
  loading: boolean;
  googleLoading: boolean;
  setGoogleLoading: (value: boolean) => void;
  setError: (message: string) => void;
  onSuccess: () => void;
  getLoginErrorMessage: (error: unknown) => string;
};

function recordGoogleFailure() {
  void ingestSessionTelemetry({
    event_name: 'google_sign_in_failed',
    flow: 'auth',
    status: 'fail',
    reason_code: 'google_oauth_error',
    trace_id: getOrCreateTraceId()
  });
}

/** Web-only OAuth hook branch (native Android/iOS use Google Play Services / Sign in with Apple style SDK). */
function GoogleSignInButtonWeb({
  email,
  loading,
  googleLoading,
  setGoogleLoading,
  setError,
  onSuccess,
  getLoginErrorMessage
}: GoogleSignInButtonProps) {
  const { t } = useTranslation();
  const [request, response, promptGoogle] = useGoogleWebAuthRequest();

  useEffect(() => {
    if (!response) return;
    if (response.type === 'error') {
      setGoogleLoading(false);
      recordGoogleFailure();
      const detail = String(response.error?.message ?? response.params?.error_description ?? '').trim();
      setError(formatGoogleError(detail || t('auth.googleFailed')));
      return;
    }
    if (response.type === 'dismiss' || response.type === 'cancel') {
      setGoogleLoading(false);
      return;
    }
    if (response.type !== 'success') {
      setGoogleLoading(false);
      return;
    }
    const token = response.authentication?.accessToken;
    if (!token) return;
    (async () => {
      setGoogleLoading(true);
      setError('');
      try {
        await completeGoogleSignIn(token, email.trim() || 'google-user');
        setGoogleLoading(false);
        onSuccess();
      } catch (err) {
        setGoogleLoading(false);
        setError(getLoginErrorMessage(err));
      }
    })();
  }, [response, email, onSuccess, setError, setGoogleLoading, getLoginErrorMessage, t]);

  async function onGoogle() {
    setError('');
    cancelPendingTokenRefresh();
    useSessionStore.getState().setSessionRestoreInFlight(false);
    setGoogleLoading(true);
    try {
      const result = await promptGoogle();
      if (result?.type === 'success' && result.authentication?.accessToken) {
        await completeGoogleSignIn(result.authentication.accessToken, email.trim() || 'google-user');
        setGoogleLoading(false);
        onSuccess();
        return;
      }
      setGoogleLoading(false);
      if (result?.type === 'error') {
        recordGoogleFailure();
        const detail = String(result.error?.message ?? result.params?.error_description ?? '').trim();
        setError(formatGoogleError(detail || t('auth.googleFailed')));
      }
    } catch (err) {
      setGoogleLoading(false);
      recordGoogleFailure();
      setError(formatGoogleError(err instanceof Error ? err.message : t('auth.googleFailed')));
    }
  }

  return (
    <Pressable
      style={[sharedStyles.buttonSecondary, { marginTop: 12, opacity: googleLoading ? 0.7 : 1 }]}
      onPress={() => void onGoogle()}
      disabled={!request || loading || googleLoading}
    >
      <Text style={sharedStyles.buttonSecondaryText}>
        {googleLoading ? t('auth.googleSigningIn') : t('auth.googleSignIn')}
      </Text>
    </Pressable>
  );
}

function GoogleSignInButtonNative(props: GoogleSignInButtonProps) {
  const { t } = useTranslation();
  const { email, loading, googleLoading, setGoogleLoading, setError, onSuccess, getLoginErrorMessage } = props;

  async function onGoogle() {
    setError('');
    cancelPendingTokenRefresh();
    useSessionStore.getState().setSessionRestoreInFlight(false);
    setGoogleLoading(true);
    try {
      const token = await signInWithGoogle();
      await completeGoogleSignIn(token, email.trim() || 'google-user');
      setGoogleLoading(false);
      onSuccess();
    } catch (err) {
      setGoogleLoading(false);
      const msg = err instanceof Error ? err.message.trim() : '';
      if (msg && !/cancel/i.test(msg)) {
        recordGoogleFailure();
      }
      setError(formatGoogleError(msg || getLoginErrorMessage(err)));
    }
  }

  return (
    <Pressable
      style={[sharedStyles.buttonSecondary, { marginTop: 12, opacity: googleLoading ? 0.7 : 1 }]}
      onPress={() => void onGoogle()}
      disabled={loading || googleLoading}
    >
      <Text style={sharedStyles.buttonSecondaryText}>
        {googleLoading ? t('auth.googleSigningIn') : t('auth.googleSignIn')}
      </Text>
    </Pressable>
  );
}

export function GoogleSignInButton(props: GoogleSignInButtonProps) {
  if (!isGoogleOAuthConfigured()) return null;
  if (isGoogleWebAuthAvailable() && Platform.OS === 'web') {
    return <GoogleSignInButtonWeb {...props} />;
  }
  return <GoogleSignInButtonNative {...props} />;
}
