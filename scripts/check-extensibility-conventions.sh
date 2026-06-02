#!/usr/bin/env bash
# CI guardrails for extensibility conventions (non-zero exit on violations).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FAILED=0

echo "Checking for raw fetch() to Spring API in frontend-hospital (excluding extensibility loaders)..."

if rg -n "fetch\s*\(\s*['\`].*\/api\/" "$ROOT/frontend-hospital/src" \
  --glob '!**/bootstrapExtensibility.ts' \
  --glob '!**/loadStaticConfig.ts' \
  --glob '!**/loadDynamicConfig.ts' \
  --glob '!**/hydrateUiMetadata.ts' \
  --glob '!**/node_modules/**' 2>/dev/null; then
  echo "FAIL: use URLRegistry.request or apiClient instead of raw fetch to /api"
  FAILED=1
fi

echo "Checking for hardcoded hex colors in hospital page configs..."

if rg -n "#[0-9a-fA-F]{3,8}" "$ROOT/frontend-hospital/src/configs" 2>/dev/null; then
  echo "FAIL: move brand colors to static.config.json / CSS variables"
  FAILED=1
fi

if [ "$FAILED" -ne 0 ]; then
  exit 1
fi

echo "Extensibility convention checks passed."
