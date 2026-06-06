import {
  buildPrescriptionCardFields,
  formatMedicinesLine,
  formatPrescriptionDate,
  prescriptionCardTitle
} from '../src/features/prescriptions/prescriptionDisplay';
import type { PrescriptionItem } from '../src/features/prescriptions/types';

describe('prescriptionDisplay', () => {
  const sample: PrescriptionItem = {
    id: 'rx-1',
    status: 'verified',
    createdAt: '2026-05-21T05:16:14.391Z',
    mimeType: 'image/jpeg',
    doctorName: 'Dr. Swati Pandey',
    patientName: 'Rakesh Roy',
    extractedData: {
      diagnosis: 'Mild fever',
      medicines: ['Paracetamol 500mg', 'Vitamin C', 'Zinc tablet', 'Rest']
    }
  };

  it('uses diagnosis as card title when present', () => {
    expect(prescriptionCardTitle(sample)).toBe('Mild fever');
  });

  it('builds card fields with doctor, patient, date, medicines', () => {
    const fields = buildPrescriptionCardFields(sample, '—');
    expect(fields.doctorName).toBe('Dr. Swati Pandey');
    expect(fields.patientName).toBe('Rakesh Roy');
    expect(fields.medicinesLine).toContain('Paracetamol');
    expect(fields.medicinesLine).toContain('+1 more');
    expect(formatPrescriptionDate('2026-05-21T05:16:14.391Z')).not.toBe('—');
  });

  it('formats medicine overflow', () => {
    expect(formatMedicinesLine(['A', 'B', 'C', 'D'], '—', 2)).toBe('A · B · +2 more');
  });
});
