import { joinAppointmentCall } from './api';
import { useVideoCallStore } from './videoCallStore';

export async function prepareVideoSession(): Promise<void> {
  const call = useVideoCallStore.getState();
  const appointmentId = String(call.inviteAppointmentId ?? '').trim();
  if (!appointmentId) {
    throw new Error('Appointment id is missing for this video call');
  }
  const session = await joinAppointmentCall(appointmentId);
  useVideoCallStore.getState().patch({ videoSession: session });
}

export function hasJoinableVideoSession(): boolean {
  const vs = useVideoCallStore.getState().videoSession;
  if (!vs) return false;
  return Boolean(vs.token && vs.roomId && vs.appId && Number.isFinite(vs.uid) && vs.uid !== 0);
}
