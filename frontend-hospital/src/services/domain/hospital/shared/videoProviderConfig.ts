export type HospitalVideoProviderId = 'builtin' | 'agora' | '100ms' | 'twilio';

/**
 * Must stay aligned with server `app.video.provider` for token minting and STOMP media gating.
 */
export function getHospitalVideoProviderFromEnv(): HospitalVideoProviderId {
  const v = String(import.meta.env.VITE_VIDEO_PROVIDER ?? 'builtin').trim().toLowerCase();
  if (v === 'agora') return 'agora';
  if (v === '100ms' || v === 'hms') return '100ms';
  if (v === 'twilio') return 'twilio';
  return 'builtin';
}

export function isBuiltinHospitalVideo(): boolean {
  return getHospitalVideoProviderFromEnv() === 'builtin';
}
