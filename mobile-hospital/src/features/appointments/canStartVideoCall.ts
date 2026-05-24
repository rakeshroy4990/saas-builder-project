import type { AppointmentSummary } from './types';
import { isVideoCallableStatus, isWithinVideoCallWindow } from './videoCallWindow';

export function computeCanStartVideoCall(
  appointment: Pick<AppointmentSummary, 'status' | 'preferredDate' | 'preferredTimeSlot'>,
  role: string,
  myUserId: string,
  createdBy: string
): boolean {
  if (!isVideoCallableStatus(appointment.status)) {
    return false;
  }

  const baseCanStartVideoCall = isWithinVideoCallWindow(
    appointment.preferredDate,
    appointment.preferredTimeSlot
  );

  const adminCreatedThisAppointment =
    role === 'ADMIN' &&
    Boolean(myUserId && createdBy && createdBy.toLowerCase() === myUserId.toLowerCase());

  return role === 'ADMIN' ? baseCanStartVideoCall && adminCreatedThisAppointment : baseCanStartVideoCall;
}
