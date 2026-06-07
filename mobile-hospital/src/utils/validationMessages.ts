import i18n from '@/i18n';

const REQUIRED_MESSAGE_BY_FIELD: Record<string, string> = {
  emailid: 'auth.emailRequired',
  email: 'auth.emailRequired',
  password: 'auth.passwordRequired'
};

/** True when the server joined field-level validation segments (e.g. `emailId: EmailId is required`). */
export function looksLikeServerFieldValidation(message: string): boolean {
  const text = message.trim();
  if (!text) return false;
  if (/is required/i.test(text) && /[:;]/.test(text)) return true;
  return /^[\w.]+:\s*.+(\s*;\s*[\w.]+:\s*.+)*$/i.test(text);
}

/** Maps backend validation copy to localized, user-facing messages. */
export function humanizeServerValidationMessage(message: string): string {
  const text = message.trim();
  if (!text) return i18n.t('validation.checkFields');

  const segments = text.split(';').map((segment) => segment.trim()).filter(Boolean);
  const friendly = new Set<string>();

  for (const segment of segments) {
    const colon = segment.indexOf(':');
    const field = colon >= 0 ? segment.slice(0, colon).trim().toLowerCase() : '';
    const body = colon >= 0 ? segment.slice(colon + 1).trim() : segment;
    const requiredKey = REQUIRED_MESSAGE_BY_FIELD[field];

    if (requiredKey && /required/i.test(body)) {
      friendly.add(i18n.t(requiredKey));
      continue;
    }
    if (/^emailid is required$/i.test(body)) {
      friendly.add(i18n.t('auth.emailRequired'));
      continue;
    }
    if (/^password is required$/i.test(body)) {
      friendly.add(i18n.t('auth.passwordRequired'));
      continue;
    }
    friendly.add(body.replace(/EmailId/gi, i18n.t('auth.email')).replace(/Password/gi, i18n.t('auth.password')));
  }

  if (friendly.size > 0) return [...friendly].join(' ');
  return i18n.t('validation.checkFields');
}

export function validateLoginForm(email: string, password: string): string | null {
  const hasEmail = Boolean(email.trim());
  const hasPassword = Boolean(password.trim());
  if (!hasEmail && !hasPassword) return i18n.t('auth.emailAndPasswordRequired');
  if (!hasEmail) return i18n.t('auth.emailRequired');
  if (!hasPassword) return i18n.t('auth.passwordRequired');
  return null;
}
