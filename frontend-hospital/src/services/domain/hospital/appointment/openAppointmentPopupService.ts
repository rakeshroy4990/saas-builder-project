import type { Composer } from 'vue-i18n';
import type { ServiceDefinition } from '../../../../core/types/ServiceDefinition';
import { useAppStore } from '../../../../store/useAppStore';
import { usePopupStore } from '../../../../store/usePopupStore';
import { pinia } from '../../../../store/pinia';
import { i18n } from '../../../../i18n';
import { ok } from '../shared/response';
import { clearAppointmentPrescriptionFiles } from '../shared/appointmentPrescriptionFiles';
import { ensureMedicalDepartmentOptionsLoaded, syncAppointmentDepartmentsFromMedicalStore } from '../shared/medicalDepartments';
import { fetchBookingFormContext } from '../shared/appointmentBookingApi';
import { refreshAppointmentTimeSlotOptionsFromForm } from '../shared/refreshAppointmentTimeSlots';
import { setDeferredPostLoginAction } from '../auth/postLoginAction';
import { pickString } from '../shared/strings';
import { APPOINTMENT_SLOT_LOOKAHEAD_DAYS } from '../shared/appointmentAvailabilityConfig';
import { APPOINTMENT_DOCTOR_CACHE_KEY } from '../shared/constants';
import { normalizeDepartmentKey } from '../shared/doctorCatalog';

const tr = (key: string): string => (i18n.global as Composer).t(key);

function seedPreselectedDoctorOption(
  doctorId: string,
  doctorName: string,
  doctorDegree: string
): void {
  const label = [doctorName, doctorDegree ? `(${doctorDegree})` : ''].filter(Boolean).join(' ').trim();
  if (!doctorId || !label) return;
  useAppStore(pinia).setData('hospital', 'AppointmentDoctors', {
    list: [{ id: doctorId, label, value: doctorId }]
  });
}

function setImmediatePreselection(department: string, doctorId: string): void {
  const appStore = useAppStore(pinia);
  appStore.setProperty('hospital', 'AppointmentForm', 'department', department);
  appStore.setProperty('hospital', 'AppointmentForm', 'doctor', doctorId);
  appStore.setProperty('hospital', 'AppointmentForm', 'preferredDate', '');
  appStore.setProperty('hospital', 'AppointmentForm', 'preferredTimeSlot', '');
  appStore.setProperty('hospital', 'AppointmentForm', 'doctorLoadError', '');
  appStore.setProperty('hospital', 'AppointmentForm', 'slotAvailabilityMessage', '');
}

function cacheDoctorsForDepartment(department: string, doctors: Array<{ id: string; label: string; value: string }>): void {
  const normalizedKey = normalizeDepartmentKey(department);
  if (!normalizedKey || doctors.length === 0) return;
  const appStore = useAppStore(pinia);
  const existingCatalog = (appStore.getData('hospital', 'AppointmentDoctorCatalog') ?? {}) as Record<string, unknown>;
  const byDepartment = { ...((existingCatalog.byDepartment as Record<string, unknown>) ?? {}), [normalizedKey]: doctors };
  appStore.setData('hospital', 'AppointmentDoctorCatalog', { byDepartment });
  sessionStorage.setItem(APPOINTMENT_DOCTOR_CACHE_KEY, JSON.stringify(byDepartment));
}

async function applyAppointmentDoctorPreselection(
  department: string,
  doctorId: string
): Promise<void> {
  const appStore = useAppStore(pinia);
  const excludeId = pickString(
    (appStore.getData('hospital', 'AppointmentForm') ?? {}) as Record<string, unknown>,
    ['editingAppointmentId']
  ).trim();

  if (!department && !doctorId) {
    appStore.setData('hospital', 'AppointmentDoctors', { list: [] });
    appStore.setData('hospital', 'AppointmentDateAvailability', {
      unavailableDates: [],
      slotCounts: [],
      summaryText: ''
    });
    await refreshAppointmentTimeSlotOptionsFromForm();
    return;
  }

  try {
    const context = await fetchBookingFormContext({
      department: department || undefined,
      doctorId: doctorId || undefined,
      lookaheadDays: APPOINTMENT_SLOT_LOOKAHEAD_DAYS,
      excludeAppointmentId: excludeId || undefined
    });
    if (department && context.doctors.length > 0) {
      appStore.setData('hospital', 'AppointmentDoctors', { list: context.doctors });
      cacheDoctorsForDepartment(department, context.doctors);
    }
    if (doctorId) {
      appStore.setProperty('hospital', 'AppointmentForm', 'doctor', doctorId);
      appStore.setData('hospital', 'AppointmentDateAvailability', context.dateAvailability);
    }
  } catch {
    if (department) {
      appStore.setData('hospital', 'AppointmentDoctors', { list: [] });
      appStore.setProperty('hospital', 'AppointmentForm', 'doctorLoadError', tr('appointment.doctorLoadFailed'));
    }
    if (doctorId) {
      appStore.setData('hospital', 'AppointmentDateAvailability', {
        unavailableDates: [],
        slotCounts: [],
        summaryText: ''
      });
    }
  }

  await refreshAppointmentTimeSlotOptionsFromForm();
}

function queueAppointmentPopupPreparation(department: string, doctorId: string): void {
  void (async () => {
    await ensureMedicalDepartmentOptionsLoaded();
    syncAppointmentDepartmentsFromMedicalStore();
    if (department || doctorId) {
      await applyAppointmentDoctorPreselection(department, doctorId);
    }
  })();
}

function resetAppointmentFormForNewBooking(authSession: Record<string, unknown>): void {
  const appStore = useAppStore(pinia);
  appStore.setProperty('hospital', 'AppointmentForm', 'editingAppointmentId', '');
  appStore.setProperty(
    'hospital',
    'AppointmentForm',
    'patientName',
    String(authSession.fullName ?? authSession.userDisplayName ?? '').trim()
  );
  appStore.setProperty(
    'hospital',
    'AppointmentForm',
    'patientEmail',
    String(authSession.email ?? '').trim()
  );
  appStore.setProperty(
    'hospital',
    'AppointmentForm',
    'patientPhone',
    String(authSession.mobileNumber ?? '').trim()
  );
  appStore.setProperty('hospital', 'AppointmentForm', 'ageGroup', '');
  appStore.setProperty('hospital', 'AppointmentForm', 'additionalNotes', '');
  appStore.setProperty('hospital', 'AppointmentForm', 'prescriptionFileNames', []);
  appStore.setProperty('hospital', 'AppointmentForm', 'prescriptionUploadError', '');
  clearAppointmentPrescriptionFiles();
}

export const openAppointmentPopupHospitalServices: ServiceDefinition[] = [
  {
    packageName: 'hospital',
    serviceId: 'open-appointment-popup',
    execute: async (request) => {
      const doctorId = pickString(request.data ?? {}, ['doctorId', 'DoctorId']).trim();
      const department = pickString(request.data ?? {}, ['department', 'Department']).trim();
      const doctorName = pickString(request.data ?? {}, ['doctorName', 'DoctorName', 'name', 'Name']).trim();
      const doctorDegree = pickString(request.data ?? {}, ['doctorDegree', 'degree', 'Degree']).trim();
      const preselection =
        doctorId || department ? { doctorId, department, doctorName, doctorDegree } : undefined;

      const authSession = (useAppStore(pinia).getData('hospital', 'AuthSession') ?? {}) as Record<
        string,
        unknown
      >;
      const userId = String(authSession.userId ?? '').trim();
      if (!userId) {
        setDeferredPostLoginAction({
          packageName: 'hospital',
          actionId: 'open-appointment-popup',
          ...(preselection ? { data: preselection } : {})
        });
        useAppStore(pinia).setProperty('hospital', 'AuthForm', 'identity', '');
        useAppStore(pinia).setProperty('hospital', 'AuthForm', 'password', '');
        useAppStore(pinia).setProperty('hospital', 'AuthForm', 'emailError', '');
        useAppStore(pinia).setProperty('hospital', 'AuthForm', 'authError', '');
        useAppStore(pinia).setProperty('hospital', 'AuthForm', 'loginInfoMessage', '');
        usePopupStore(pinia).open({ packageName: 'hospital', pageId: 'login-popup', title: 'login' });
        return ok();
      }

      syncAppointmentDepartmentsFromMedicalStore();
      resetAppointmentFormForNewBooking(authSession);

      if (preselection) {
        seedPreselectedDoctorOption(doctorId, doctorName, doctorDegree);
        setImmediatePreselection(department, doctorId);
      } else {
        useAppStore(pinia).setProperty('hospital', 'AppointmentForm', 'department', '');
        useAppStore(pinia).setProperty('hospital', 'AppointmentForm', 'doctor', '');
        useAppStore(pinia).setProperty('hospital', 'AppointmentForm', 'preferredDate', '');
        useAppStore(pinia).setProperty('hospital', 'AppointmentForm', 'preferredTimeSlot', '');
        useAppStore(pinia).setProperty('hospital', 'AppointmentForm', 'doctorLoadError', '');
        useAppStore(pinia).setProperty('hospital', 'AppointmentForm', 'slotAvailabilityMessage', '');
        useAppStore(pinia).setData('hospital', 'AppointmentDoctors', { list: [] });
        useAppStore(pinia).setData('hospital', 'AppointmentTimeSlots', { list: [] });
      }

      usePopupStore(pinia).open({ packageName: 'hospital', pageId: 'appointment-popup', title: 'appointment' });

      if (preselection) {
        queueAppointmentPopupPreparation(department, doctorId);
      } else {
        void ensureMedicalDepartmentOptionsLoaded().then(() => syncAppointmentDepartmentsFromMedicalStore());
      }

      return ok();
    }
  }
];
