import type { PrescriptionExtractedData, PrescriptionItem, PrescriptionStatus } from './types';

export function formatPrescriptionDate(iso: string): string {
  const raw = String(iso ?? '').trim();
  if (!raw) return '—';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function prescriptionStatusLabel(
  status: PrescriptionStatus,
  t: (key: string) => string
): string {
  const key = `prescriptions.status.${status}`;
  const translated = t(key);
  return translated === key ? status : translated;
}

function mergedExtracted(item: PrescriptionItem): PrescriptionExtractedData {
  const ex = item.extractedData ?? {};
  return {
    ...ex,
    patientName: item.patientName ?? ex.patientName,
    doctorName: item.doctorName ?? ex.doctorName ?? ex.consultant,
    diagnosis: item.sharedDiagnosis?.trim() || ex.diagnosis
  };
}

export function prescriptionCardTitle(item: PrescriptionItem): string {
  const ex = mergedExtracted(item);
  if (ex.diagnosis?.trim()) return ex.diagnosis.trim();
  if (ex.doctorName?.trim()) return ex.doctorName.trim();
  if (ex.patientName?.trim()) return ex.patientName.trim();
  return 'Prescription';
}

export type PrescriptionCardFields = {
  title: string;
  doctorName: string;
  patientName: string;
  dateLabel: string;
  medicinesLine: string;
  status: PrescriptionStatus;
};

export function buildPrescriptionCardFields(
  item: PrescriptionItem,
  notAvailable: string
): PrescriptionCardFields {
  const ex = mergedExtracted(item);
  const medicines = (ex.medicines ?? []).map((m) => String(m).trim()).filter(Boolean);
  const dateRaw =
    ex.prescriptionDate?.trim() ||
    ex.appointmentDate?.trim() ||
    item.createdAt?.trim() ||
    '';

  return {
    title: prescriptionCardTitle(item),
    doctorName: ex.doctorName?.trim() || notAvailable,
    patientName: ex.patientName?.trim() || notAvailable,
    dateLabel: dateRaw ? formatPrescriptionDate(dateRaw) : notAvailable,
    medicinesLine: formatMedicinesLine(medicines, notAvailable),
    status: item.status
  };
}

export function formatMedicinesLine(medicines: string[], notAvailable: string, maxShown = 3): string {
  if (!medicines.length) return notAvailable;
  const shown = medicines.slice(0, maxShown);
  const rest = medicines.length - shown.length;
  const base = shown.join(' · ');
  return rest > 0 ? `${base} · +${rest} more` : base;
}
