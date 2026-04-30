const TRACE_KEY = 'flexshell-trace-id';

function newTraceId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `trace-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function getOrCreateTraceId(): string {
  const existing = sessionStorage.getItem(TRACE_KEY);
  if (existing) return existing;
  const created = newTraceId();
  sessionStorage.setItem(TRACE_KEY, created);
  return created;
}

export function startNewTraceId(): string {
  const created = newTraceId();
  sessionStorage.setItem(TRACE_KEY, created);
  return created;
}

