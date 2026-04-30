import type { ServiceDefinition } from '../../../../core/types/ServiceDefinition';
import { useAppStore } from '../../../../store/useAppStore';
import { pinia } from '../../../../store/pinia';
import { ok } from '../shared/response';
import { PRESCRIPTION_LIMIT_ERROR_MESSAGE } from '../shared/constants';
import { setAppointmentPrescriptionFiles } from '../shared/appointmentPrescriptionFiles';
import { ensureDoctorOptionsLoadedByDepartment } from '../shared/doctorCatalog';
import { refreshAppointmentDateAvailabilityFromForm } from '../shared/refreshAppointmentDateAvailability';
import { refreshAppointmentTimeSlotOptionsFromForm } from '../shared/refreshAppointmentTimeSlots';

export const appointmentFormHospitalServices: ServiceDefinition[] = [
  {
    packageName: 'hospital',
    serviceId: 'set-appointment-patient-field',
    execute: async (request) => {
      const field = String(request.data.field ?? '').trim();
      const allowed = new Set(['patientName', 'patientEmail', 'patientPhone']);
      if (!allowed.has(field)) return ok();
      useAppStore(pinia).setProperty(
        'hospital',
        'AppointmentForm',
        field,
        String(request.data.value ?? '')
      );
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'set-appointment-date',
    execute: async (request) => {
      useAppStore(pinia).setProperty(
        'hospital',
        'AppointmentForm',
        'preferredDate',
        String(request.data.value ?? '')
      );
      useAppStore(pinia).setProperty('hospital', 'AppointmentForm', 'preferredTimeSlot', '');
      await refreshAppointmentTimeSlotOptionsFromForm();
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'set-appointment-time-slot',
    execute: async (request) => {
      useAppStore(pinia).setProperty(
        'hospital',
        'AppointmentForm',
        'preferredTimeSlot',
        String(request.data.value ?? '')
      );
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'set-appointment-department',
    execute: async (request) => {
      const department = String(request.data.value ?? '').trim();
      useAppStore(pinia).setProperty('hospital', 'AppointmentForm', 'department', department);
      useAppStore(pinia).setProperty('hospital', 'AppointmentForm', 'doctor', '');
      useAppStore(pinia).setProperty('hospital', 'AppointmentForm', 'preferredDate', '');
      useAppStore(pinia).setProperty('hospital', 'AppointmentForm', 'preferredTimeSlot', '');
      useAppStore(pinia).setProperty('hospital', 'AppointmentForm', 'doctorLoadError', '');
      await refreshAppointmentDateAvailabilityFromForm();
      if (!department) {
        useAppStore(pinia).setData('hospital', 'AppointmentDoctors', { list: [] });
        await refreshAppointmentTimeSlotOptionsFromForm();
        return ok();
      }
      try {
        const doctors = await ensureDoctorOptionsLoadedByDepartment(department);
        useAppStore(pinia).setData('hospital', 'AppointmentDoctors', { list: doctors });
      } catch {
        useAppStore(pinia).setData('hospital', 'AppointmentDoctors', { list: [] });
        useAppStore(pinia).setProperty(
          'hospital',
          'AppointmentForm',
          'doctorLoadError',
          'Unable to load the Doctors please try again'
        );
      }
      await refreshAppointmentTimeSlotOptionsFromForm();
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'set-appointment-doctor',
    execute: async (request) => {
      useAppStore(pinia).setProperty(
        'hospital',
        'AppointmentForm',
        'doctor',
        String(request.data.value ?? '').trim()
      );
      useAppStore(pinia).setProperty('hospital', 'AppointmentForm', 'preferredDate', '');
      useAppStore(pinia).setProperty('hospital', 'AppointmentForm', 'preferredTimeSlot', '');
      await refreshAppointmentDateAvailabilityFromForm();
      await refreshAppointmentTimeSlotOptionsFromForm();
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'set-appointment-prescriptions',
    execute: async (request) => {
      const payload = request.data as Record<string, unknown>;
      const selectedFiles = Array.isArray(payload.files) ? (payload.files as File[]) : [];
      const exceedsLimit = selectedFiles.length > 2;
      const files = exceedsLimit ? selectedFiles.slice(-2) : selectedFiles;
      setAppointmentPrescriptionFiles(files);
      useAppStore(pinia).setProperty(
        'hospital',
        'AppointmentForm',
        'prescriptionFileNames',
        files.map((file) => file.name)
      );
      useAppStore(pinia).setProperty(
        'hospital',
        'AppointmentForm',
        'prescriptionUploadError',
        exceedsLimit ? PRESCRIPTION_LIMIT_ERROR_MESSAGE : ''
      );
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'set-appointment-age',
    execute: async (request) => {
      let digitsOnly = String(request.data.value ?? '').replace(/\D/g, '');
      const maxRaw = request.data.maxAge;
      const maxAge = typeof maxRaw === 'number' ? maxRaw : Number(maxRaw);
      if (digitsOnly && Number.isFinite(maxAge) && maxAge > 0) {
        const n = parseInt(digitsOnly, 10);
        if (!Number.isNaN(n) && n > maxAge) {
          digitsOnly = String(maxAge);
        }
      }
      useAppStore(pinia).setProperty('hospital', 'AppointmentForm', 'ageGroup', digitsOnly);
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'set-appointment-notes',
    execute: async (request) => {
      useAppStore(pinia).setProperty(
        'hospital',
        'AppointmentForm',
        'additionalNotes',
        String(request.data.value ?? '')
      );
      return ok();
    }
  }
];
