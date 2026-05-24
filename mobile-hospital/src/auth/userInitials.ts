/** First + last name initials for header avatar (e.g. "Swati Pandey" → "SP"). */
export function initialsFromUser(displayName: string, email: string): string {
  const name = displayName.trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase() || '?';
    }
    return (parts[0]?.[0] ?? '?').toUpperCase();
  }
  const local = email.split('@')[0]?.trim() ?? '';
  if (!local) return '?';
  if (local.length >= 2) return `${local[0]}${local[1]}`.toUpperCase();
  return local[0].toUpperCase();
}
