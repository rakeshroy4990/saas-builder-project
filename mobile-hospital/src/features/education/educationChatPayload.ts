export type EducationChatTurn = { role: 'user' | 'assistant'; content: string };

export function buildEducationChatPayload(
  question: string,
  bookNames: string[],
  history: EducationChatTurn[],
  conversationId: string,
  retrievalQuestion?: string
): Record<string, unknown> {
  const retrievalSeed = String(retrievalQuestion ?? '').trim() || question;
  const payload: Record<string, unknown> = {
    Message: question,
    History: history.map((h) => ({ Role: h.role, Content: h.content })),
    ConversationId: conversationId,
    RetrievalQuestion: retrievalSeed
  };
  const normalized = bookNames.map((b) => String(b ?? '').trim()).filter(Boolean);
  if (normalized.length > 0) {
    payload.BookNames = normalized;
    if (normalized.length === 1) payload.BookName = normalized[0];
  }
  return payload;
}
