import {
  parsePublicDoctorProfile,
  SERVER_PATHS,
  unwrapEnvelope,
  type PublicDoctorProfile
} from '@saas-builder/hospital-api-client';

import { apiClient } from '../../../http/apiClient';
import { loadMedicalDepartmentOptions, type MedicalDepartmentOption } from '../shared/medicalDepartments';

const CLOUDINARY_IMAGE_BASE_URL = String(
  import.meta.env.VITE_CLOUDINARY_IMAGE_BASE_URL ?? 'https://res.cloudinary.com/dbke33vfd/image/upload'
).replace(/\/+$/, '');

export type HomeDoctorCard = {
  id: string;
  name: string;
  speciality: string;
  degree: string;
  experience: string;
  image: string;
  department: string;
  /** Department dropdown value (medical department code) for appointment booking. */
  departmentValue: string;
};

export type HomeDoctorDepartmentSection = {
  departmentId: string;
  departmentLabel: string;
  departmentValue: string;
  doctors: HomeDoctorCard[];
};

export function mapPublicDoctorToHomeCard(
  doctor: PublicDoctorProfile,
  departmentValue = ''
): HomeDoctorCard {
  const resolvedDepartmentValue = departmentValue.trim() || doctor.department.trim();
  return {
    id: doctor.id,
    name: doctor.name,
    speciality: doctor.speciality,
    degree: doctor.qualifications,
    experience: doctor.experienceSummary,
    image: doctor.imageUrl,
    department: doctor.department,
    departmentValue: resolvedDepartmentValue
  };
}

async function fetchDoctorsForDepartment(department: string): Promise<unknown[]> {
  const response = await apiClient.get(SERVER_PATHS.doctorGet, {
    params: { department, page: 0, size: 100 }
  });
  const dataNode = unwrapEnvelope<unknown>(response.data);
  return Array.isArray(dataNode) ? dataNode : [];
}

function parseDoctorRows(rows: unknown[], departmentValue: string): HomeDoctorCard[] {
  return rows
    .map((item, index) => {
      const profile = parsePublicDoctorProfile(item, index, CLOUDINARY_IMAGE_BASE_URL);
      return profile ? mapPublicDoctorToHomeCard(profile, departmentValue) : null;
    })
    .filter((row): row is HomeDoctorCard => row !== null);
}

/** Loads doctors grouped by medical department for home / overview sections. */
export async function fetchDoctorsGroupedForHome(
  preloadedDepartments?: MedicalDepartmentOption[]
): Promise<HomeDoctorDepartmentSection[]> {
  const departments =
    preloadedDepartments && preloadedDepartments.length > 0
      ? preloadedDepartments
      : await loadMedicalDepartmentOptions();
  if (departments.length === 0) {
    return [];
  }

  const sections = await Promise.all(
    departments.map(async (department) => {
      const rows = await fetchDoctorsForDepartment(department.value);
      return {
        departmentId: department.id,
        departmentLabel: department.label,
        departmentValue: department.value,
        doctors: parseDoctorRows(rows, department.value)
      };
    })
  );

  return sections.filter((section) => section.doctors.length > 0);
}

/** Flat list of all doctors (deduped by id) for legacy store keys. */
export async function fetchDoctorsForHome(): Promise<HomeDoctorCard[]> {
  const sections = await fetchDoctorsGroupedForHome();
  const seen = new Set<string>();
  const doctors: HomeDoctorCard[] = [];
  for (const section of sections) {
    for (const doctor of section.doctors) {
      if (seen.has(doctor.id)) continue;
      seen.add(doctor.id);
      doctors.push(doctor);
    }
  }
  return doctors;
}
