import { buildEducationChatPayload } from '@/features/education/educationChatPayload';

describe('buildEducationChatPayload', () => {
  it('omits book scope when none selected (all books)', () => {
    const payload = buildEducationChatPayload('Q?', [], [], 'mobile-education');
    expect(payload.BookName).toBeUndefined();
    expect(payload.BookNames).toBeUndefined();
    expect(payload.RetrievalQuestion).toBe('Q?');
  });

  it('sends BookNames and legacy BookName for a single book', () => {
    const payload = buildEducationChatPayload('Q?', ['Harrison'], [], 'mobile-education');
    expect(payload.BookNames).toEqual(['Harrison']);
    expect(payload.BookName).toBe('Harrison');
  });

  it('sends BookNames only when multiple books selected', () => {
    const payload = buildEducationChatPayload(
      'Q?',
      ['Book A', 'Book B'],
      [],
      'mobile-education',
      'retrieval seed'
    );
    expect(payload.BookNames).toEqual(['Book A', 'Book B']);
    expect(payload.BookName).toBeUndefined();
    expect(payload.RetrievalQuestion).toBe('retrieval seed');
  });
});
