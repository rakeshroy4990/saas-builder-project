const LOGIN_SESSION_STORAGE_KEY = 'flexshell-login-session-id';

function newLoginSessionId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `ls-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Mint a new id at the start of each successful login; sent on telemetry so Mongo session_telemetry rows stay scoped per login. */
export function mintLoginSessionId(): string {
  const id = newLoginSessionId();
  try {
    sessionStorage.setItem(LOGIN_SESSION_STORAGE_KEY, id);
  } catch {
    // non-fatal
  }
  return id;
}

export function readLoginSessionId(): string {
  try {
    return String(sessionStorage.getItem(LOGIN_SESSION_STORAGE_KEY) ?? '').trim();
  } catch {
    return '';
  }
}

export function clearLoginSessionId(): void {
  try {
    sessionStorage.removeItem(LOGIN_SESSION_STORAGE_KEY);
  } catch {
    // non-fatal
  }
}
