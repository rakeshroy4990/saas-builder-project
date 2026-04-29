const POST_LOGIN_ACTION_KEY = 'hospital-post-login-action';

export type DeferredPostLoginAction = {
  packageName: string;
  actionId: string;
  data?: Record<string, unknown>;
};

export function setDeferredPostLoginAction(action: DeferredPostLoginAction): void {
  sessionStorage.setItem(POST_LOGIN_ACTION_KEY, JSON.stringify(action));
}

export function consumeDeferredPostLoginAction(): DeferredPostLoginAction | null {
  const raw = sessionStorage.getItem(POST_LOGIN_ACTION_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(POST_LOGIN_ACTION_KEY);
  try {
    const parsed = JSON.parse(raw) as DeferredPostLoginAction;
    if (!parsed?.packageName || !parsed?.actionId) return null;
    return parsed;
  } catch {
    return null;
  }
}
