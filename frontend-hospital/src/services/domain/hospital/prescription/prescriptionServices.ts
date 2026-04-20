import type { ServiceDefinition } from '../../../../core/types/ServiceDefinition';
import { isAxiosError } from 'axios';
import { useAppStore } from '../../../../store/useAppStore';
import { usePopupStore } from '../../../../store/usePopupStore';
import { useToastStore } from '../../../../store/useToastStore';
import { pinia } from '../../../../store/pinia';
import { apiClient } from '../../../http/apiClient';
import { URLRegistry } from '../../../http/URLRegistry';
import { ok } from '../shared/response';
import { pickString } from '../shared/strings';
import { loadDashboardAppointmentsPage } from '../shared/dashboardAppointments';

function childStr(obj: Record<string, unknown> | undefined, keys: string[]): string {
  if (!obj) return '';
  return pickString(obj, keys);
}

function readPayloadNode(data: Record<string, unknown>): Record<string, unknown> {
  const p = (data.Payload ?? data.payload) as unknown;
  return p && typeof p === 'object' && !Array.isArray(p) ? (p as Record<string, unknown>) : {};
}

function toLineMedicineText(medicines: unknown[]): string {
  return medicines
    .map((entry) => {
      const med = (entry ?? {}) as Record<string, unknown>;
      return [
        pickString(med, ['name', 'Name']),
        pickString(med, ['strength', 'Strength']),
        pickString(med, ['dose', 'Dose']),
        pickString(med, ['frequency', 'Frequency']),
        pickString(med, ['route', 'Route']),
        pickString(med, ['durationDays', 'DurationDays']),
        pickString(med, ['scheduleCategory', 'ScheduleCategory'])
      ]
        .map((value) => String(value ?? '').trim())
        .join(' | ');
    })
    .filter((line) => line.replace(/\|/g, '').trim().length > 0)
    .join('\n');
}

function parseMedicinesTextToList(raw: string): unknown[] {
  const lines = raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.map((line) => {
    const [name, strength, dose, frequency, route, durationDays, scheduleCategory] = line
      .split('|')
      .map((part) => part.trim());
    return {
      name: name ?? '',
      strength: strength ?? '',
      dose: dose ?? '',
      frequency: frequency ?? '',
      route: route ?? '',
      durationDays: durationDays ?? '',
      scheduleCategory: scheduleCategory ?? ''
    };
  });
}

function nonBlank(value: unknown): string {
  return String(value ?? '').trim();
}

function mergeMissing(base: Record<string, unknown>, fallback: Record<string, unknown>): Record<string, unknown> {
  const merged = { ...base };
  for (const [key, value] of Object.entries(fallback)) {
    if (!nonBlank(merged[key]) && nonBlank(value)) merged[key] = value;
  }
  return merged;
}

function applyPayloadToEditor(appStore: ReturnType<typeof useAppStore>, payload: Record<string, unknown>) {
  const clinic = (payload.clinic ?? payload.Clinic) as Record<string, unknown> | undefined;
  const prescriber = (payload.prescriber ?? payload.Prescriber) as Record<string, unknown> | undefined;
  const patient = (payload.patient ?? payload.Patient) as Record<string, unknown> | undefined;
  const meds = payload.medicines ?? payload.Medicines;
  const medicineList = Array.isArray(meds) ? meds : [];
  const medicinesJson = JSON.stringify(medicineList, null, 2);
  const medicinesText = toLineMedicineText(medicineList);
  const base = (appStore.getData('hospital', 'PrescriptionEditor') ?? {}) as Record<string, unknown>;
  appStore.setData('hospital', 'PrescriptionEditor', {
    ...base,
    consultationDateTime: pickString(payload, ['consultationDateTime', 'ConsultationDateTime']),
    consultationMode: pickString(payload, ['consultationMode', 'ConsultationMode']),
    clinicName: childStr(clinic, ['name', 'Name']),
    clinicAddress: childStr(clinic, ['address', 'Address']),
    clinicPhone: childStr(clinic, ['phone', 'Phone']),
    prescriberDisplayName: childStr(prescriber, ['displayName', 'DisplayName']),
    prescriberQualifications: childStr(prescriber, ['qualifications', 'Qualifications']),
    smcName: childStr(prescriber, ['smcName', 'SmcName']),
    smcReg: childStr(prescriber, ['smcRegistrationNumber', 'SmcRegistrationNumber']),
    patientName: childStr(patient, ['name', 'Name']),
    patientAgeOrDob: childStr(patient, ['ageOrDob', 'AgeOrDob']),
    patientSex: childStr(patient, ['sex', 'Sex']),
    patientAddress: childStr(patient, ['address', 'Address']),
    patientPhone: childStr(patient, ['phone', 'Phone']),
    medicinesText,
    medicinesJson,
    generalAdvice: pickString(payload, ['generalAdvice', 'GeneralAdvice']),
    followUpAdvice: pickString(payload, ['followUpAdvice', 'FollowUpAdvice']),
    validationSummary: '',
    loading: false
  });
}

async function fetchUserById(userId: string): Promise<Record<string, unknown>> {
  if (!userId) return {};
  const response = await apiClient.get(URLRegistry.paths.user, { params: { userId } });
  const root = (response.data ?? {}) as Record<string, unknown>;
  return (root.Data ?? root.data ?? {}) as Record<string, unknown>;
}

function mapDoctorUserToPrescriptionDefaults(row: Record<string, unknown>): Record<string, unknown> {
  const firstName = pickString(row, ['FirstName', 'firstName']);
  const lastName = pickString(row, ['LastName', 'lastName']);
  const displayName =
    [firstName, lastName].filter(Boolean).join(' ').trim() ||
    pickString(row, ['DisplayName', 'displayName', 'EmailId', 'emailId']);
  return {
    prescriberDisplayName: displayName,
    prescriberQualifications: pickString(row, ['Qualifications', 'Qualification', 'qualifications', 'qualification']),
    smcName: pickString(row, ['SmcName', 'smcName', 'StateMedicalCouncil', 'stateMedicalCouncil']),
    smcReg: pickString(row, ['SmcRegistrationNumber', 'smcRegistrationNumber', 'RegistrationNumber', 'registrationNumber']),
    clinicAddress: pickString(row, ['Address', 'address']),
    clinicPhone: pickString(row, ['MobileNumber', 'mobileNumber', 'PhoneNumber', 'phoneNumber'])
  };
}

function mapPatientUserToPrescriptionDefaults(row: Record<string, unknown>): Record<string, unknown> {
  const firstName = pickString(row, ['FirstName', 'firstName']);
  const lastName = pickString(row, ['LastName', 'lastName']);
  const displayName = [firstName, lastName].filter(Boolean).join(' ').trim();
  return {
    patientName: displayName || pickString(row, ['DisplayName', 'displayName', 'EmailId', 'emailId']),
    patientSex: pickString(row, ['Gender', 'gender']),
    patientAddress: pickString(row, ['Address', 'address']),
    patientPhone: pickString(row, ['MobileNumber', 'mobileNumber', 'PhoneNumber', 'phoneNumber'])
  };
}

function buildPayloadFromEditor(ui: Record<string, unknown>): Record<string, unknown> {
  const medicinesText = String(ui.medicinesText ?? '').trim();
  let medicines: unknown[] = medicinesText ? parseMedicinesTextToList(medicinesText) : [];
  if (!medicines.length) {
    try {
      medicines = JSON.parse(String(ui.medicinesJson ?? '[]')) as unknown[];
    } catch {
      medicines = [];
    }
  }
  return {
    templateVersion: '1',
    consultationDateTime: String(ui.consultationDateTime ?? '').trim(),
    consultationMode: String(ui.consultationMode ?? '').trim(),
    clinic: {
      name: String(ui.clinicName ?? '').trim(),
      address: String(ui.clinicAddress ?? '').trim(),
      phone: String(ui.clinicPhone ?? '').trim()
    },
    prescriber: {
      displayName: String(ui.prescriberDisplayName ?? '').trim(),
      qualifications: String(ui.prescriberQualifications ?? '').trim(),
      smcName: String(ui.smcName ?? '').trim(),
      smcRegistrationNumber: String(ui.smcReg ?? '').trim()
    },
    patient: {
      name: String(ui.patientName ?? '').trim(),
      ageOrDob: String(ui.patientAgeOrDob ?? '').trim(),
      sex: String(ui.patientSex ?? '').trim(),
      address: String(ui.patientAddress ?? '').trim(),
      phone: String(ui.patientPhone ?? '').trim()
    },
    medicines,
    generalAdvice: String(ui.generalAdvice ?? '').trim(),
    followUpAdvice: String(ui.followUpAdvice ?? '').trim()
  };
}

export const prescriptionHospitalServices: ServiceDefinition[] = [
  {
    packageName: 'hospital',
    serviceId: 'open-eprescription-popup',
    execute: async (request) => {
      const appointmentId = String(request.data?.appointmentId ?? '').trim();
      if (!appointmentId) {
        useToastStore(pinia).show('Missing appointment id.', 'error');
        return { responseCode: 'EPRESCRIPTION_OPEN_FAILED', message: 'Missing appointment id' };
      }
      const appStore = useAppStore(pinia);
      appStore.setData('hospital', 'PrescriptionConsultationModeOptions', {
        list: [
          { id: 'VIDEO', value: 'VIDEO', label: 'Video' },
          { id: 'AUDIO', value: 'AUDIO', label: 'Audio' },
          { id: 'TEXT', value: 'TEXT', label: 'Text' }
        ]
      });
      appStore.setData('hospital', 'PrescriptionEditor', {
        appointmentId,
        loading: true,
        consultationDateTime: '',
        consultationMode: 'VIDEO',
        clinicName: '',
        clinicAddress: '',
        clinicPhone: '',
        prescriberDisplayName: '',
        prescriberQualifications: '',
        smcName: '',
        smcReg: '',
        patientName: '',
        patientAgeOrDob: '',
        patientSex: '',
        patientAddress: '',
        patientPhone: '',
        medicinesText: '',
        medicinesJson: '[]',
        generalAdvice: '',
        followUpAdvice: '',
        status: '',
        draftEditable: 'Y',
        validationSummary: ''
      });
      usePopupStore(pinia).open({
        packageName: 'hospital',
        pageId: 'eprescription-popup',
        title: 'Structured e-prescription',
        initKey: `eprx-${appointmentId}-${Date.now()}`
      });
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'hydrate-eprescription-popup',
    execute: async () => {
      const appStore = useAppStore(pinia);
      const ui = (appStore.getData('hospital', 'PrescriptionEditor') ?? {}) as Record<string, unknown>;
      const appointmentId = String(ui.appointmentId ?? '').trim();
      if (!appointmentId) {
        useToastStore(pinia).show('Missing appointment id.', 'error');
        return { responseCode: 'EPRESCRIPTION_HYDRATE_FAILED', message: 'Missing appointment id' };
      }
      try {
        const response = await apiClient.post(
          `${URLRegistry.paths.prescriptionAppointmentBase}/${encodeURIComponent(appointmentId)}/ensure-draft`
        );
        const data = (response.data?.Data ?? response.data?.data ?? {}) as Record<string, unknown>;
        const payload = readPayloadNode(data);
        applyPayloadToEditor(appStore, payload);
        appStore.setProperty('hospital', 'PrescriptionEditor', 'status', pickString(data, ['Status', 'status']));
        const de = data.DraftEditable ?? data.draftEditable;
        const editable = de !== false && String(de).toLowerCase() !== 'false';
        appStore.setProperty('hospital', 'PrescriptionEditor', 'draftEditable', editable ? 'Y' : 'N');
        try {
          const appointmentResp = await apiClient.get(
            `${URLRegistry.paths.appointmentGet}/${encodeURIComponent(appointmentId)}`
          );
          const appointmentRoot = (appointmentResp.data?.Data ?? appointmentResp.data?.data ?? {}) as Record<
            string,
            unknown
          >;
          const doctorId = pickString(appointmentRoot, ['DoctorId', 'doctorId']);
          const patientUserId = pickString(appointmentRoot, ['CreatedBy', 'createdBy']);
          const appointmentDefaults: Record<string, unknown> = {
            consultationDateTime: pickString(appointmentRoot, ['PreferredDate', 'preferredDate']),
            clinicName: pickString(appointmentRoot, ['HospitalName', 'hospitalName']),
            patientName: pickString(appointmentRoot, ['PatientName', 'patientName']),
            patientAgeOrDob: pickString(appointmentRoot, ['AgeGroup', 'ageGroup']),
            patientPhone: pickString(appointmentRoot, ['PhoneNumber', 'phoneNumber'])
          };
          const [doctorUser, patientUser] = await Promise.all([
            fetchUserById(doctorId).catch(() => ({})),
            fetchUserById(patientUserId).catch(() => ({}))
          ]);
          const editor = (appStore.getData('hospital', 'PrescriptionEditor') ?? {}) as Record<string, unknown>;
          const merged = mergeMissing(editor, {
            ...appointmentDefaults,
            ...mapDoctorUserToPrescriptionDefaults(doctorUser),
            ...mapPatientUserToPrescriptionDefaults(patientUser)
          });
          appStore.setData('hospital', 'PrescriptionEditor', merged);
        } catch {
          // Non-fatal: draft payload is still loaded and editable.
        }
        return ok();
      } catch (error) {
        const message = isAxiosError(error)
          ? pickString((error.response?.data ?? {}) as Record<string, unknown>, ['Message', 'message']) ||
            'Unable to load e-prescription.'
          : 'Unable to load e-prescription.';
        useToastStore(pinia).show(message, 'error');
        appStore.setProperty('hospital', 'PrescriptionEditor', 'loading', false);
        return { responseCode: 'EPRESCRIPTION_HYDRATE_FAILED', message };
      }
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'set-prescription-editor-field',
    execute: async (request) => {
      const field = String(request.data?.field ?? '').trim();
      const allowed = new Set([
        'consultationDateTime',
        'consultationMode',
        'clinicName',
        'clinicAddress',
        'clinicPhone',
        'prescriberDisplayName',
        'prescriberQualifications',
        'smcName',
        'smcReg',
        'patientName',
        'patientAgeOrDob',
        'patientSex',
        'patientAddress',
        'patientPhone',
        'medicinesText',
        'medicinesJson',
        'generalAdvice',
        'followUpAdvice'
      ]);
      if (!allowed.has(field)) return ok();
      useAppStore(pinia).setProperty(
        'hospital',
        'PrescriptionEditor',
        field,
        String(request.data?.value ?? request.data?.Value ?? '')
      );
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'save-eprescription-draft',
    execute: async () => {
      const appStore = useAppStore(pinia);
      const ui = (appStore.getData('hospital', 'PrescriptionEditor') ?? {}) as Record<string, unknown>;
      const appointmentId = String(ui.appointmentId ?? '').trim();
      if (!appointmentId) {
        useToastStore(pinia).show('Missing appointment id.', 'error');
        return { responseCode: 'EPRESCRIPTION_SAVE_FAILED', message: 'Missing appointment id' };
      }
      if (String(ui.draftEditable ?? '').toUpperCase() === 'N') {
        useToastStore(pinia).show('This prescription is already signed.', 'error');
        return { responseCode: 'EPRESCRIPTION_SAVE_FAILED', message: 'Signed' };
      }
      try {
        const body = buildPayloadFromEditor(ui);
        const response = await apiClient.put(
          `${URLRegistry.paths.prescriptionAppointmentBase}/${encodeURIComponent(appointmentId)}/draft`,
          body
        );
        const data = (response.data?.Data ?? response.data?.data ?? {}) as Record<string, unknown>;
        const payload = readPayloadNode(data);
        applyPayloadToEditor(appStore, payload);
        useToastStore(pinia).show('Draft saved.', 'success');
        return ok();
      } catch (error) {
        const message = isAxiosError(error)
          ? pickString((error.response?.data ?? {}) as Record<string, unknown>, ['Message', 'message']) ||
            'Unable to save draft.'
          : 'Unable to save draft.';
        useToastStore(pinia).show(message, 'error');
        return { responseCode: 'EPRESCRIPTION_SAVE_FAILED', message };
      }
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'validate-eprescription',
    execute: async () => {
      const appStore = useAppStore(pinia);
      const ui = (appStore.getData('hospital', 'PrescriptionEditor') ?? {}) as Record<string, unknown>;
      const appointmentId = String(ui.appointmentId ?? '').trim();
      if (!appointmentId) {
        useToastStore(pinia).show('Missing appointment id.', 'error');
        return { responseCode: 'EPRESCRIPTION_VALIDATE_FAILED', message: 'Missing appointment id' };
      }
      try {
        await apiClient.put(
          `${URLRegistry.paths.prescriptionAppointmentBase}/${encodeURIComponent(appointmentId)}/draft`,
          buildPayloadFromEditor(ui)
        );
        const response = await apiClient.post(
          `${URLRegistry.paths.prescriptionAppointmentBase}/${encodeURIComponent(appointmentId)}/validate`
        );
        const data = (response.data?.Data ?? response.data?.data ?? {}) as Record<string, unknown>;
        const errs = (data.ValidationErrors ?? data.validationErrors) as unknown;
        const list = Array.isArray(errs) ? (errs as string[]).filter(Boolean) : [];
        const summary = list.length ? list.join('\n') : 'All mandatory fields validated.';
        appStore.setProperty('hospital', 'PrescriptionEditor', 'validationSummary', summary);
        useToastStore(pinia).show(list.length ? 'Validation reported issues.' : 'Validation OK.', list.length ? 'error' : 'success');
        return ok();
      } catch (error) {
        const message = isAxiosError(error)
          ? pickString((error.response?.data ?? {}) as Record<string, unknown>, ['Message', 'message']) ||
            'Unable to validate.'
          : 'Unable to validate.';
        useToastStore(pinia).show(message, 'error');
        return { responseCode: 'EPRESCRIPTION_VALIDATE_FAILED', message };
      }
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'finalize-eprescription',
    execute: async () => {
      const appStore = useAppStore(pinia);
      const ui = (appStore.getData('hospital', 'PrescriptionEditor') ?? {}) as Record<string, unknown>;
      const appointmentId = String(ui.appointmentId ?? '').trim();
      if (!appointmentId) {
        useToastStore(pinia).show('Missing appointment id.', 'error');
        return { responseCode: 'EPRESCRIPTION_FINALIZE_FAILED', message: 'Missing appointment id' };
      }
      try {
        await apiClient.put(
          `${URLRegistry.paths.prescriptionAppointmentBase}/${encodeURIComponent(appointmentId)}/draft`,
          buildPayloadFromEditor(ui)
        );
        await apiClient.post(
          `${URLRegistry.paths.prescriptionAppointmentBase}/${encodeURIComponent(appointmentId)}/validate`
        );
        const fin = await apiClient.post(
          `${URLRegistry.paths.prescriptionAppointmentBase}/${encodeURIComponent(appointmentId)}/finalize`
        );
        const data = (fin.data?.Data ?? fin.data?.data ?? {}) as Record<string, unknown>;
        const payload = readPayloadNode(data);
        applyPayloadToEditor(appStore, payload);
        appStore.setProperty('hospital', 'PrescriptionEditor', 'status', pickString(data, ['Status', 'status']));
        appStore.setProperty('hospital', 'PrescriptionEditor', 'draftEditable', 'N');
        useToastStore(pinia).show('E-prescription finalized (see legal notice in editor).', 'success');
        await loadDashboardAppointmentsPage();
        usePopupStore(pinia).close();
        return ok();
      } catch (error) {
        const message = isAxiosError(error)
          ? pickString((error.response?.data ?? {}) as Record<string, unknown>, ['Message', 'message']) ||
            'Unable to finalize.'
          : 'Unable to finalize.';
        useToastStore(pinia).show(message, 'error');
        return { responseCode: 'EPRESCRIPTION_FINALIZE_FAILED', message };
      }
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'complete-dashboard-visit',
    execute: async (request) => {
      const appointmentId = String(request.data?.appointmentId ?? '').trim();
      if (!appointmentId) {
        useToastStore(pinia).show('Missing appointment id.', 'error');
        return { responseCode: 'APPOINTMENT_COMPLETE_FAILED', message: 'Missing appointment id' };
      }
      try {
        await apiClient.post(`${URLRegistry.paths.appointmentComplete}/${encodeURIComponent(appointmentId)}`);
        useToastStore(pinia).show('Visit marked complete. You can now issue the structured e-prescription.', 'success');
        await loadDashboardAppointmentsPage();
        return ok();
      } catch (error) {
        const message = isAxiosError(error)
          ? pickString((error.response?.data ?? {}) as Record<string, unknown>, ['Message', 'message']) ||
            'Unable to mark visit complete.'
          : 'Unable to mark visit complete.';
        useToastStore(pinia).show(message, 'error');
        return { responseCode: 'APPOINTMENT_COMPLETE_FAILED', message };
      }
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'download-eprescription-pdf',
    execute: async (request) => {
      const appointmentId = String(request.data?.appointmentId ?? '').trim();
      if (!appointmentId) {
        useToastStore(pinia).show('Missing appointment id.', 'error');
        return { responseCode: 'EPRESCRIPTION_PDF_FAILED', message: 'Missing appointment id' };
      }
      try {
        const response = await apiClient.get(
          `${URLRegistry.paths.prescriptionAppointmentBase}/${encodeURIComponent(appointmentId)}/pdf`,
          { responseType: 'blob' }
        );
        const blob = response.data as Blob;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `eprescription-${appointmentId}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        return ok();
      } catch (error) {
        const message = isAxiosError(error)
          ? pickString((error.response?.data ?? {}) as Record<string, unknown>, ['Message', 'message']) ||
            'E-prescription PDF is not available yet.'
          : 'E-prescription PDF is not available yet.';
        useToastStore(pinia).show(message, 'error');
        return { responseCode: 'EPRESCRIPTION_PDF_FAILED', message };
      }
    }
  }
];
