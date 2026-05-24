import { initialsFromUser } from '../src/auth/userInitials';

describe('initialsFromUser', () => {
  it('uses first and last name initials', () => {
    expect(initialsFromUser('Swati Pandey', '')).toBe('SP');
  });

  it('uses single initial for one name', () => {
    expect(initialsFromUser('Swati', '')).toBe('S');
  });

  it('falls back to email local part', () => {
    expect(initialsFromUser('', 'swati.pandey@example.com')).toBe('SW');
  });
});
