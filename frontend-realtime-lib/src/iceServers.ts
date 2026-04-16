export type IceServer = RTCIceServer;

export function getIceServersFromEnv(env: Record<string, unknown>): IceServer[] {
  const raw = env.VITE_ICE_SERVERS_JSON;
  if (!raw) {
    return [{ urls: ['stun:stun.l.google.com:19302'] }];
  }
  try {
    const parsed = JSON.parse(String(raw)) as unknown;
    if (!Array.isArray(parsed)) return [{ urls: ['stun:stun.l.google.com:19302'] }];
    return parsed as IceServer[];
  } catch {
    return [{ urls: ['stun:stun.l.google.com:19302'] }];
  }
}

