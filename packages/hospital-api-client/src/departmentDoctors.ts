import { parsePublicDoctorProfile, type PublicDoctorProfile } from './doctorProfileImage';

/**
 * Loads doctors by calling GET /api/doctor/get once per department code/name, deduped by doctor id.
 */
export async function loadDoctorsAcrossDepartments(options: {
  departments: string[];
  fetchDoctorsByDepartment: (department: string) => Promise<unknown[]>;
  cloudinaryBase?: string;
}): Promise<PublicDoctorProfile[]> {
  const seen = new Set<string>();
  const results: PublicDoctorProfile[] = [];

  for (const department of options.departments) {
    const normalized = String(department ?? '').trim();
    if (!normalized) continue;

    const rows = await options.fetchDoctorsByDepartment(normalized);
    rows.forEach((item, index) => {
      const profile = parsePublicDoctorProfile(item, index, options.cloudinaryBase);
      if (profile && !seen.has(profile.id)) {
        seen.add(profile.id);
        results.push(profile);
      }
    });
  }

  return results;
}
