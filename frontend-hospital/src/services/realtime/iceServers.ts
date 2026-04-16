import { getIceServersFromEnv } from '@realtime/iceServers';

export type IceServer = RTCIceServer;

export function getIceServers(): IceServer[] {
  return getIceServersFromEnv(import.meta.env as Record<string, unknown>);
}

