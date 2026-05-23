import { Alert } from 'react-native';

import { useSessionStore } from '@/auth/sessionStore';

import type { AppointmentSummary } from '../appointments/types';
import { useVideoCallStore } from './videoCallStore';

export type OpenVideoCallResult =
  | { ok: true }
  | { ok: false; message: string };

export function openAppointmentVideoCall(appointment: AppointmentSummary): OpenVideoCallResult {
  const session = useSessionStore.getState().user;
  if (!session) {
    return { ok: false, message: 'Sign in to start a video call.' };
  }

  const doctorId = appointment.doctorId.trim();
  const appointmentId = appointment.id.trim();
  const createdBy = appointment.createdBy.trim();
  const myUserId = session.userId.trim();
  const role = session.role.trim().toUpperCase();
  const isAssignedDoctor = Boolean(myUserId && doctorId && myUserId === doctorId);
  const doctorOrAdminCallsPatient = role === 'ADMIN' || isAssignedDoctor;

  if (role === 'DOCTOR' && !isAssignedDoctor) {
    return {
      ok: false,
      message: 'Video call is only available for appointments where you are the assigned doctor.'
    };
  }

  let inviteToUserId = '';

  if (doctorOrAdminCallsPatient) {
    if (!createdBy) {
      return {
        ok: false,
        message: 'This appointment has no patient account linked. Cannot place the call.'
      };
    }
    if (myUserId && createdBy === myUserId) {
      return { ok: false, message: 'You cannot call yourself.' };
    }
    inviteToUserId = createdBy;
  } else {
    if (!doctorId) {
      return { ok: false, message: 'This appointment has no doctor assigned for a video call.' };
    }
    if (role === 'PATIENT' && createdBy && myUserId && createdBy !== myUserId) {
      return { ok: false, message: 'You can only start a video call for your own appointments.' };
    }
    if (myUserId && doctorId === myUserId) {
      return { ok: false, message: 'Sign in as the assigned doctor or patient to start this call.' };
    }
    inviteToUserId = doctorId;
  }

  if (!inviteToUserId) {
    return { ok: false, message: 'Could not determine who to call for this appointment.' };
  }

  let remotePartyName: string;
  if (doctorOrAdminCallsPatient) {
    remotePartyName = appointment.patientName || 'Patient';
  } else {
    const docNorm = appointment.doctorName.toLowerCase();
    const myLabels = [session.displayName, session.email].filter(Boolean);
    const myLabelNorms = myLabels.map((s) => s.toLowerCase());
    const docMatchesCaller = Boolean(
      docNorm &&
        myLabelNorms.some(
          (n) =>
            n === docNorm ||
            (n.includes('@') && docNorm === n.split('@')[0]) ||
            (docNorm.includes('@') && n === docNorm.split('@')[0])
        )
    );
    const doctorLooksWrong = !appointment.doctorName || docMatchesCaller;
    remotePartyName = doctorLooksWrong
      ? appointment.department
        ? `Doctor (${appointment.department})`
        : 'Doctor'
      : appointment.doctorName;
  }

  useVideoCallStore.getState().patch({
    inviteToUserId,
    inviteAppointmentId: appointmentId,
    remotePartyName,
    lastSignalType: '',
    callId: '',
    fromUserId: '',
    toUserId: '',
    videoSessionPeerUserId: '',
    webrtcCalleeAccepted: false,
    videoCallOutgoingInvite: true,
    videoSession: undefined,
    incomingRing: false
  });

  return { ok: true };
}

export function showOpenVideoCallError(message: string): void {
  Alert.alert('Video call', message);
}
