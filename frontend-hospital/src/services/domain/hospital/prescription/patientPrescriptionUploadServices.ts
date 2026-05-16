import type { ServiceDefinition } from '../../../../core/types/ServiceDefinition';
import { isAxiosError } from 'axios';
import { useAppStore } from '../../../../store/useAppStore';
import { usePopupStore } from '../../../../store/usePopupStore';
import { useToastStore } from '../../../../store/useToastStore';
import { pinia } from '../../../../store/pinia';
import { listPatientPrescriptions } from '../../../http/patientPrescriptionApi';
import { ok } from '../shared/response';
import { i18n } from '../../../../i18n';

const tr = (key: string): string => String((i18n.global as any).t(key));

export const patientPrescriptionUploadHospitalServices: ServiceDefinition[] = [
  {
    packageName: 'hospital',
    serviceId: 'open-prescription-upload-success-popup',
    execute: async () => {
      usePopupStore(pinia).open({
        packageName: 'hospital',
        pageId: 'prescription-upload-success-popup',
        title: 'prescription-upload-success'
      });
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'go-to-prescription-view-after-upload',
    execute: async () => {
      usePopupStore(pinia).close();
      useAppStore(pinia).setData('hospital', 'PrescriptionNav', { activeItem: 'view' });
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'load-patient-prescriptions',
    execute: async () => {
      const appStore = useAppStore(pinia);
      appStore.setData('hospital', 'PatientPrescriptions', { loading: true, error: '', items: [] });
      try {
        const { items, totalElements } = await listPatientPrescriptions(0, 50);
        appStore.setData('hospital', 'PatientPrescriptions', {
          loading: false,
          error: '',
          items,
          totalElements
        });
        return ok();
      } catch (err) {
        const message = isAxiosError(err)
          ? String(err.response?.data?.message ?? err.message ?? '').trim()
          : String((err as Error)?.message ?? '').trim();
        appStore.setData('hospital', 'PatientPrescriptions', {
          loading: false,
          error: message || tr('prescriptions.view.loadFailed'),
          items: []
        });
        useToastStore(pinia).show(tr('prescriptions.view.loadFailed'), 'error');
        return ok();
      }
    }
  }
];
