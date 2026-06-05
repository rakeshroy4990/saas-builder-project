import { pickReplyFromChatPayload } from '@/api/hospitalAiChatStream';
import {
  assistantDisplayFollowUps,
  tryParseEmbeddedAssistantJson
} from '@/features/education/educationAssistantPayload';

export type EducationChatResult = {
  answer: string;
  followUpQuestions: string[];
};

function normalizeApiPayloadRoot(input: unknown): Record<string, unknown> {
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }
  if (typeof input === 'string') {
    const embedded = tryParseEmbeddedAssistantJson(input);
    if (embedded) {
      return {
        answer: embedded.answer,
        follow_up_questions: embedded.followUpQuestions
      };
    }
  }
  return {};
}

function resolveChatPayloadRow(data: Record<string, unknown>): Record<string, unknown> {
  const hasDirectText = ['reply', 'message', 'answer', 'Answer'].some((key) => {
    const v = data[key];
    return v !== undefined && v !== null && String(v).trim() !== '';
  });
  if (hasDirectText) return data;
  const nested = data.Data ?? data.data;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return nested as Record<string, unknown>;
  }
  return data;
}

function readFollowUpList(row: Record<string, unknown>): string[] {
  const raw = row.followUpQuestions ?? row.follow_up_questions ?? row.FollowUpQuestions;
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => String(item ?? '').trim()).filter(Boolean).slice(0, 6);
}

/** Parse NDJSON `complete` payload (matches web extractConversationResponse for answer + follow-ups). */
export function parseEducationChatComplete(
  completeData: unknown,
  streamedFallback: string
): EducationChatResult {
  const root = normalizeApiPayloadRoot(completeData);
  const row = resolveChatPayloadRow(
    Object.keys(root).length > 0 ? root : { reply: streamedFallback }
  );

  let followUpQuestions = readFollowUpList(row);
  let answer = String(row.reply ?? row.message ?? row.answer ?? row.Answer ?? '').trim();

  const unwrapNested = (text: string): { text: string; extras: string[] } => {
    const embedded = tryParseEmbeddedAssistantJson(text);
    if (!embedded) return { text, extras: [] };
    return { text: embedded.answer, extras: embedded.followUpQuestions };
  };

  let unwrapped = unwrapNested(answer);
  answer = unwrapped.text;
  if (followUpQuestions.length === 0 && unwrapped.extras.length > 0) {
    followUpQuestions = unwrapped.extras;
  }
  if (answer.startsWith('{')) {
    unwrapped = unwrapNested(answer);
    if (unwrapped.extras.length > 0 || unwrapped.text !== answer) {
      answer = unwrapped.text;
      if (followUpQuestions.length === 0 && unwrapped.extras.length > 0) {
        followUpQuestions = unwrapped.extras;
      }
    }
  }

  if (!answer) {
    answer = pickReplyFromChatPayload(root) || streamedFallback.trim();
  }
  if (!answer && completeData && typeof completeData === 'object' && !Array.isArray(completeData)) {
    const d = completeData as Record<string, unknown>;
    answer = String(d.answer ?? d.Answer ?? '').trim();
  }

  if (followUpQuestions.length === 0) {
    followUpQuestions = readFollowUpList(root);
  }
  if (followUpQuestions.length === 0 && completeData && typeof completeData === 'object' && !Array.isArray(completeData)) {
    followUpQuestions = readFollowUpList(completeData as Record<string, unknown>);
  }

  if (followUpQuestions.length === 0) {
    followUpQuestions = assistantDisplayFollowUps(answer, undefined);
  }

  return { answer, followUpQuestions };
}
