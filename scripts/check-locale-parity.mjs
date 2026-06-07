#!/usr/bin/env node
/** Verifies en/hi/kn message bundles share the same key paths. */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../frontend-hospital/src/locales');

function leafKeys(obj, prefix = '') {
  const keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) keys.push(...leafKeys(v, p));
    else keys.push(p);
  }
  return keys.sort();
}

const locales = ['en', 'hi', 'kn'];
const byLocale = Object.fromEntries(
  locales.map((lng) => {
    const file = path.join(root, lng, 'messages.json');
    const json = JSON.parse(fs.readFileSync(file, 'utf8'));
    return [lng, new Set(leafKeys(json))];
  })
);

const enKeys = byLocale.en;
for (const lng of ['hi', 'kn']) {
  const keys = byLocale[lng];
  const missing = [...enKeys].filter((k) => !keys.has(k));
  const extra = [...keys].filter((k) => !enKeys.has(k));
  if (missing.length || extra.length) {
    console.error(`Locale ${lng} parity failed: missing=${missing.length} extra=${extra.length}`);
    if (missing.length) console.error('Missing:', missing.slice(0, 20));
    if (extra.length) console.error('Extra:', extra.slice(0, 20));
    process.exit(1);
  }
}

console.log(`Locale parity OK (${enKeys.size} keys × ${locales.length} locales)`);
