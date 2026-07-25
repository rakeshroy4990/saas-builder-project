#!/usr/bin/env bash
# Run lockfile sync, EAS preflight checks, then preview Android cloud build.
# Usage: npm run eas:build:preview:android
#        bash scripts/eas-build-preview-android.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

log() {
  printf '\n▶ %s\n' "$1"
}

fail() {
  printf '\n✗ %s\n' "$1" >&2
  exit 1
}

sync_package_lock() {
  log "Sync package-lock.json with package.json"
  cd "$APP_DIR"
  if ! npm install --package-lock-only --workspaces=false; then
    fail "npm install --package-lock-only failed. Fix package.json errors and retry."
  fi
  printf '  ✓ package-lock.json synced\n'

  if git -C "$APP_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    local dirty=0
    for f in package.json package-lock.json; do
      if ! git -C "$APP_DIR" diff --quiet -- "$f" 2>/dev/null; then
        dirty=1
        printf '  ! %s differs from git — commit before EAS cloud build\n' "$f"
      fi
    done
    if [[ "$dirty" -eq 1 ]]; then
      fail "Lockfile sync changed package files. Commit them, then re-run:
  cd mobile-hospital
  git add package.json package-lock.json
  git commit -m \"chore(mobile): sync package-lock.json for EAS\""
    fi
  fi
}

cd "$APP_DIR"

sync_package_lock

log "Running EAS preflight (includes Gradle assembleRelease / toolchain check)"
npm run eas:preflight -- --platform android --profile preview

log "Preflight passed — starting EAS build"
eas build --profile preview --platform android

printf '\n✅ EAS build submitted.\n\n'
