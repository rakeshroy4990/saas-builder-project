import { apiClient } from './apiClient';
import { SERVER_PATHS } from './apiPaths';
import {
  riskBadgeClass,
  type PrescriptionDosageFinding,
  type PrescriptionInteractionFinding,
  type PrescriptionRiskLevel,
  type PrescriptionValidationResult
} from './patientPrescriptionValidationApi';

export type RecommendedDosageResult = {
  extractedName: string;
  genericName: string;
  status: string;
  childWeightKg: number | null;
  childAgeMonths: number | null;
  route: string;
  dosePerKgMg: number | null;
  expectedDoseRangeMg: number[];
  maxSingleDoseMg: number | null;
  maxDailyDoseMg: number | null;
  frequencyPerDayMin: number | null;
  frequencyPerDayMax: number | null;
  source: string;
  message: string;
};

export type DoctorChildContext = {
  childAgeMonths?: number;
  childWeightKg?: number;
  childProfileExternalId?: string;
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

export function parseDoctorValidation(data: unknown): PrescriptionValidationResult | null {
  if (!data || typeof data !== 'object') return null;
  const row = data as Record<string, unknown>;
  const interactions = (row.InteractionFindings ?? row.interactionFindings) as unknown;
  const dosages = (row.DosageFindings ?? row.dosageFindings) as unknown;
  const unrecognized = (row.UnrecognizedDrugs ?? row.unrecognizedDrugs) as unknown;
  return {
    externalId: pickString(row, 'ExternalId', 'externalId') ?? 'doctor-tool',
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

function parseRecommendedDosage(data: unknown): RecommendedDosageResult | null {
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

function appendChildContext(formData: FormData, ctx: DoctorChildContext): void {
  if (ctx.childProfileExternalId?.trim()) {
    formData.append('childProfileExternalId', ctx.childProfileExternalId.trim());
  }
  if (ctx.childAgeMonths != null && Number.isFinite(ctx.childAgeMonths)) {
    formData.append('childAgeMonths', String(ctx.childAgeMonths));
  }
  if (ctx.childWeightKg != null && Number.isFinite(ctx.childWeightKg)) {
    formData.append('childWeightKg', String(ctx.childWeightKg));
  }
}

export async function validateDoctorPrescriptionFromSummary(opts: {
  prescriptionSummary: string;
  childWeightKg?: number | null;
  childAgeMonths?: number | null;
  temperatureF?: number | null;
  weightSource?: string;
  childProfileExternalId?: string;
}): Promise<PrescriptionValidationResult | null> {
  const body: Record<string, unknown> = {
    PrescriptionSummary: opts.prescriptionSummary.trim()
  };
  if (opts.childWeightKg != null && Number.isFinite(opts.childWeightKg)) {
    body.ChildWeightKg = opts.childWeightKg;
  }
  if (opts.childAgeMonths != null && Number.isFinite(opts.childAgeMonths)) {
    body.ChildAgeMonths = opts.childAgeMonths;
  }
  if (opts.temperatureF != null && Number.isFinite(opts.temperatureF)) {
    body.TemperatureF = opts.temperatureF;
  }
  if (opts.weightSource?.trim()) {
    body.WeightSource = opts.weightSource.trim();
  }
  if (opts.childProfileExternalId?.trim()) {
    body.ChildProfileExternalId = opts.childProfileExternalId.trim();
  }
  const { data } = await apiClient.post<unknown>(SERVER_PATHS.hospitalEducationPrescriptionSafetyValidate, body);
  return parseDoctorValidation(readEnvelope<unknown>(data));
}

export async function validateDoctorPrescriptionUpload(
  file: File,
  ctx: DoctorChildContext
): Promise<PrescriptionValidationResult | null> {
  const formData = new FormData();
  formData.append('file', file);
  appendChildContext(formData, ctx);
  const { data } = await apiClient.post<unknown>(SERVER_PATHS.hospitalEducationPrescriptionSafetyValidateUpload, formData);
  return parseDoctorValidation(readEnvelope<unknown>(data));
}

export async function recommendDoctorPediatricDosage(opts: {
  drugName: string;
  route?: string;
  childAgeMonths: number;
  childWeightKg?: number;
  childProfileExternalId?: string;
}): Promise<RecommendedDosageResult | null> {
  const body: Record<string, unknown> = {
    DrugName: opts.drugName.trim(),
    ChildAgeMonths: opts.childAgeMonths,
    Route: opts.route?.trim() || 'oral'
  };
  if (opts.childWeightKg != null && Number.isFinite(opts.childWeightKg)) {
    body.ChildWeightKg = opts.childWeightKg;
  }
  if (opts.childProfileExternalId?.trim()) {
    body.ChildProfileExternalId = opts.childProfileExternalId.trim();
  }
  const { data } = await apiClient.post<unknown>(SERVER_PATHS.hospitalEducationPrescriptionSafetyRecommendedDosage, body);
  return parseRecommendedDosage(readEnvelope<unknown>(data));
}

export { riskBadgeClass };
