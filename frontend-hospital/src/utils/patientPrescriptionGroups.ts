import type { PatientPrescriptionListItem } from '../services/http/patientPrescriptionApi';
import {
  mergeDiagnosisGroupExtractedData,
  mergeMultiPageExtractedData
} from '../services/http/patientPrescriptionApi';

export type PrescriptionDisplayRow =
  | { kind: 'single'; item: PatientPrescriptionListItem }
  | {
      kind: 'group';
      groupExternalId: string;
      groupType?: string;
      sharedDiagnosis?: string;
      pages: PatientPrescriptionListItem[];
    };

export function buildPrescriptionDisplayRows(items: PatientPrescriptionListItem[]): PrescriptionDisplayRow[] {
  const byGroup = new Map<string, PatientPrescriptionListItem[]>();
  const singles: PatientPrescriptionListItem[] = [];
  const seenGroup = new Set<string>();

  for (const item of items) {
    const gid = String(item.groupExternalId ?? '').trim();
    if (!gid) {
      singles.push(item);
      continue;
    }
    const list = byGroup.get(gid) ?? [];
    list.push(item);
    byGroup.set(gid, list);
  }

  const rows: PrescriptionDisplayRow[] = [];
  for (const item of singles) {
    rows.push({ kind: 'single', item });
  }
  for (const [groupExternalId, pages] of byGroup) {
    if (seenGroup.has(groupExternalId)) continue;
    seenGroup.add(groupExternalId);
    const first = pages[0];
    rows.push({
      kind: 'group',
      groupExternalId,
      groupType: first?.groupType,
      sharedDiagnosis: first?.sharedDiagnosis,
      pages: [...pages].sort((a, b) => (a.pageNumber ?? 99) - (b.pageNumber ?? 99))
    });
  }
  rows.sort((a, b) => {
    const aDate = rowCreatedAt(a);
    const bDate = rowCreatedAt(b);
    return bDate.localeCompare(aDate);
  });
  return rows;
}

function rowCreatedAt(row: PrescriptionDisplayRow): string {
  if (row.kind === 'single') return row.item.createdAt;
  return row.pages[0]?.createdAt ?? '';
}

export function rowMergedExtracted(row: PrescriptionDisplayRow) {
  if (row.kind === 'single') return row.item.extractedData;
  if (row.groupType === 'diagnosis') {
    return mergeDiagnosisGroupExtractedData(row.pages, row.sharedDiagnosis);
  }
  return mergeMultiPageExtractedData(row.pages);
}

export function isDiagnosisGroupRow(row: PrescriptionDisplayRow): boolean {
  return row.kind === 'group' && row.groupType === 'diagnosis';
}

export function isMultiPageGroupRow(row: PrescriptionDisplayRow): boolean {
  return row.kind === 'group' && row.groupType !== 'diagnosis';
}

export function rowPrimaryItem(row: PrescriptionDisplayRow): PatientPrescriptionListItem {
  if (row.kind === 'single') return row.item;
  return row.pages.find((p) => p.isPrimaryPage) ?? row.pages[0];
}

export function rowStatus(row: PrescriptionDisplayRow): string {
  if (row.kind === 'single') return row.item.status;
  const statuses = row.pages.map((p) => p.status);
  if (statuses.some((s) => s === 'rejected')) return 'rejected';
  if (statuses.some((s) => s === 'processing')) return 'processing';
  if (statuses.every((s) => s === 'verified')) return 'verified';
  return statuses[0] ?? 'pending';
}
