export type IceServer = RTCIceServer;

/** Default STUN-only list (no relay). Cross-NAT video usually needs TURN — set `VITE_ICE_SERVERS_JSON`. */
const defaultStunOnly: IceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }
];

function expandIceUrls(urls: string | string[] | undefined): string[] {
  if (urls == null) return [];
  return Array.isArray(urls) ? urls : [urls];
}

export function iceServerListHasTurn(servers: RTCIceServer[]): boolean {
  for (const s of servers) {
    for (const u of expandIceUrls(s.urls)) {
      const z = u.toLowerCase();
      if (z.startsWith('turn:') || z.startsWith('turns:')) return true;
    }
  }
  return false;
}

export function getIceServersFromEnv(env: Record<string, unknown>): IceServer[] {
  const raw = env.VITE_ICE_SERVERS_JSON;
  if (!raw) {
    return defaultStunOnly;
  }
  try {
    const parsed = JSON.parse(String(raw)) as unknown;
    if (!Array.isArray(parsed)) return defaultStunOnly;
    return parsed as IceServer[];
  } catch {
    return defaultStunOnly;
  }
}

