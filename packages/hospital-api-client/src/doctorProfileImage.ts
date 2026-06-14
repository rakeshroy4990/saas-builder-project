/** Neutral user silhouette when a doctor has no profile photo. */
export const USER_SKETCH_IMAGE_DATA_URL =
  'data:image/svg+xml;charset=UTF-8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Doctor">' +
      '<rect width="64" height="64" rx="12" fill="#ecfdf5"/>' +
      '<circle cx="32" cy="24" r="10" fill="#94a3b8"/>' +
      '<path d="M14 54c0-10 8-16 18-16s18 6 18 16" fill="#94a3b8"/>' +
      '</svg>'
  );

const DEFAULT_CLOUDINARY_IMAGE_BASE_URL = 'https://res.cloudinary.com/dbke33vfd/image/upload';

/**
 * Resolves a doctor profile image to a display URL.
 * Empty values return the user-sketch placeholder; Cloudinary public IDs are prefixed with `baseUrl`.
 */
export function resolveDoctorProfileImage(
  src: string | undefined | null,
  baseUrl: string = DEFAULT_CLOUDINARY_IMAGE_BASE_URL
): string {
  const trimmed = String(src ?? '').trim();
  if (!trimmed) {
    return USER_SKETCH_IMAGE_DATA_URL;
  }
  if (/^(blob:|data:)/i.test(trimmed)) {
    return trimmed;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const host = new URL(trimmed).host.toLowerCase();
      if (host.endsWith('res.cloudinary.com')) {
        return trimmed;
      }
    } catch {
      return USER_SKETCH_IMAGE_DATA_URL;
    }
    return USER_SKETCH_IMAGE_DATA_URL;
  }
  const normalizedBase = String(baseUrl ?? DEFAULT_CLOUDINARY_IMAGE_BASE_URL).replace(/\/+$/, '');
  return `${normalizedBase}/${trimmed.replace(/^\/+/, '')}`;
}

/** Strip a trailing department code suffix from a localized label, e.g. `General Pediatrics (PEDS)` → `General Pediatrics`. */
export function localizedDepartmentDisplayName(label: string, code?: string): string {
  const trimmed = String(label ?? '').trim();
  const normalizedCode = String(code ?? '').trim();
  if (!normalizedCode) return trimmed;
  const suffix = `(${normalizedCode})`;
  if (trimmed.endsWith(suffix)) {
    return trimmed.slice(0, trimmed.length - suffix.length).trim();
  }
  return trimmed;
}

export type PublicDoctorProfile = {
  id: string;
  name: string;
  email: string;
  department: string;
  speciality: string;
  qualifications: string;
  experienceSummary: string;
  profilePic: string;
  imageUrl: string;
};

function pickString(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
}

export function parsePublicDoctorProfile(
  item: unknown,
  index: number,
  cloudinaryBase?: string
): PublicDoctorProfile | null {
  const record = (item ?? {}) as Record<string, unknown>;
  const id = pickString(record, ['Id', 'id']).trim() || `doctor-${index}`;
  const firstName = pickString(record, ['FirstName', 'firstName']);
  const lastName = pickString(record, ['LastName', 'lastName']);
  const name =
    pickString(record, ['Name', 'name']).trim() ||
    [firstName, lastName].filter(Boolean).join(' ').trim() ||
    id;
  if (!name.trim()) return null;
  const profilePic = pickString(record, ['ProfilePic', 'profilePic']).trim();
  return {
    id,
    name,
    email: pickString(record, ['Email', 'email']).trim(),
    department: pickString(record, ['Department', 'department']).trim(),
    speciality:
      pickString(record, ['Speciality', 'speciality']).trim() ||
      pickString(record, ['Department', 'department']).trim(),
    qualifications: pickString(record, ['Qualifications', 'qualifications']).trim(),
    experienceSummary: pickString(record, ['ExperienceSummary', 'experienceSummary']).trim(),
    profilePic,
    imageUrl: resolveDoctorProfileImage(profilePic, cloudinaryBase)
  };
}
