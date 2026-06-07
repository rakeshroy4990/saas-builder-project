import { assistantDisplayBody } from '../src/features/education/educationAssistantPayload';

describe('assistantDisplayBody streaming', () => {
  it('shows partial answer text before the JSON string is closed', () => {
    const partial = '{"answer":"Chest pain with';
    expect(assistantDisplayBody(partial)).toBe('Chest pain with');
  });

  it('returns parsed answer from complete JSON', () => {
    const complete = '{"answer":"Stable angina overview","followUpQuestions":[]}';
    expect(assistantDisplayBody(complete)).toBe('Stable angina overview');
  });
});
