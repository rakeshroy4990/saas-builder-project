import { apiClient } from '@/api/client';
import { SERVER_PATHS, unwrapEnvelope } from '@saas-builder/hospital-api-client';

import {
  parsePrescriptionValidation,
  riskBadgeColors,
  type PrescriptionRiskLevel,
  type PrescriptionValidationResult
} from '@/features/prescriptionSafety/doctorPrescriptionSafetyApi';

export type PrescriptionValidation = PrescriptionValidationResult;

export type {
  PrescriptionDosageFinding,
  PrescriptionInteractionFinding,
  PrescriptionRiskLevel,
  PrescriptionValidationResult
} from '@/features/prescriptionSafety/doctorPrescriptionSafetyApi';

export { riskBadgeColors };

export async function fetchPrescriptionValidation(externalId: string): Promise<PrescriptionValidation | null> {
  const response = await apiClient.get(`${SERVER_PATHS.patientPrescriptions}/${externalId}/validation`);
  return parsePrescriptionValidation(unwrapEnvelope<unknown>(response.data));
}

export async function revalidatePrescription(externalId: string): Promise<PrescriptionValidation | null> {
  const response = await apiClient.post(
    `${SERVER_PATHS.patientPrescriptions}/${externalId}/validation/revalidate`
  );
  return parsePrescriptionValidation(unwrapEnvelope<unknown>(response.data));
}

export async function reviewPrescriptionValidation(externalId: string): Promise<PrescriptionValidation | null> {
  const response = await apiClient.post(`${SERVER_PATHS.patientPrescriptions}/${externalId}/validation/review`);
  return parsePrescriptionValidation(unwrapEnvelope<unknown>(response.data));
}
