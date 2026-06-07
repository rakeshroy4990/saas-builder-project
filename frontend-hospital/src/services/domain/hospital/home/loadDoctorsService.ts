import type { ServiceDefinition } from '../../../../core/types/ServiceDefinition';
import { useAppStore } from '../../../../store/useAppStore';
import { pinia } from '../../../../store/pinia';
import { ok } from '../shared/response';
import { fetchDoctorsGroupedForHome } from './publicDoctorsApi';
import {
  ensureMedicalDepartmentOptionsLoaded,
  syncAppointmentDepartmentsFromMedicalStore,
  type MedicalDepartmentOption
} from '../shared/medicalDepartments';
import { logClient } from '../../../logging/clientLogger';

async function applyHomeDoctorsToStore(): Promise<void> {
  const appStore = useAppStore(pinia);
  await ensureMedicalDepartmentOptionsLoaded();
  syncAppointmentDepartmentsFromMedicalStore();
  const medicalDepartments = (appStore.getData('hospital', 'MedicalDepartments') ?? {}) as Record<string, unknown>;
  const departmentList = Array.isArray(medicalDepartments.list)
    ? (medicalDepartments.list as MedicalDepartmentOption[])
    : [];
  const doctorsByDepartment = await fetchDoctorsGroupedForHome(departmentList);
  const doctors = doctorsByDepartment
    .flatMap((section) => section.doctors)
    .filter((doctor, index, all) => all.findIndex((row) => row.id === doctor.id) === index);
  const home = (appStore.getData('hospital', 'HomeContent') ?? {}) as Record<string, unknown>;
  appStore.setData('hospital', 'HomeContent', { ...home, doctors, doctorsByDepartment });
  appStore.setData('hospital', 'Doctors', {
    list: doctors.map((doctor) => ({
      id: doctor.id,
      label: doctor.name,
      value: doctor.id
    }))
  });
}

/** Refetch doctor cards with the active {@code Accept-Language} (e.g. after language switch). */
export async function reloadHomeDoctorsForActiveLocale(): Promise<void> {
  try {
    await applyHomeDoctorsToStore();
  } catch (error) {
    await logClient('ERROR', 'Failed to reload public doctors for home locale', {
      reason: error instanceof Error ? error.message : String(error)
    });
  }
}

export const loadDoctorsHospitalServices: ServiceDefinition[] = [
  {
    packageName: 'hospital',
    serviceId: 'load-doctors',
    execute: async () => {
      try {
        await applyHomeDoctorsToStore();
      } catch (error) {
        await logClient('ERROR', 'Failed to load public doctors for home', {
          reason: error instanceof Error ? error.message : String(error)
        });
      }
      const appStore = useAppStore(pinia);
      appStore.setData('hospital', 'AppointmentDoctors', { list: [] });
      appStore.setData('hospital', 'AppointmentDoctorCatalog', { byDepartment: {} });
      return ok();
    }
  }
];
