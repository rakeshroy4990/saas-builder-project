import {
  createDefaultDashboardFilters,
  DASHBOARD_STATUS_ALL,
  filterDashboardAppointments,
  isIsoDateString,
  normalizeStatusFilterValue
} from '@/features/appointments/dashboardFilters';
import type { AppointmentSummary } from '@/features/appointments/types';

function row(partial: Partial<AppointmentSummary>): AppointmentSummary {
  return {
    id: '1',
    patientName: 'Patient',
    doctorName: 'Doctor',
    preferredDate: '2099-01-15',
    preferredTimeSlot: '10:00-11:00',
    status: 'CONFIRMED',
    department: 'CARDIO',
    doctorId: 'doc-1',
    createdBy: 'user-1',
    canStartVideoCall: false,
    ...partial
  };
}

describe('dashboardFilters', () => {
  it('normalizes all-status values', () => {
    expect(normalizeStatusFilterValue('')).toBe(DASHBOARD_STATUS_ALL);
    expect(normalizeStatusFilterValue('all appointments')).toBe(DASHBOARD_STATUS_ALL);
    expect(normalizeStatusFilterValue('COMPLETED')).toBe('COMPLETED');
  });

  it('validates iso dates', () => {
    expect(isIsoDateString('2026-05-01')).toBe(true);
    expect(isIsoDateString('05-01-2026')).toBe(false);
  });

  it('defaults admin to full listing', () => {
    expect(createDefaultDashboardFilters('ADMIN').adminFullListing).toBe(true);
    expect(createDefaultDashboardFilters('DOCTOR').adminFullListing).toBe(false);
  });

  it('filters by status, date, doctor, and department', () => {
    const list = [
      row({ id: 'a', status: 'COMPLETED', preferredDate: '2026-05-01', doctorId: 'doc-1', department: 'CARDIO' }),
      row({ id: 'b', status: 'CANCELLED', preferredDate: '2026-05-02', doctorId: 'doc-2', department: 'NEURO' })
    ];
    const base = createDefaultDashboardFilters('ADMIN');

    expect(
      filterDashboardAppointments(list, {
        ...base,
        status: 'COMPLETED',
        statusSelectedExplicitly: true
      })
    ).toHaveLength(1);

    expect(
      filterDashboardAppointments(list, {
        ...base,
        preferredDate: '2026-05-02'
      })
    ).toHaveLength(1);

    expect(
      filterDashboardAppointments(list, {
        ...base,
        doctorId: 'doc-2'
      })
    ).toHaveLength(1);

    expect(
      filterDashboardAppointments(list, {
        ...base,
        department: 'neuro'
      })
    ).toHaveLength(1);
  });

  it('hides past appointments for non-admin default state', () => {
    const list = [
      row({ id: 'past', preferredDate: '2000-01-01', preferredTimeSlot: '10:00-11:00' }),
      row({ id: 'future', preferredDate: '2099-01-01', preferredTimeSlot: '10:00-11:00' })
    ];
    const filtered = filterDashboardAppointments(list, createDefaultDashboardFilters('DOCTOR'));
    expect(filtered.map((item) => item.id)).toEqual(['future']);
  });
});
