const LOG_WIRE_KEYS: Record<string, string> = {
  traceId: 'TraceId',
  entries: 'Entries',
  level: 'Level',
  message: 'Message',
  timestamp: 'Timestamp',
  context: 'Context'
};

/**
 * Maps internal client log batch keys to PascalCase API wire keys.
 */
export function toLogWire(payload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    const wireKey = LOG_WIRE_KEYS[key] ?? key;
    if (key === 'entries' && Array.isArray(value)) {
      out[wireKey] = value.map((entry) =>
        entry != null && typeof entry === 'object' && !Array.isArray(entry)
          ? toLogWire(entry as Record<string, unknown>)
          : entry
      );
      continue;
    }
    out[wireKey] = value;
  }
  return out;
}
