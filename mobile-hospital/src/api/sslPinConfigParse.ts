export type SslPinHostConfig = {
  publicKeyHashes: string[];
  includeSubdomains?: boolean;
};

export function parseSslPinJson(raw: string | undefined | null): Record<string, SslPinHostConfig> | null {
  if (!raw?.trim()) return null;

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, SslPinHostConfig> = {};

    for (const [host, value] of Object.entries(parsed)) {
      if (!host.trim()) continue;
      if (Array.isArray(value)) {
        const hashes = value.map((h) => String(h).trim()).filter(Boolean);
        if (hashes.length > 0) {
          out[host.trim().toLowerCase()] = { publicKeyHashes: hashes, includeSubdomains: false };
        }
        continue;
      }
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const row = value as Record<string, unknown>;
        const hashes = (Array.isArray(row.publicKeyHashes) ? row.publicKeyHashes : [])
          .map((h) => String(h).trim())
          .filter(Boolean);
        if (hashes.length > 0) {
          out[host.trim().toLowerCase()] = {
            publicKeyHashes: hashes,
            includeSubdomains: Boolean(row.includeSubdomains)
          };
        }
      }
    }

    return Object.keys(out).length > 0 ? out : null;
  } catch {
    return null;
  }
}
