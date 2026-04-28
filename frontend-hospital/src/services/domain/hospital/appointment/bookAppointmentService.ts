import type { ServiceDefinition } from '../../../../core/types/ServiceDefinition';
import { isAxiosError } from 'axios';
import { useAppStore } from '../../../../store/useAppStore';
import { usePopupStore } from '../../../../store/usePopupStore';
import { useToastStore } from '../../../../store/useToastStore';
import { pinia } from '../../../../store/pinia';
import { apiClient } from '../../../http/apiClient';
import { URLRegistry } from '../../../http/URLRegistry';
import { router } from '../../../../router';
import { ok } from '../shared/response';
import { pickString } from '../shared/strings';
import { clearAppointmentPrescriptionFiles, getAppointmentPrescriptionFiles } from '../shared/appointmentPrescriptionFiles';
import { ensureMedicalDepartmentOptionsLoaded } from '../shared/medicalDepartments';
import { loadDashboardAppointmentsPage } from '../shared/dashboardAppointments';
import { refreshAppointmentTimeSlotOptionsFromForm } from '../shared/refreshAppointmentTimeSlots';
import { trackEvent } from '../../../analytics/firebaseAnalytics';

function clearAppointmentFormFieldsAfterSave(): void {
  const store = useAppStore(pinia);
  store.setProperty('hospital', 'AppointmentForm', 'editingAppointmentId', '');
  store.setProperty('hospital', 'AppointmentForm', 'patientName', '');
  store.setProperty('hospital', 'AppointmentForm', 'patientEmail', '');
  store.setProperty('hospital', 'AppointmentForm', 'patientPhone', '');
  store.setProperty('hospital', 'AppointmentForm', 'preferredDate', '');
  store.setProperty('hospital', 'AppointmentForm', 'preferredTimeSlot', '');
  store.setProperty('hospital', 'AppointmentForm', 'slotAvailabilityMessage', '');
  store.setProperty('hospital', 'AppointmentForm', 'department', '');
  store.setProperty('hospital', 'AppointmentForm', 'doctor', '');
  store.setProperty('hospital', 'AppointmentForm', 'ageGroup', '');
  store.setProperty('hospital', 'AppointmentForm', 'additionalNotes', '');
  store.setProperty('hospital', 'AppointmentForm', 'prescriptionFileNames', []);
  store.setProperty('hospital', 'AppointmentForm', 'prescriptionUploadError', '');
  store.setProperty('hospital', 'AppointmentForm', 'doctorLoadError', '');
  store.setData('hospital', 'AppointmentDoctors', { list: [] });
  store.setData('hospital', 'AppointmentTimeSlots', { list: [] });
  clearAppointmentPrescriptionFiles();
}

export const bookAppointmentHospitalServices: ServiceDefinition[] = [
  {
    packageName: 'hospital',
    serviceId: 'init-book-appointment-popup',
    execute: async () => {
      await ensureMedicalDepartmentOptionsLoaded();
      const appStore = useAppStore(pinia);
      const departmentsNode = (appStore.getData('hospital', 'MedicalDepartments') ?? {}) as Record<string, unknown>;
      const departmentList = Array.isArray(departmentsNode.list) ? (departmentsNode.list as unknown[]) : [];
      appStore.setData('hospital', 'AppointmentDepartments', { list: departmentList });
      await refreshAppointmentTimeSlotOptionsFromForm();
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'init-book-appointment-page',
    execute: async () => {
      const form = (useAppStore(pinia).getData('hospital', 'AppointmentForm') ?? {}) as Record<string, unknown>;
      const editingId = pickString(form, ['editingAppointmentId']).trim();
      if (!editingId) {
        useToastStore(pinia).show('Open an appointment from the dashboard to edit it.', 'info');
        await router.replace('/dashboard');
        return ok();
      }
      await ensureMedicalDepartmentOptionsLoaded();
      const appStore = useAppStore(pinia);
      const departmentsNode = (appStore.getData('hospital', 'MedicalDepartments') ?? {}) as Record<string, unknown>;
      const departmentList = Array.isArray(departmentsNode.list) ? (departmentsNode.list as unknown[]) : [];
      appStore.setData('hospital', 'AppointmentDepartments', { list: departmentList });
      await refreshAppointmentTimeSlotOptionsFromForm();
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'book-appointment',
    responseCodes: { failure: ['BOOK_APPOINTMENT_FAILED'] },
    execute: async () => {
      const authSession = (useAppStore(pinia).getData('hospital', 'AuthSession') ?? {}) as Record<string, unknown>;
      const form = (useAppStore(pinia).getData('hospital', 'AppointmentForm') ?? {}) as Record<string, unknown>;
      const editingId = pickString(form, ['editingAppointmentId']).trim();

      const patientName = editingId
        ? pickString(form, ['patientName', 'PatientName'])
        : pickString(authSession, ['fullName', 'FullName', 'userDisplayName']);
      const email = editingId
        ? pickString(form, ['patientEmail', 'Email'])
        : pickString(authSession, ['email', 'Email']);
      const phoneNumber = editingId
        ? pickString(form, ['patientPhone', 'PhoneNumber'])
        : pickString(authSession, ['mobileNumber', 'MobileNumber', 'PhoneNumber']);

      const payload = {
        PatientName: patientName,
        Email: email,
        PhoneNumber: phoneNumber,
        AgeGroup: pickString(form, ['ageGroup', 'AgeGroup']),
        Department: pickString(form, ['department', 'Department']),
        DoctorId: pickString(form, ['doctor', 'DoctorId']),
        PreferredDate: pickString(form, ['preferredDate', 'PreferredDate']),
        PreferredTimeSlot: pickString(form, ['preferredTimeSlot', 'PreferredTimeSlot']),
        AdditionalNotes: pickString(form, ['additionalNotes', 'AdditionalNotes'])
      };

      const requiredFields: Array<{ label: string; value: unknown }> = [
        { label: 'Patient name', value: payload.PatientName },
        { label: 'Email', value: payload.Email },
        { label: 'Phone number', value: payload.PhoneNumber },
        { label: 'Age group', value: payload.AgeGroup },
        { label: 'Department', value: payload.Department },
        { label: 'Doctor', value: payload.DoctorId },
        { label: 'Preferred date', value: payload.PreferredDate },
        { label: 'Preferred time slot', value: payload.PreferredTimeSlot }
      ];
      const missingRequiredFields = requiredFields
        .filter((field) => !String(field.value ?? '').trim())
        .map((field) => field.label);

      if (missingRequiredFields.length > 0) {
        trackEvent('appointment_submit_failed', {
          reason: 'missing_required_fields',
          missingCount: missingRequiredFields.length,
          isEdit: Boolean(editingId)
        });
        return {
          responseCode: 'BOOK_APPOINTMENT_FAILED',
          message: `Missing required fields: ${missingRequiredFields.join(', ')}.`
        };
      }

      if (!editingId) {
        const ageDigits = String(payload.AgeGroup).replace(/\D/g, '');
        const ageNum = parseInt(ageDigits, 10);
        if (!Number.isNaN(ageNum) && ageNum > 20) {
          trackEvent('appointment_submit_failed', { reason: 'age_limit', isEdit: false });
          return { responseCode: 'BOOK_APPOINTMENT_FAILED', message: 'Age must be 20 years or less for booking.' };
        }
      }

      try {
        const formData = new FormData();
        formData.append('appointment', new Blob([JSON.stringify(payload)], { type: 'application/json' }));
        for (const file of getAppointmentPrescriptionFiles()) {
          formData.append('prescriptions', file);
        }

        if (editingId) {
          await apiClient.put(`${URLRegistry.paths.appointmentUpdate}/${encodeURIComponent(editingId)}`, formData);
          clearAppointmentFormFieldsAfterSave();
          useToastStore(pinia).show('Appointment updated.', 'success');
          usePopupStore(pinia).close();
          await loadDashboardAppointmentsPage();
          trackEvent('appointment_updated', {
            appointmentId: editingId,
            department: String(payload.Department || ''),
            doctorId: String(payload.DoctorId || '')
          });
          return ok({ appointmentId: editingId });
        }

        const response = await apiClient.post(URLRegistry.paths.appointmentCreate, formData);
        const dataNode = (response.data?.Data ?? response.data?.data ?? response.data ?? {}) as Record<string, unknown>;
        clearAppointmentFormFieldsAfterSave();
        const appointmentId = pickString(dataNode, ['Id', 'id']) || '';
        trackEvent('appointment_created', {
          appointmentId,
          department: String(payload.Department || ''),
          doctorId: String(payload.DoctorId || '')
        });
        return ok({ appointmentId });
      } catch (error) {
        const message = isAxiosError(error)
          ? pickString((error.response?.data ?? {}) as Record<string, unknown>, ['Message', 'message']) ||
            'Unable to save appointment right now.'
          : 'Unable to save appointment right now.';
        trackEvent('appointment_submit_failed', { reason: 'request_failed', isEdit: Boolean(editingId) });
        return { responseCode: 'BOOK_APPOINTMENT_FAILED', message };
      }
    }
  }
];
