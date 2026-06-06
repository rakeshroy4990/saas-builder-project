export type PrescriptionStatus = 'pending' | 'processing' | 'verified' | 'rejected';

export type PrescriptionExtractedData = {
  patientName?: string;
  doctorName?: string;
  consultant?: string;
  diagnosis?: string;
  medicines?: string[];
  prescriptionDate?: string;
  appointmentDate?: string;
  department?: string;
};

export type PrescriptionItem = {
  id: string;
  status: PrescriptionStatus;
  createdAt: string;
  mimeType: string;
  doctorName?: string;
  patientName?: string;
  department?: string;
  sharedDiagnosis?: string;
  extractedData?: PrescriptionExtractedData;
};

export type PrescriptionUploadResult = {
  externalId: string;
  isDuplicate: boolean;
  status: string;
};

export type PrescriptionTab = 'view' | 'upload';
