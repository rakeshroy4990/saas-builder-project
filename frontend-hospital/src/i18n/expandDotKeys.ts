/**
 * Turns CMS flat keys (e.g. {@code hospital.brandTitle}) into nested objects for vue-i18n
 * so they override entries from {@code messages.json}.
 */
export function expandDotKeys(flat: Record<string, unknown>): Record<string, unknown> {
  const root: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(flat)) {
    if (value === null || value === undefined) continue;

    if (!key.includes('.')) {
      if (isPlainObject(value) && isPlainObject(root[key])) {
        root[key] = deepMergeObjects(root[key] as Record<string, unknown>, value as Record<string, unknown>);
      } else {
        root[key] = value;
      }
      continue;
    }

    const parts = key.split('.').filter(Boolean);
    if (parts.length === 0) continue;

    let cursor = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      const existing = cursor[part];
      if (!isPlainObject(existing)) {
        cursor[part] = {};
      }
      cursor = cursor[part] as Record<string, unknown>;
    }

    const leaf = parts[parts.length - 1];
    const existingLeaf = cursor[leaf];
    if (isPlainObject(value) && isPlainObject(existingLeaf)) {
      cursor[leaf] = deepMergeObjects(existingLeaf as Record<string, unknown>, value as Record<string, unknown>);
    } else {
      cursor[leaf] = value;
    }
  }

  return root;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function deepMergeObjects(
  base: Record<string, unknown>,
  patch: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [key, patchValue] of Object.entries(patch)) {
    const baseValue = out[key];
    if (isPlainObject(baseValue) && isPlainObject(patchValue)) {
      out[key] = deepMergeObjects(baseValue, patchValue);
    } else {
      out[key] = patchValue;
    }
  }
  return out;
}
