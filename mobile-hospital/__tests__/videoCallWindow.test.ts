import {
  isVideoCallableStatus,
  isWithinVideoCallWindow,
  parseAppointmentSlotWindow
} from '../src/features/appointments/videoCallWindow';
import { computeCanStartVideoCall } from '../src/features/appointments/canStartVideoCall';

describe('videoCallWindow', () => {
  it('parses HH:mm-HH:mm slot in hospital UTC', () => {
    const window = parseAppointmentSlotWindow('2026-05-21', '10:00-10:15', 'UTC');
    expect(window).not.toBeNull();
    expect(window!.endMs - window!.startMs).toBe(15 * 60 * 1000);
  });

  it('allows join inside slot ±10 minutes', () => {
    const window = parseAppointmentSlotWindow('2026-05-21', '10:00-10:15', 'UTC')!;
    expect(isWithinVideoCallWindow('2026-05-21', '10:00-10:15', window.startMs - 9 * 60 * 1000)).toBe(true);
    expect(isWithinVideoCallWindow('2026-05-21', '10:00-10:15', window.endMs + 9 * 60 * 1000)).toBe(true);
    expect(isWithinVideoCallWindow('2026-05-21', '10:00-10:15', window.startMs - 11 * 60 * 1000)).toBe(false);
  });

  it('accepts Open and CONFIRMED only', () => {
    expect(isVideoCallableStatus('Open')).toBe(true);
    expect(isVideoCallableStatus('CONFIRMED')).toBe(true);
    expect(isVideoCallableStatus('SCHEDULED')).toBe(false);
  });
});

describe('computeCanStartVideoCall', () => {
  const appointment = {
    status: 'Open',
    preferredDate: '2026-05-21',
    preferredTimeSlot: '10:00-10:15'
  };

  it('returns false when status is not callable', () => {
    expect(
      computeCanStartVideoCall(
        { ...appointment, status: 'SCHEDULED' },
        'DOCTOR',
        'doc-1',
        'patient-1'
      )
    ).toBe(false);
  });

  it('returns true for doctor during callable window', () => {
    const window = parseAppointmentSlotWindow('2026-05-21', '10:00-10:15', 'UTC')!;
    jest.spyOn(Date, 'now').mockReturnValue(window.startMs);
    expect(computeCanStartVideoCall(appointment, 'DOCTOR', 'doc-1', 'patient-1')).toBe(true);
    jest.restoreAllMocks();
  });
});
