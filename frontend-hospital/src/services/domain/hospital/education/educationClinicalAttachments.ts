export type EducationClinicalAttachment = {
  id: string;
  name: string;
  retrievalText: string;
};

const DEFAULT_RETRIEVAL_MAX_CHARS = 7000;
const DEFAULT_DISPLAY_MAX_CHARS = 12000;

export function normalizeEducationClinicalAttachments(raw: unknown): EducationClinicalAttachment[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      const item = (row ?? {}) as Record<string, unknown>;
      const id = String(item.id ?? '').trim();
      const name = String(item.name ?? '').trim() || 'attachment';
      const retrievalText = String(item.retrievalText ?? '').trim();
      if (!id || !retrievalText) return null;
      return { id, name, retrievalText };
    })
    .filter((row): row is EducationClinicalAttachment => row !== null);
}

function formatAttachmentRetrievalSections(rows: EducationClinicalAttachment[]): string {
  return rows
    .map((row) => `[Attached file: ${row.name}]\n${row.retrievalText}`.trim())
    .join('\n\n');
}

/** Doctor bubble: extracted clinical text only (no file names). */
function formatAttachmentDisplaySections(rows: EducationClinicalAttachment[]): string {
  return rows
    .map((row) => row.retrievalText.trim())
    .filter(Boolean)
    .join('\n\n');
}

/** Strip legacy `[Attached file: …]` lines from stored bubble text. */
export function stripEducationAttachedFileHeaders(text: string): string {
  return String(text ?? '')
    .replace(/^\[Attached file:[^\]]+\]\s*\n?/gim, '')
    .trim();
}

/** Full retrieval seed sent to the chat API (question + file text in order). */
export function buildEducationRetrievalQuestionWithAttachments(
  question: string,
  rows: EducationClinicalAttachment[],
  maxChars = DEFAULT_RETRIEVAL_MAX_CHARS
): string {
  const q = String(question ?? '').trim();
  if (!rows.length) return q;
  const sections = formatAttachmentRetrievalSections(rows);
  return `${q}\n\nClinical context from attached files:\n${sections}`.slice(0, maxChars).trim();
}

/** Text shown in the Doctor (user) bubble after files are confirmed / sent. */
export function buildEducationAttachmentDisplayContent(
  question: string,
  rows: EducationClinicalAttachment[],
  opts?: { autoQuestion?: string; maxChars?: number }
): string {
  const q = String(question ?? '').trim();
  const maxChars = opts?.maxChars ?? DEFAULT_DISPLAY_MAX_CHARS;
  if (!rows.length) return q.slice(0, maxChars).trim();
  const sections = formatAttachmentDisplaySections(rows);
  const autoQuestion = String(opts?.autoQuestion ?? '').trim();
  const body =
    autoQuestion && q === autoQuestion ? sections : q ? `${q}\n\n${sections}` : sections;
  return body.slice(0, maxChars).trim();
}
