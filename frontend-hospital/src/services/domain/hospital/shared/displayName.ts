import { pickString } from './strings';

export function buildFriendlyDisplayName(userData: Record<string, unknown>, fallbackIdentity: string): string {
  const firstName = pickString(userData, ['FirstName', 'firstName']);
  const lastName = pickString(userData, ['LastName', 'lastName']);
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
  if (fullName) {
    return fullName;
  }
  const username = pickString(userData, ['Username', 'username']);
  if (username && !username.includes('@')) {
    return username;
  }
  const email = pickString(userData, ['Email', 'email']) || fallbackIdentity;
  const localPart = email.includes('@') ? email.split('@')[0] : email;
  const tokens = localPart
    .split(/[._-]+/)
    .map((token) => token.trim())
    .filter(Boolean);
  if (tokens.length === 0) return 'User';
  return tokens.map((token) => token.charAt(0).toUpperCase() + token.slice(1)).join(' ');
}
