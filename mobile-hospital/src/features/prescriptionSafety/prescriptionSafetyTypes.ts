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
