import {
  loadDoctorsAcrossDepartments,
  parsePublicDoctorProfile,
  SERVER_PATHS,
  unwrapEnvelope,
  type PublicDoctorProfile
} from '@saas-builder/hospital-api-client';

import { apiClient } from '@/api/client';
import { fetchMedicalDepartments } from '@/features/appointments/bookingApi';
import type { SelectOption } from '@/features/appointments/bookingTypes';

const CLOUDINARY_IMAGE_BASE_URL = 'https://res.cloudinary.com/dbke33vfd/image/upload';

export type DoctorListEntry = PublicDoctorProfile & {
  cardLine: string;
};

function buildCardLine(doctor: PublicDoctorProfile): string {
  return [doctor.speciality, doctor.qualifications, doctor.experienceSummary].filter(Boolean).join(' · ');
}

function parseDoctorRow(item: unknown, index: number): DoctorListEntry | null {
  const profile = parsePublicDoctorProfile(item, index, CLOUDINARY_IMAGE_BASE_URL);
  if (!profile) return null;
  return { ...profile, cardLine: buildCardLine(profile) };
}

async function fetchDoctorsForDepartment(departmentValue: string): Promise<DoctorListEntry[]> {
  const response = await apiClient.get(SERVER_PATHS.doctorGet, {
    params: { department: departmentValue, page: 0, size: 100 }
  });
  const dataNode = unwrapEnvelope<unknown>(response.data);
  if (!Array.isArray(dataNode)) return [];
  return dataNode
    .map((item, index) => parseDoctorRow(item, index))
    .filter((row): row is DoctorListEntry => row !== null);
}

/** Flat list of all doctors from GET /api/doctor/get across every department. */
export async function fetchAllDoctors(): Promise<DoctorListEntry[]> {
  const departments = await fetchMedicalDepartments();
  const departmentValues = departments.map((dept) => dept.value).filter((value) => value.trim().length > 0);
  if (departmentValues.length === 0) return [];

  const profiles = await loadDoctorsAcrossDepartments({
    departments: departmentValues,
    fetchDoctorsByDepartment: async (department) => {
      const response = await apiClient.get(SERVER_PATHS.doctorGet, {
        params: { department, page: 0, size: 100 }
      });
      const dataNode = unwrapEnvelope<unknown>(response.data);
      return Array.isArray(dataNode) ? dataNode : [];
    },
    cloudinaryBase: CLOUDINARY_IMAGE_BASE_URL
  });

  return profiles.map((profile) => ({ ...profile, cardLine: buildCardLine(profile) }));
}

export type DepartmentDoctorsSection = {
  departmentId: string;
  departmentLabel: string;
  departmentValue: string;
  doctors: DoctorListEntry[];
};

export async function fetchDoctorsGroupedByDepartment(): Promise<DepartmentDoctorsSection[]> {
  const departments = await fetchMedicalDepartments();
  if (departments.length === 0) return [];

  const sections = await Promise.all(
    departments.map(async (department: SelectOption) => {
      const doctors = await fetchDoctorsForDepartment(department.value);
      return {
        departmentId: department.id,
        departmentLabel: department.label,
        departmentValue: department.value,
        doctors
      };
    })
  );

  return sections.filter((section) => section.doctors.length > 0);
}
