import type {
  PrescriptionDosageFinding,
  PrescriptionInteractionFinding,
  PrescriptionRiskLevel,
  PrescriptionValidationResult,
  RecommendedDosageResult
} from './prescriptionSafetyTypes';

function pickString(obj: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const v = obj[key];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return undefined;
}

function pickNumber(obj: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) {
    const v = obj[key];
    if (v == null || v === '') continue;
    const num = Number(v);
    if (Number.isFinite(num)) return num;
  }
  return null;
}

function pickBool(obj: Record<string, unknown>, ...keys: string[]): boolean | null {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === 'boolean') return v;
  }
  return null;
}

function parseInteraction(row: Record<string, unknown>): PrescriptionInteractionFinding {
  return {
    drugA: pickString(row, 'DrugA', 'drugA') ?? '',
    drugB: pickString(row, 'DrugB', 'drugB') ?? '',
    severity: pickString(row, 'Severity', 'severity') ?? '',
    mechanism: pickString(row, 'Mechanism', 'mechanism') ?? '',
    clinicalEffect: pickString(row, 'ClinicalEffect', 'clinicalEffect') ?? '',
    management: pickString(row, 'Management', 'management') ?? '',
    source: pickString(row, 'Source', 'source') ?? '',
    drugsFrom: pickString(row, 'DrugsFrom', 'drugsFrom') ?? ''
  };
}

function parseDosage(row: Record<string, unknown>): PrescriptionDosageFinding {
  const rangeRaw = row.ExpectedDoseRangeMg ?? row.expectedDoseRangeMg;
  const range = Array.isArray(rangeRaw)
    ? rangeRaw.map((v) => Number(v)).filter((n) => Number.isFinite(n))
    : null;
  return {
    genericName: pickString(row, 'GenericName', 'genericName') ?? '',
    status: pickString(row, 'Status', 'status') ?? '',
    prescribedDoseMg: pickNumber(row, 'PrescribedDoseMg', 'prescribedDoseMg'),
    expectedDoseRangeMg: range,
    prescribedDailyTotalMg: pickNumber(row, 'PrescribedDailyTotalMg', 'prescribedDailyTotalMg'),
    maxSafeDailyMg: pickNumber(row, 'MaxSafeDailyMg', 'maxSafeDailyMg'),
    ageAppropriate: pickBool(row, 'AgeAppropriate', 'ageAppropriate'),
    message: pickString(row, 'Message', 'message') ?? ''
  };
}

export function parsePrescriptionValidation(data: unknown): PrescriptionValidationResult | null {
  if (!data || typeof data !== 'object') return null;
  const row = data as Record<string, unknown>;
  const externalId = pickString(row, 'ExternalId', 'externalId');
  if (!externalId) return null;
  const interactions = (row.InteractionFindings ?? row.interactionFindings) as unknown;
  const dosages = (row.DosageFindings ?? row.dosageFindings) as unknown;
  const unrecognized = (row.UnrecognizedDrugs ?? row.unrecognizedDrugs) as unknown;
  return {
    externalId,
    prescriptionSource: pickString(row, 'PrescriptionSource', 'prescriptionSource') ?? '',
    patientPrescriptionExternalId:
      pickString(row, 'PatientPrescriptionExternalId', 'patientPrescriptionExternalId') ?? null,
    overallRiskLevel: (pickString(row, 'OverallRiskLevel', 'overallRiskLevel') ?? 'none') as PrescriptionRiskLevel,
    weightSource: pickString(row, 'WeightSource', 'weightSource') ?? '',
    childWeightKgUsed: pickNumber(row, 'ChildWeightKgUsed', 'childWeightKgUsed'),
    llmSummary: pickString(row, 'LlmSummary', 'llmSummary') ?? '',
    unrecognizedDrugs: Array.isArray(unrecognized) ? unrecognized.map((v) => String(v)) : [],
    interactionFindings: Array.isArray(interactions)
      ? interactions.map((item) => parseInteraction(item as Record<string, unknown>))
      : [],
    dosageFindings: Array.isArray(dosages)
      ? dosages.map((item) => parseDosage(item as Record<string, unknown>))
      : [],
    reviewedByDoctor: Boolean(row.ReviewedByDoctor ?? row.reviewedByDoctor),
    reviewedAt: pickString(row, 'ReviewedAt', 'reviewedAt') ?? null,
    createdAt: pickString(row, 'CreatedAt', 'createdAt') ?? null,
    childAgeMonthsUsed: pickNumber(row, 'ChildAgeMonthsUsed', 'childAgeMonthsUsed'),
    temperatureFUsed: pickNumber(row, 'TemperatureFUsed', 'temperatureFUsed')
  };
}

export function parseDoctorValidation(data: unknown): PrescriptionValidationResult | null {
  const parsed = parsePrescriptionValidation(data);
  if (!parsed) return null;
  if (!parsed.externalId) {
    return { ...parsed, externalId: 'doctor-tool' };
  }
  return parsed;
}

export function parseRecommendedDosage(data: unknown): RecommendedDosageResult | null {
  if (!data || typeof data !== 'object') return null;
  const row = data as Record<string, unknown>;
  const rangeRaw = row.ExpectedDoseRangeMg ?? row.expectedDoseRangeMg;
  const range = Array.isArray(rangeRaw)
    ? rangeRaw.map((v) => Number(v)).filter((n) => Number.isFinite(n))
    : [];
  return {
    extractedName: pickString(row, 'ExtractedName', 'extractedName') ?? '',
    genericName: pickString(row, 'GenericName', 'genericName') ?? '',
    status: pickString(row, 'Status', 'status') ?? '',
    childWeightKg: pickNumber(row, 'ChildWeightKg', 'childWeightKg'),
    childAgeMonths: pickNumber(row, 'ChildAgeMonths', 'childAgeMonths'),
    route: pickString(row, 'Route', 'route') ?? 'oral',
    dosePerKgMg: pickNumber(row, 'DosePerKgMg', 'dosePerKgMg'),
    expectedDoseRangeMg: range,
    maxSingleDoseMg: pickNumber(row, 'MaxSingleDoseMg', 'maxSingleDoseMg'),
    maxDailyDoseMg: pickNumber(row, 'MaxDailyDoseMg', 'maxDailyDoseMg'),
    frequencyPerDayMin: pickNumber(row, 'FrequencyPerDayMin', 'frequencyPerDayMin'),
    frequencyPerDayMax: pickNumber(row, 'FrequencyPerDayMax', 'frequencyPerDayMax'),
    source: pickString(row, 'Source', 'source') ?? '',
    message: pickString(row, 'Message', 'message') ?? ''
  };
}

export function riskBadgeColors(level: PrescriptionRiskLevel): { bg: string; text: string; border: string } {
  switch (level) {
    case 'critical':
      return { bg: '#ffe4e6', text: '#9f1239', border: '#fda4af' };
    case 'high':
      return { bg: '#ffedd5', text: '#9a3412', border: '#fdba74' };
    case 'moderate':
      return { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' };
    case 'low':
      return { bg: '#ecfdf5', text: '#065f46', border: '#a7f3d0' };
    default:
      return { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0' };
  }
}
