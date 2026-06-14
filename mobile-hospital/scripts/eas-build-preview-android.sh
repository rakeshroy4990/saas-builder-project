#!/usr/bin/env bash
# Run EAS preflight checks, then preview Android cloud build.
# Usage: npm run eas:build:preview:android
#        bash scripts/eas-build-preview-android.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$APP_DIR"

printf '\n▶ Running EAS preflight...\n\n'
npm run eas:preflight -- --platform android --profile preview

printf '\n▶ Preflight passed — starting EAS build...\n\n'
eas build --profile preview --platform android

printf '\n✅ EAS build submitted.\n\n'
