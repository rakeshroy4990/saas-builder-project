import type { ServiceDefinition } from '../../../../core/types/ServiceDefinition';
import { useAppStore } from '../../../../store/useAppStore';
import { usePopupStore } from '../../../../store/usePopupStore';
import { pinia } from '../../../../store/pinia';
import { ok } from '../shared/response';
import { clearAppointmentPrescriptionFiles } from '../shared/appointmentPrescriptionFiles';
import { ensureMedicalDepartmentOptionsLoaded } from '../shared/medicalDepartments';
import { setDeferredPostLoginAction } from '../auth/postLoginAction';
export const openAppointmentPopupHospitalServices: ServiceDefinition[] = [
  {
    packageName: 'hospital',
    serviceId: 'open-appointment-popup',
    execute: async () => {
      const authSession = (useAppStore(pinia).getData('hospital', 'AuthSession') ?? {}) as Record<
        string,
        unknown
      >;
      const userId = String(authSession.userId ?? '').trim();
      if (!userId) {
        setDeferredPostLoginAction({
          packageName: 'hospital',
          actionId: 'open-appointment-popup'
        });
        useAppStore(pinia).setProperty('hospital', 'AuthForm', 'identity', '');
        useAppStore(pinia).setProperty('hospital', 'AuthForm', 'password', '');
        useAppStore(pinia).setProperty('hospital', 'AuthForm', 'emailError', '');
        useAppStore(pinia).setProperty('hospital', 'AuthForm', 'authError', '');
        useAppStore(pinia).setProperty('hospital', 'AuthForm', 'loginInfoMessage', '');
        usePopupStore(pinia).open({ packageName: 'hospital', pageId: 'login-popup', title: 'login' });
        return ok();
      }
      await ensureMedicalDepartmentOptionsLoaded();
      const departments = (useAppStore(pinia).getData('hospital', 'MedicalDepartments') ?? {}) as Record<
        string,
        unknown
      >;
      const departmentList = Array.isArray(departments.list) ? departments.list : [];
      useAppStore(pinia).setData('hospital', 'AppointmentDepartments', { list: departmentList });
      useAppStore(pinia).setProperty('hospital', 'AppointmentForm', 'editingAppointmentId', '');
      useAppStore(pinia).setProperty(
        'hospital',
        'AppointmentForm',
        'patientName',
        String(authSession.fullName ?? authSession.userDisplayName ?? '').trim()
      );
      useAppStore(pinia).setProperty(
        'hospital',
        'AppointmentForm',
        'patientEmail',
        String(authSession.email ?? '').trim()
      );
      useAppStore(pinia).setProperty(
        'hospital',
        'AppointmentForm',
        'patientPhone',
        String(authSession.mobileNumber ?? '').trim()
      );
      useAppStore(pinia).setProperty('hospital', 'AppointmentForm', 'department', '');
      useAppStore(pinia).setProperty('hospital', 'AppointmentForm', 'doctor', '');
      useAppStore(pinia).setProperty('hospital', 'AppointmentForm', 'ageGroup', '');
      useAppStore(pinia).setProperty('hospital', 'AppointmentForm', 'additionalNotes', '');
      useAppStore(pinia).setProperty('hospital', 'AppointmentForm', 'prescriptionFileNames', []);
      useAppStore(pinia).setProperty('hospital', 'AppointmentForm', 'prescriptionUploadError', '');
      useAppStore(pinia).setProperty('hospital', 'AppointmentForm', 'preferredDate', '');
      useAppStore(pinia).setProperty('hospital', 'AppointmentForm', 'preferredTimeSlot', '');
      useAppStore(pinia).setProperty('hospital', 'AppointmentForm', 'slotAvailabilityMessage', '');
      useAppStore(pinia).setProperty('hospital', 'AppointmentForm', 'doctorLoadError', '');
      clearAppointmentPrescriptionFiles();
      useAppStore(pinia).setData('hospital', 'AppointmentDoctors', { list: [] });
      useAppStore(pinia).setData('hospital', 'AppointmentTimeSlots', { list: [] });
      usePopupStore(pinia).open({ packageName: 'hospital', pageId: 'appointment-popup', title: 'appointment' });
      return ok();
    }
  }
];
