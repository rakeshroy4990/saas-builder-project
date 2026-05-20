export type PatientPrescriptionSimilarityDetails = {
  diagnosis: string;
  medicines: string[];
  dosage: string[];
  advice: string[];
  notes: string;
};

export type PatientPrescriptionSimilaritySectionScore = {
  section: string;
  matchPercent: number;
};

export type PatientPrescriptionSimilarityHit = {
  externalId: string;
  matchPercent: number;
  status: string;
  patientName: string;
  doctorName: string;
  department: string;
  gender: string;
  searchText: string;
  details: PatientPrescriptionSimilarityDetails;
  sectionBreakdown: PatientPrescriptionSimilaritySectionScore[];
  createdAt: string;
};

function mapDetails(raw: unknown): PatientPrescriptionSimilarityDetails {
  const item = (raw ?? {}) as Record<string, unknown>;
  const medicinesRaw = item.medicines ?? item.Medicines;
  const dosageRaw = item.dosage ?? item.Dosage;
  const adviceRaw = item.advice ?? item.Advice;
  const toList = (value: unknown): string[] => {
    if (!Array.isArray(value)) return [];
    return value.map((entry) => String(entry ?? '').trim()).filter(Boolean);
  };
  return {
    diagnosis: String(item.diagnosis ?? item.Diagnosis ?? '').trim(),
    medicines: toList(medicinesRaw),
    dosage: toList(dosageRaw),
    advice: toList(adviceRaw),
    notes: String(item.notes ?? item.Notes ?? '').trim()
  };
}

function hasStructuredDetails(details: PatientPrescriptionSimilarityDetails): boolean {
  return Boolean(
    details.diagnosis ||
      details.medicines.length ||
      details.dosage.length ||
      details.advice.length ||
      details.notes
  );
}

export function mapPatientPrescriptionSimilarityHit(item: Record<string, unknown>): PatientPrescriptionSimilarityHit {
  const searchText = String(item.searchText ?? item.search_text ?? '').trim();
  let details = mapDetails(item.details ?? item.Details);
  if (!hasStructuredDetails(details) && searchText) {
    details = { diagnosis: searchText, medicines: [], dosage: [], advice: [], notes: '' };
  }
  const breakdownRaw = item.sectionBreakdown ?? item.section_breakdown ?? item.SectionBreakdown;
  const sectionBreakdown = Array.isArray(breakdownRaw)
    ? breakdownRaw.map((row) => {
        const score = (row ?? {}) as Record<string, unknown>;
        return {
          section: String(score.section ?? '').trim(),
          matchPercent: Number(score.matchPercent ?? score.match_percent ?? 0) || 0
        };
      })
    : [];
  return {
    externalId: String(item.externalId ?? item.external_id ?? '').trim(),
    matchPercent: Number(item.matchPercent ?? item.match_percent ?? 0) || 0,
    status: String(item.status ?? '').trim(),
    patientName: String(item.patientName ?? item.patient_name ?? '').trim(),
    doctorName: String(item.doctorName ?? item.doctor_name ?? '').trim(),
    department: String(item.department ?? '').trim(),
    gender: String(item.gender ?? item.patient_gender ?? '').trim(),
    searchText,
    details,
    sectionBreakdown,
    createdAt: String(item.createdAt ?? item.created_at ?? '').trim()
  };
}

export function readPatientPrescriptionSimilarityEnvelope(data: unknown): PatientPrescriptionSimilarityHit[] {
  const root = data as Record<string, unknown>;
  const ok = Boolean(root?.success ?? root?.Success);
  if (!ok) {
    const msg = String(root?.message ?? root?.Message ?? 'Similarity search failed').trim();
    const code = String(root?.errorCode ?? root?.ErrorCode ?? '').trim();
    const err = new Error(msg || 'Similarity search failed');
    if (code) (err as Error & { code?: string }).code = code;
    throw err;
  }
  const inner = root?.data ?? root?.Data;
  if (!Array.isArray(inner)) return [];
  return inner.map((row) => mapPatientPrescriptionSimilarityHit((row ?? {}) as Record<string, unknown>));
}
