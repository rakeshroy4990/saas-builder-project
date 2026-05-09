import type { Composer } from 'vue-i18n';
import { useAppStore } from '../../../../store/useAppStore';
import { pinia } from '../../../../store/pinia';
import { buildHospitalHomeContent } from '../home/localizedHospitalHomeContent';

/** Re-applies locale-dependent Pinia payloads (e.g. marketing copy) after the UI language changes. */
export function refreshHospitalLocalizedUi(composer: Composer): void {
  const appStore = useAppStore(pinia);
  const existing = appStore.getData('hospital', 'HomeContent') as Record<string, unknown> | undefined;
  appStore.setData(
    'hospital',
    'HomeContent',
    buildHospitalHomeContent(composer.t.bind(composer), existing ?? null)
  );

  const filters = (appStore.getData('hospital', 'DashboardFilters') ?? {}) as Record<string, unknown>;
  const statusOptions = Array.isArray(filters.statusOptions) ? (filters.statusOptions as Array<Record<string, unknown>>) : [];
  if (statusOptions.length > 0) {
    const localizedStatusOptions = statusOptions.map((opt) => {
      const key = String(opt.labelI18nKey ?? '').trim();
      if (!key) return opt;
      return { ...opt, label: composer.t(key) };
    });
    const doctorOptions = Array.isArray(filters.doctorOptions) ? (filters.doctorOptions as Array<Record<string, unknown>>) : [];
    const localizedDoctorOptions = doctorOptions.map((opt) => {
      const key = String(opt.labelI18nKey ?? '').trim();
      if (!key) return opt;
      return { ...opt, label: composer.t(key) };
    });
    appStore.setData('hospital', 'DashboardFilters', {
      ...filters,
      statusOptions: localizedStatusOptions,
      doctorOptions: localizedDoctorOptions
    });
  }

  const consultationModes = (appStore.getData('hospital', 'PrescriptionConsultationModeOptions') ?? {}) as Record<string, unknown>;
  const consultationList = Array.isArray(consultationModes.list)
    ? (consultationModes.list as Array<Record<string, unknown>>)
    : [];
  if (consultationList.length > 0) {
    appStore.setData('hospital', 'PrescriptionConsultationModeOptions', {
      list: consultationList.map((opt) => {
        const key = String(opt.labelI18nKey ?? '').trim();
        return key ? { ...opt, label: composer.t(key) } : opt;
      })
    });
  }

  const patientSexOptions = (appStore.getData('hospital', 'PrescriptionPatientSexOptions') ?? {}) as Record<string, unknown>;
  const sexList = Array.isArray(patientSexOptions.list) ? (patientSexOptions.list as Array<Record<string, unknown>>) : [];
  if (sexList.length > 0) {
    appStore.setData('hospital', 'PrescriptionPatientSexOptions', {
      list: sexList.map((opt) => {
        const key = String(opt.labelI18nKey ?? '').trim();
        return key ? { ...opt, label: composer.t(key) } : opt;
      })
    });
  }
}
