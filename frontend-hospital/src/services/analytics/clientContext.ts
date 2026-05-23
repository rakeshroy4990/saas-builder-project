const DEVICE_ID_STORAGE_KEY = 'flexshell_telemetry_device_id';

export type ClientContextPayload = {
  os?: string;
  device_id?: string;
  browser_or_app?: string;
};

function detectOs(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (ua.includes('android')) return 'Android';
  if (ua.includes('iphone') || ua.includes('ipad')) return 'iOS';
  if (ua.includes('mac os') || ua.includes('macintosh')) return 'macOS';
  if (ua.includes('windows')) return 'Windows';
  if (ua.includes('linux')) return 'Linux';
  return 'Unknown';
}

function detectBrowser(userAgent: string): string {
  const ua = userAgent;
  if (/Edg\//i.test(ua)) {
    const m = ua.match(/Edg\/([\d.]+)/);
    return `Edge ${m?.[1] ?? ''}`.trim();
  }
  if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) {
    const m = ua.match(/Chrome\/([\d.]+)/);
    return `Chrome ${m?.[1] ?? ''}`.trim();
  }
  if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) {
    const m = ua.match(/Version\/([\d.]+)/);
    return `Safari ${m?.[1] ?? ''}`.trim();
  }
  if (/Firefox\//i.test(ua)) {
    const m = ua.match(/Firefox\/([\d.]+)/);
    return `Firefox ${m?.[1] ?? ''}`.trim();
  }
  return 'Browser';
}

function getOrCreateDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_ID_STORAGE_KEY)?.trim();
    if (existing) return existing;
    const next =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `web-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, next);
    return next;
  } catch {
    return '';
  }
}

/** Client environment sent on every session_telemetry ingest (web). */
export function getClientContext(): ClientContextPayload {
  if (typeof navigator === 'undefined') {
    return { browser_or_app: 'frontend-hospital' };
  }
  const ua = navigator.userAgent ?? '';
  return {
    os: detectOs(ua),
    device_id: getOrCreateDeviceId(),
    browser_or_app: `frontend-hospital/${detectBrowser(ua)}`
  };
}
