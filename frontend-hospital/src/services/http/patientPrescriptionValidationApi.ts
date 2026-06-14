import { apiClient } from './apiClient';
import { SERVER_PATHS } from './apiPaths';

export type PrescriptionRiskLevel = 'none' | 'low' | 'moderate' | 'high' | 'critical';

export type PrescriptionInteractionFinding = {
  drugA: string;
  drugB: string;
  severity: string;
  mechanism: string;
  clinicalEffect: string;
  management: string;
  source: string;
  drugsFrom: string;
};

export type PrescriptionDosageFinding = {
  genericName: string;
  status: string;
  prescribedDoseMg: number | null;
  expectedDoseRangeMg: number[] | null;
  prescribedDailyTotalMg: number | null;
  maxSafeDailyMg: number | null;
  ageAppropriate: boolean | null;
  message: string;
};

export type PrescriptionValidationResult = {
  externalId: string;
  prescriptionSource: string;
  patientPrescriptionExternalId: string | null;
  overallRiskLevel: PrescriptionRiskLevel;
  weightSource: string;
  childWeightKgUsed: number | null;
  llmSummary: string;
  unrecognizedDrugs: string[];
  interactionFindings: PrescriptionInteractionFinding[];
  dosageFindings: PrescriptionDosageFinding[];
  reviewedByDoctor: boolean;
  reviewedAt: string | null;
  createdAt: string | null;
  childAgeMonthsUsed: number | null;
  temperatureFUsed: number | null;
};

function readEnvelope<T>(data: unknown): T {
  const root = data as Record<string, unknown>;
  const ok = Boolean(root?.success ?? root?.Success);
  if (!ok) {
    const msg = String(root?.message ?? root?.Message ?? 'Request failed').trim();
    throw new Error(msg || 'Request failed');
  }
  return (root?.data ?? root?.Data) as T;
}

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

function parseValidation(data: unknown): PrescriptionValidationResult | null {
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
    patientPrescriptionExternalId: pickString(row, 'PatientPrescriptionExternalId', 'patientPrescriptionExternalId') ?? null,
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

export async function getPrescriptionValidation(externalId: string): Promise<PrescriptionValidationResult | null> {
  const { data } = await apiClient.get(`${SERVER_PATHS.patientPrescriptions}/${externalId}/validation`);
  return parseValidation(readEnvelope<unknown>(data));
}

export async function revalidatePrescription(externalId: string): Promise<PrescriptionValidationResult | null> {
  const { data } = await apiClient.post(`${SERVER_PATHS.patientPrescriptions}/${externalId}/validation/revalidate`);
  return parseValidation(readEnvelope<unknown>(data));
}

export async function reviewPrescriptionValidation(externalId: string): Promise<PrescriptionValidationResult | null> {
  const { data } = await apiClient.post(`${SERVER_PATHS.patientPrescriptions}/${externalId}/validation/review`);
  return parseValidation(readEnvelope<unknown>(data));
}

export function riskBadgeClass(level: PrescriptionRiskLevel): string {
  switch (level) {
    case 'critical':
      return 'bg-rose-100 text-rose-800 ring-rose-300';
    case 'high':
      return 'bg-orange-100 text-orange-800 ring-orange-300';
    case 'moderate':
      return 'bg-amber-100 text-amber-900 ring-amber-300';
    case 'low':
      return 'bg-emerald-50 text-emerald-800 ring-emerald-200';
    default:
      return 'bg-slate-100 text-slate-600 ring-slate-200';
  }
}
