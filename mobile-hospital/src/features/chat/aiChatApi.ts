import { isSupportedLocale } from '@saas-builder/i18n-contract';

import { postHospitalAiChatNdjson } from '@/api/hospitalAiChatStream';

export type ChatTurn = { role: 'user' | 'assistant'; content: string };

export type AiChatMetadata = {
  detectedLocale?: string;
  answerEnglish?: string;
  showTranslationToggle?: boolean;
  emergencyCall108?: boolean;
};

export type ChatStreamHandlers = {
  onStatus?: (phase: string) => void;
  onDelta?: (textSoFar: string) => void;
  onComplete?: (data: Record<string, unknown>, metadata: AiChatMetadata) => void;
};

function pickMetadata(data: Record<string, unknown>): AiChatMetadata {
  const detected = String(data.DetectedLocale ?? data.detectedLocale ?? '').trim().toLowerCase();
  return {
    detectedLocale: isSupportedLocale(detected) ? detected : undefined,
    answerEnglish: String(data.AnswerEnglish ?? data.answerEnglish ?? '').trim() || undefined,
    showTranslationToggle: Boolean(data.ShowTranslationToggle ?? data.showTranslationToggle),
    emergencyCall108: Boolean(data.EmergencyCall108 ?? data.emergencyCall108)
  };
}

export async function sendAiChatMessageStreaming(
  message: string,
  history: ChatTurn[],
  handlers: ChatStreamHandlers = {}
): Promise<{ reply: string; metadata: AiChatMetadata }> {
  let textSoFar = '';
  let metadata: AiChatMetadata = {};
  const reply = await postHospitalAiChatNdjson(
    {
      Message: message,
      ConversationId: null,
      History: history.map((h) => ({ Role: h.role, Content: h.content }))
    },
    {
      onStatus: handlers.onStatus,
      onDelta: (chunk) => {
        textSoFar += chunk;
        handlers.onDelta?.(textSoFar);
      },
      onComplete: (data) => {
        metadata = pickMetadata(data);
        handlers.onComplete?.(data, metadata);
      }
    },
    { context: 'chat' }
  );
  if (!reply.trim()) {
    throw new Error('Empty AI response');
  }
  return { reply, metadata };
}

/** @deprecated Use {@link sendAiChatMessageStreaming} for progressive UI. */
export async function sendAiChatMessage(message: string, history: ChatTurn[]): Promise<string> {
  const result = await sendAiChatMessageStreaming(message, history);
  return result.reply;
}
