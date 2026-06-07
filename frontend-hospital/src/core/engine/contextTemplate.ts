const templateTokenRegex = /\{\{\s*([^}]+)\s*\}\}/g;

function resolveTokenString(source: string, context: Record<string, unknown>): string {
  return source.replace(templateTokenRegex, (_full, path) => {
    const keys = String(path).split('.');
    const value = keys.reduce<unknown>((acc, key) => {
      if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
      return undefined;
    }, context);
    return value == null ? '' : String(value);
  });
}

/** Resolves `{{token}}` placeholders in config/action payloads using list row context. */
export function resolveContextTemplate(value: unknown, context?: Record<string, unknown>): unknown {
  if (!context) return value;
  if (typeof value === 'string') return resolveTokenString(value, context);
  if (Array.isArray(value)) return value.map((entry) => resolveContextTemplate(entry, context));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, inner]) => [
        key,
        resolveContextTemplate(inner, context)
      ])
    );
  }
  return value;
}
