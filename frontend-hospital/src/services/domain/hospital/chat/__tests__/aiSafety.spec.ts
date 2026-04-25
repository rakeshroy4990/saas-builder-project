import { describe, expect, it } from 'vitest';
import { AI_DISCLAIMER_LINE, normalizedAiReply, requiresEscalation } from '../aiSafety';

describe('aiSafety', () => {
  it('detects escalation keywords', () => {
    expect(requiresEscalation('I have chest pain and shortness of breath')).toBe(true);
  });

  it('does not escalate common mild question', () => {
    expect(requiresEscalation('Can I take paracetamol for common cold?')).toBe(false);
  });

  it('always appends disclaimer and non-doctor line', () => {
    const reply = normalizedAiReply('Rest and hydrate.');
    expect(reply.toLowerCase()).toContain('not a doctor');
    expect(reply).toContain(AI_DISCLAIMER_LINE);
  });
});
