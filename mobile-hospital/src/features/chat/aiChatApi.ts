import { SERVER_PATHS, unwrapEnvelope } from '@saas-builder/hospital-api-client';

import { apiClient } from '@/api/client';

export type ChatTurn = { role: 'user' | 'assistant'; content: string };

export async function sendAiChatMessage(message: string, history: ChatTurn[]): Promise<string> {
  const response = await apiClient.post(
    SERVER_PATHS.hospitalAiChat,
    {
      message,
      conversationId: null,
      history: history.map((h) => ({ role: h.role, content: h.content }))
    },
    {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      timeout: 120_000
    }
  );
  const data = unwrapEnvelope<Record<string, unknown>>(response.data);
  const reply = String(data.reply ?? data.Reply ?? '').trim();
  if (!reply) {
    throw new Error('Empty AI response');
  }
  return reply;
}
