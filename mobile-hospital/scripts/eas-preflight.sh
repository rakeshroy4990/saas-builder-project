#!/usr/bin/env bash
# Simulate EAS cloud build steps locally before eas build.
# Usage: npm run eas:preflight
#        npm run eas:preflight -- --platform ios --profile preview

set -euo pipefail

PLATFORM="android"
PROFILE="preview"
OUTPUT_DIR=""

usage() {
  cat <<'EOF'
EAS preflight — verify archive, npm ci, app.config.js, prebuild, and JS bundle locally.

Usage:
  npm run eas:preflight
  npm run eas:preflight -- --platform ios --profile preview
  npm run eas:preflight -- --output /tmp/eas-check

Options:
  --platform android|ios   Platform for prebuild (default: android)
  --profile NAME           EAS profile for env simulation (default: preview)
  --output DIR             Keep archive copy at DIR (default: temp dir, removed on success)
  -h, --help               Show this help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --platform)
      PLATFORM="${2:?--platform requires a value}"
      shift 2
      ;;
    --profile)
      PROFILE="${2:?--profile requires a value}"
      shift 2
      ;;
    --output)
      OUTPUT_DIR="${2:?--output requires a value}"
      shift 2
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ "$PLATFORM" != "android" && "$PLATFORM" != "ios" ]]; then
  echo "Unsupported platform: $PLATFORM (use android or ios)" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$APP_DIR/.." && pwd)"

TEMP_DIR=""
if [[ -z "$OUTPUT_DIR" ]]; then
  TEMP_DIR="$(mktemp -u /tmp/eas-preflight.XXXXXX)"
  OUTPUT_DIR="$TEMP_DIR"
  cleanup() {
    if [[ -n "$TEMP_DIR" && -d "$TEMP_DIR" ]]; then
      rm -rf "$TEMP_DIR"
    fi
  }
  trap cleanup EXIT
else
  rm -rf "$OUTPUT_DIR"
fi

ARCHIVE_APP="$OUTPUT_DIR/mobile-hospital"

log() {
  printf '\n▶ %s\n' "$1"
}

fail() {
  printf '\n✗ %s\n' "$1" >&2
  if [[ -n "$TEMP_DIR" && -d "$OUTPUT_DIR" ]]; then
    printf '  Archive kept at: %s\n' "$OUTPUT_DIR" >&2
    trap - EXIT
  fi
  exit 1
}

require_file() {
  local path="$1"
  local hint="$2"
  if [[ ! -f "$path" ]]; then
    fail "Missing required file: $path\n  Hint: $hint"
  fi
  printf '  ✓ %s\n' "${path#"$OUTPUT_DIR"/}"
}

log "Step 1/6 — Build EAS archive (platform=$PLATFORM, profile=$PROFILE)"
cd "$APP_DIR"
if ! npx eas-cli build:inspect \
  --platform "$PLATFORM" \
  --profile "$PROFILE" \
  --stage archive \
  --output "$OUTPUT_DIR"; then
  fail "eas build:inspect failed. Run from mobile-hospital with eas-cli available."
fi
printf '  Archive: %s\n' "$OUTPUT_DIR"

log "Step 2/6 — Verify archive contents"
require_file "$ARCHIVE_APP/package.json" "Check root .easignore — use /package.json not package.json"
require_file "$ARCHIVE_APP/package-lock.json" "Regenerate: npm install --package-lock-only --workspaces=false"
require_file "$ARCHIVE_APP/app.config.js" "app.config.js must be committed and not ignored"
require_file "$ARCHIVE_APP/app.json" "app.json must be committed and not ignored"
require_file "$ARCHIVE_APP/scripts/validateGoogleServices.js" "Check root .easignore — use /scripts/ not scripts/"
require_file "$ARCHIVE_APP/scripts/patch-gradle-foojay.sh" "patch-gradle-foojay.sh must be committed for Gradle 9 / EAS Android builds"
require_file "$ARCHIVE_APP/assets/images/icon.png" "Check root .easignore — use /images/ not images/"
require_file "$ARCHIVE_APP/assets/images/android-icon-foreground.png" "Adaptive icon assets must be in git"
require_file "$ARCHIVE_APP/assets/images/splash-icon.png" "Splash icon must be in git"
require_file "$OUTPUT_DIR/packages/hospital-api-client/package.json" "packages/ must not be excluded in .easignore"
require_file "$OUTPUT_DIR/packages/i18n-contract/package.json" "packages/ must not be excluded in .easignore"

log "Step 3/6 — Clean install (npm ci --include=dev)"
cd "$ARCHIVE_APP"
rm -rf node_modules
if ! npm ci --include=dev; then
  fail "npm ci failed. Sync lockfile: npm install --package-lock-only --workspaces=false"
fi
printf '  ✓ npm ci succeeded\n'

if ! bash "$ARCHIVE_APP/scripts/patch-gradle-foojay.sh"; then
  fail "patch-gradle-foojay.sh failed — React Native Gradle plugin may be incompatible with Gradle 9"
fi

log "Step 4/6 — Load app.config.js and run expo prebuild --no-install"
export EAS_BUILD_PROFILE="$PROFILE"
if ! node -e "
  const path = require('path');
  process.chdir(process.argv[1]);
  const config = require('./app.json').expo;
  require('./app.config.js')({ config });
  console.log('  ✓ app.config.js loaded');
" "$ARCHIVE_APP"; then
  fail "app.config.js failed to load"
fi

if ! npx expo prebuild --no-install --platform "$PLATFORM"; then
  fail "expo prebuild failed — fix config/assets before eas build"
fi
printf '  ✓ expo prebuild succeeded\n'

log "Step 5/6 — Bundle JS (expo export:embed — same as EAS release build)"
if ! npx expo export:embed --eager --platform "$PLATFORM" --dev false; then
  fail "expo export:embed failed — missing npm deps or unresolved imports. Run: npm install --workspaces=false"
fi
printf '  ✓ expo export:embed succeeded\n'

if [[ "$PLATFORM" == "android" ]]; then
  log "Step 6/6 — Gradle release sanity (Run gradlew — same as EAS Android build)"
  require_file "$ARCHIVE_APP/android/gradlew" "expo prebuild must generate android/gradlew"

  gradle_android_dir="$ARCHIVE_APP/android"
  gradle_sdk="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
  if [[ -z "$gradle_sdk" && -d "${HOME}/Library/Android/sdk" ]]; then
    gradle_sdk="${HOME}/Library/Android/sdk"
  fi
  if [[ -n "$gradle_sdk" && -d "$gradle_sdk" ]]; then
    printf 'sdk.dir=%s\n' "$gradle_sdk" >"$gradle_android_dir/local.properties"
    printf '  Using Android SDK: %s\n' "$gradle_sdk"
    if ! (
      cd "$gradle_android_dir"
      ./gradlew :app:assembleRelease --no-daemon
    ); then
      fail "Gradle assembleRelease failed — fix Android native build before eas build"
    fi
    printf '  ✓ Gradle assembleRelease succeeded\n'
  else
  gradle_log_file="$(mktemp)"
  gradle_status=0
  (
    cd "$gradle_android_dir"
    ./gradlew projects --no-daemon
  ) >"$gradle_log_file" 2>&1 || gradle_status=$?

  if grep -qE 'IBM_SEMERU|Could not initialize class org\.gradle\.toolchains\.foojay' "$gradle_log_file"; then
    rm -f "$gradle_log_file"
    fail "Gradle toolchain plugin mismatch (foojay-resolver 0.5.0 vs Gradle 9).
  scripts/patch-gradle-foojay.sh should upgrade it during npm ci — verify postinstall ran."
  fi

  if [[ "$gradle_status" -ne 0 ]]; then
    if grep -q 'SDK location not found' "$gradle_log_file"; then
      printf '  ! ANDROID_HOME not set — Gradle settings loaded; full assembleRelease skipped\n'
      printf '    Set ANDROID_HOME to run a full native build check locally\n'
    else
      cat "$gradle_log_file" >&2
      rm -f "$gradle_log_file"
      fail "Gradle projects failed — fix Android Gradle config before eas build"
    fi
  else
    printf '  ✓ Gradle projects succeeded\n'
  fi
  rm -f "$gradle_log_file"
  fi
else
  log "Step 6/6 — Skipped (Gradle check is Android-only)"
fi

printf '\n✅ EAS preflight passed. Safe to run:\n'
printf '   npm run eas:build:preview:android\n\n'
