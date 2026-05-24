import {
  appointmentEndCallPath,
  appointmentJoinCallPath,
  appointmentRenewTokenPath,
  parseVideoSessionPayload,
  unwrapEnvelope,
  type VideoSessionPayload
} from '@saas-builder/hospital-api-client';

import { apiClient } from '@/api/client';
import { extractApiErrorMessage } from '@/api/extractApiErrorMessage';

export async function joinAppointmentCall(appointmentId: string): Promise<VideoSessionPayload> {
  try {
    const response = await apiClient.post(appointmentJoinCallPath(appointmentId));
    const data = unwrapEnvelope<unknown>(response.data);
    const session = parseVideoSessionPayload(data);
    if (!session) {
      throw new Error('Invalid video session response');
    }
    return session;
  } catch (err) {
    throw new Error(extractApiErrorMessage(err, 'Could not join the video call'));
  }
}

export async function renewAppointmentCallToken(appointmentId: string): Promise<string> {
  const response = await apiClient.post(appointmentRenewTokenPath(appointmentId));
  const data = unwrapEnvelope<unknown>(response.data);
  const session = parseVideoSessionPayload(data);
  return session?.token ?? '';
}

export async function endAppointmentCall(appointmentId: string): Promise<void> {
  await apiClient.post(appointmentEndCallPath(appointmentId));
}
