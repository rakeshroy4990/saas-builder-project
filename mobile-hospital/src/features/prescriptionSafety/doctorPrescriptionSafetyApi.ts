import { apiClient } from '@/api/client';
import { SERVER_PATHS, unwrapEnvelope } from '@saas-builder/hospital-api-client';

import { parseDoctorValidation, parseRecommendedDosage, riskBadgeColors } from './prescriptionSafetyParse';
import type {
  DoctorChildContext,
  PrescriptionRiskLevel,
  PrescriptionValidationResult,
  RecommendedDosageResult
} from './prescriptionSafetyTypes';

export type {
  DoctorChildContext,
  PrescriptionDosageFinding,
  PrescriptionInteractionFinding,
  PrescriptionRiskLevel,
  PrescriptionValidationResult,
  RecommendedDosageResult
} from './prescriptionSafetyTypes';

export {
  parseDoctorValidation,
  parsePrescriptionValidation,
  parseRecommendedDosage,
  riskBadgeColors
} from './prescriptionSafetyParse';

export {
  postDoctorPrescriptionValidateUploadStream,
  type DoctorPrescriptionTranscribedPreview,
  type DoctorPrescriptionValidateUploadStreamHandlers
} from './doctorPrescriptionSafetyValidateUploadStream';

export {
  postDoctorPrescriptionTranscribeUploadStream,
  type DoctorPrescriptionTranscribeResult,
  type DoctorPrescriptionTranscribeUploadStreamHandlers
} from './doctorPrescriptionSafetyTranscribeUploadStream';

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
  const response = await apiClient.post(SERVER_PATHS.hospitalEducationPrescriptionSafetyValidate, body);
  return parseDoctorValidation(unwrapEnvelope<unknown>(response.data));
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
  const response = await apiClient.post(SERVER_PATHS.hospitalEducationPrescriptionSafetyRecommendedDosage, body);
  return parseRecommendedDosage(unwrapEnvelope<unknown>(response.data));
}

export function riskBadgeStyle(level: PrescriptionRiskLevel): { backgroundColor: string; color: string } {
  const colors = riskBadgeColors(level);
  return { backgroundColor: colors.bg, color: colors.text };
}
