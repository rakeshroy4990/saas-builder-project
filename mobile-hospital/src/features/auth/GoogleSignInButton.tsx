import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text } from 'react-native';

import { sharedStyles } from '@/theme/styles';

import { isGoogleOAuthConfigured } from '@/config/env';

import { getOrCreateTraceId, ingestSessionTelemetry } from '@/analytics/sessionTelemetry';

import { completeGoogleSignIn, useGoogleAuthRequest } from './googleLogin';
import { getGoogleSignInSetupLines } from './googleSetupHint';

function formatGoogleError(base: string): string {
  return `${base}\n\n${getGoogleSignInSetupLines().join('\n')}`;
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

/** Isolated so Google hooks run only when OAuth client IDs are configured. */
function GoogleSignInButtonInner({
  email,
  loading,
  googleLoading,
  setGoogleLoading,
  setError,
  onSuccess,
  getLoginErrorMessage
}: GoogleSignInButtonProps) {
  const { t } = useTranslation();
  const [request, response, promptGoogle] = useGoogleAuthRequest();

  useEffect(() => {
    if (!response) return;
    if (response.type === 'error') {
      setGoogleLoading(false);
      const detail = String(response.error?.message ?? response.params?.error_description ?? '').trim();
      void ingestSessionTelemetry({
        event_name: 'google_sign_in_failed',
        flow: 'auth',
        status: 'fail',
        reason_code: 'google_oauth_error',
        trace_id: getOrCreateTraceId()
      });
      setError(formatGoogleError(detail || t('auth.googleFailed')));
      return;
    }
    if (response.type !== 'success') return;
    const token = response.authentication?.accessToken;
    if (!token) return;
    (async () => {
      setGoogleLoading(true);
      setError('');
      try {
        await completeGoogleSignIn(token, email.trim() || 'google-user');
        onSuccess();
      } catch (err) {
        setError(getLoginErrorMessage(err));
      } finally {
        setGoogleLoading(false);
      }
    })();
  }, [response, email, onSuccess, setError, setGoogleLoading, getLoginErrorMessage, t]);

  async function onGoogle() {
    setError('');
    setGoogleLoading(true);
    try {
      const result = await promptGoogle();
      if (result?.type === 'success' && result.authentication?.accessToken) {
        await completeGoogleSignIn(result.authentication.accessToken, email.trim() || 'google-user');
        onSuccess();
        return;
      }
      if (result?.type === 'error') {
        const detail = String(result.error?.message ?? result.params?.error_description ?? '').trim();
        void ingestSessionTelemetry({
          event_name: 'google_sign_in_failed',
          flow: 'auth',
          status: 'fail',
          reason_code: 'google_oauth_error',
          trace_id: getOrCreateTraceId()
        });
        setError(formatGoogleError(detail || t('auth.googleFailed')));
      }
    } catch (err) {
      void ingestSessionTelemetry({
        event_name: 'google_sign_in_failed',
        flow: 'auth',
        status: 'fail',
        reason_code: 'google_oauth_error',
        trace_id: getOrCreateTraceId()
      });
      setError(formatGoogleError(err instanceof Error ? err.message : t('auth.googleFailed')));
    } finally {
      setGoogleLoading(false);
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

export function GoogleSignInButton(props: GoogleSignInButtonProps) {
  if (!isGoogleOAuthConfigured()) return null;
  return <GoogleSignInButtonInner {...props} />;
}
