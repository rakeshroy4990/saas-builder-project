import { SERVER_PATHS } from '@saas-builder/hospital-api-client';

import { postHospitalAiChatNdjson } from '@/api/hospitalAiChatStream';

export type ChatTurn = { role: 'user' | 'assistant'; content: string };

export type ChatStreamHandlers = {
  onStatus?: (phase: string) => void;
  onDelta?: (textSoFar: string) => void;
};

export async function sendAiChatMessageStreaming(
  message: string,
  history: ChatTurn[],
  handlers: ChatStreamHandlers = {}
): Promise<string> {
  let textSoFar = '';
  const reply = await postHospitalAiChatNdjson(
    {
      message,
      conversationId: null,
      history: history.map((h) => ({ role: h.role, content: h.content }))
    },
    {
      onStatus: handlers.onStatus,
      onDelta: (chunk) => {
        textSoFar += chunk;
        handlers.onDelta?.(textSoFar);
      }
    },
    { context: 'chat' }
  );
  if (!reply.trim()) {
    throw new Error('Empty AI response');
  }
  return reply;
}

/** @deprecated Use {@link sendAiChatMessageStreaming} for progressive UI. */
export async function sendAiChatMessage(message: string, history: ChatTurn[]): Promise<string> {
  return sendAiChatMessageStreaming(message, history);
}
