/**
 * Normalizes assistant payloads that sometimes arrive as one JSON blob (including
 * invalid JSON where `";` is used between properties instead of `",`).
 * Mirrors frontend-hospital educationAssistantPayload.ts.
 */

function normalizeJsonQuotes(text: string): string {
  return text.replace(/\u201c|\u201d/g, '"').replace(/\u2018|\u2019/g, "'");
}

function sliceOuterJsonObject(text: string): string {
  const t = normalizeJsonQuotes(text.trim());
  const start = t.indexOf('{');
  if (start < 0) return t;
  const end = t.lastIndexOf('}');
  if (end <= start) return t.slice(start);
  return t.slice(start, end + 1);
}

export function repairSemicolonBetweenJsonKeys(raw: string): string {
  return raw.replace(
    /"\s*;(\r?\n[\t ]*)"(follow_up_questions|followUpQuestions|FollowUpQuestions)(\s*:)/g,
    '",$1"$2"$3'
  );
}

function readJsonStringForKey(blob: string): string | null {
  const re = /"answer"\s*:\s*"/i;
  const m = re.exec(blob);
  if (!m) return null;
  let i = m.index + m[0].length;
  let out = '';
  while (i < blob.length) {
    const c = blob[i]!;
    if (c === '\\') {
      if (i + 1 < blob.length) {
        const n = blob[i + 1]!;
        if (n === 'n') out += '\n';
        else if (n === 'r') out += '\r';
        else if (n === 't') out += '\t';
        else if (n === '"') out += '"';
        else if (n === '\\') out += '\\';
        else out += n;
        i += 2;
        continue;
      }
      i += 1;
      continue;
    }
    if (c === '"') return out;
    out += c;
    i += 1;
  }
  const partial = out.trim();
  return partial ? partial : null;
}

function readStringArrayForFollowUps(blob: string): string[] {
  const re = /"(follow_up_questions|followUpQuestions|FollowUpQuestions)"\s*:\s*\[/;
  const m = re.exec(blob);
  if (!m) return [];
  let i = m.index + m[0].length;
  const out: string[] = [];
  while (i < blob.length) {
    while (i < blob.length && /\s|,/.test(blob[i]!)) i += 1;
    if (blob[i] === ']') break;
    if (blob[i] !== '"') {
      i += 1;
      continue;
    }
    i += 1;
    let s = '';
    while (i < blob.length) {
      const c = blob[i]!;
      if (c === '\\') {
        if (i + 1 < blob.length) {
          const n = blob[i + 1]!;
          if (n === 'n') s += '\n';
          else if (n === '"') s += '"';
          else s += n;
          i += 2;
          continue;
        }
        i += 1;
        continue;
      }
      if (c === '"') {
        out.push(s.trim());
        i += 1;
        break;
      }
      s += c;
      i += 1;
    }
  }
  return out.filter(Boolean).slice(0, 6);
}

function extractAssistantFieldsLoosely(blob: string): {
  answer: string;
  followUpQuestions: string[];
} | null {
  const answer = readJsonStringForKey(blob);
  if (!answer?.trim()) return null;
  return { answer: answer.trim(), followUpQuestions: readStringArrayForFollowUps(blob) };
}

export function tryParseEmbeddedAssistantJson(text: string): {
  answer: string;
  followUpQuestions: string[];
} | null {
  const sliced = sliceOuterJsonObject(text);
  if (!sliced.startsWith('{')) return null;
  const looksLikeAssistantBlob =
    /["']answer["']\s*:/i.test(sliced) || /["']Answer["']\s*:/.test(sliced);
  if (!looksLikeAssistantBlob) return null;

  const variants = new Set<string>([sliced, repairSemicolonBetweenJsonKeys(sliced)]);
  const twice = repairSemicolonBetweenJsonKeys(repairSemicolonBetweenJsonKeys(sliced));
  if (twice !== sliced) variants.add(twice);

  for (const candidate of variants) {
    try {
      const obj = JSON.parse(candidate) as Record<string, unknown>;
      const answer = String(obj.answer ?? obj.Answer ?? '').trim();
      if (!answer) continue;
      const rawFollowUps =
        obj.followUpQuestions ?? obj.follow_up_questions ?? obj.FollowUpQuestions;
      const followUpQuestions = Array.isArray(rawFollowUps)
        ? rawFollowUps.map((item) => String(item ?? '').trim()).filter(Boolean).slice(0, 6)
        : [];
      return { answer, followUpQuestions };
    } catch {
      // try next variant
    }
  }
  return extractAssistantFieldsLoosely(sliced);
}

export function assistantDisplayBody(content: string): string {
  const parsed = tryParseEmbeddedAssistantJson(content);
  return parsed?.answer ?? content;
}

export function assistantDisplayFollowUps(content: string, existing: string[] | undefined): string[] {
  if (existing && existing.length > 0) return existing;
  const parsed = tryParseEmbeddedAssistantJson(content);
  return parsed?.followUpQuestions ?? [];
}
