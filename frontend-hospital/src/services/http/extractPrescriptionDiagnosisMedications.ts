export type PrescriptionDiagnosisMedications = {
  diagnosis: string;
  medications: string;
};

/**
 * Pull Diagnosis / Medications blocks from OCR or narrative prescription text (legacy `Data.text` API).
 */
export function extractDiagnosisMedicationsFromPlainText(raw: string): PrescriptionDiagnosisMedications {
  const text = raw.replace(/\r\n/g, '\n').trim();
  if (!text) {
    return { diagnosis: 'Not stated', medications: 'Not stated' };
  }

  const medSep = text.match(/\n\s*Medications\s*:\s*/i);
  let diagnosis = '';
  let medications = '';

  if (medSep && medSep.index !== undefined) {
    const head = text.slice(0, medSep.index);
    const medContentStart = medSep.index + medSep[0].length;
    medications = text.slice(medContentStart).trim();
    const diagMatch = head.match(/\bDiagnosis\s*:\s*([\s\S]*?)$/i);
    if (diagMatch) {
      diagnosis = diagMatch[1].trim();
    }
  } else {
    const diagMatch = text.match(/\bDiagnosis\s*:\s*([\s\S]*)$/i);
    if (diagMatch) {
      diagnosis = diagMatch[1].trim();
    }
  }

  medications = medications
    .replace(/\n\s*Prescriber signature\s*:\s*[\s\S]*$/i, '')
    .replace(/\n\s*(?:Doctor|Physician)\s+signature\s*:\s*[\s\S]*$/i, '')
    .trim();

  return {
    diagnosis: diagnosis || 'Not stated',
    medications: medications || 'Not stated'
  };
}
