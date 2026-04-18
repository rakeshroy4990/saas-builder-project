export function pickString(payload: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = payload[key];
    if (value == null) continue;
    const normalized = String(value).trim();
    if (normalized) return normalized;
  }
  return '';
}
