#!/usr/bin/env bash
# Fail fast when expo-build-properties pins compileSdk/targetSdk below the
# Expo SDK minimum (avoids EAS :app:checkReleaseAarMetadata failures).
# Usage: bash scripts/check-android-sdk-versions.sh [app-dir]
#        (also invoked by eas-build-preview-android.sh / eas-preflight.sh)
#
# Compatible with macOS Bash 3.2.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${1:-$SCRIPT_DIR/..}" && pwd)"

fail() {
  printf '\n✗ %s\n' "$1" >&2
  exit 1
}

cd "$APP_DIR"

if [[ ! -f package.json || ! -f app.config.js || ! -f app.json ]]; then
  fail "Missing package.json / app.config.js / app.json under: $APP_DIR"
fi

# Minimum compileSdk/targetSdk per Expo SDK major — keep in sync with
# https://docs.expo.dev/versions/latest/ (Android support table).
required_sdk_for_expo_major() {
  case "$1" in
    '' | *[!0-9]*)
      echo 36
      ;;
    5[4-9] | [6-9][0-9] | [1-9][0-9][0-9]*)
      # SDK 54+ (and newer majors) require API 36
      echo 36
      ;;
    53)
      echo 35
      ;;
    52)
      echo 34
      ;;
    *)
      echo 36
      ;;
  esac
}

sdk_report="$(
  node <<'NODE'
const path = require('path');
const appDir = process.cwd();

const pkg = require(path.join(appDir, 'package.json'));
const expoRange = String(pkg.dependencies?.expo ?? pkg.devDependencies?.expo ?? '');
const expoMajorMatch = expoRange.match(/(\d+)/);
const expoMajor = expoMajorMatch ? Number(expoMajorMatch[1]) : 0;

process.env.EAS_BUILD_PROFILE = process.env.EAS_BUILD_PROFILE || 'preview';
const base = require(path.join(appDir, 'app.json')).expo;
const config = require(path.join(appDir, 'app.config.js'))({ config: base });

let compileSdk = null;
let targetSdk = null;
let buildTools = null;
for (const entry of config.plugins ?? []) {
  const name = Array.isArray(entry) ? entry[0] : entry;
  if (name !== 'expo-build-properties') continue;
  const android = (Array.isArray(entry) ? entry[1] : {})?.android ?? {};
  if (android.compileSdkVersion != null) compileSdk = Number(android.compileSdkVersion);
  if (android.targetSdkVersion != null) targetSdk = Number(android.targetSdkVersion);
  if (android.buildToolsVersion != null) buildTools = String(android.buildToolsVersion);
}

console.log([
  `expoMajor=${expoMajor}`,
  `compileSdk=${compileSdk == null || Number.isNaN(compileSdk) ? '' : compileSdk}`,
  `targetSdk=${targetSdk == null || Number.isNaN(targetSdk) ? '' : targetSdk}`,
  `buildTools=${buildTools ?? ''}`
].join('\n'));
NODE
)" || fail "Failed to evaluate app.config.js Android SDK settings under: $APP_DIR"

expo_major=""
compile_sdk=""
target_sdk=""
build_tools=""
while IFS= read -r line; do
  case "$line" in
    expoMajor=*) expo_major="${line#expoMajor=}" ;;
    compileSdk=*) compile_sdk="${line#compileSdk=}" ;;
    targetSdk=*) target_sdk="${line#targetSdk=}" ;;
    buildTools=*) build_tools="${line#buildTools=}" ;;
  esac
done <<EOF
$sdk_report
EOF

required_sdk="$(required_sdk_for_expo_major "$expo_major")"
docs_major="${expo_major:-56}"

printf '  Expo SDK major: %s (requires Android API ≥ %s)\n' "${expo_major:-unknown}" "$required_sdk"
printf '  app.config.js expo-build-properties: compileSdk=%s targetSdk=%s buildTools=%s\n' \
  "${compile_sdk:-<default>}" "${target_sdk:-<default>}" "${build_tools:-<default>}"

issues=0

if [[ -n "$compile_sdk" ]] && [[ "$compile_sdk" -lt "$required_sdk" ]]; then
  printf '  ✗ compileSdkVersion %s is below required %s\n' "$compile_sdk" "$required_sdk" >&2
  printf '    AndroidX (activity 1.11+, core 1.18+) fail :app:checkReleaseAarMetadata on EAS.\n' >&2
  issues=1
fi

if [[ -n "$target_sdk" ]] && [[ "$target_sdk" -lt "$required_sdk" ]]; then
  printf '  ✗ targetSdkVersion %s is below Expo SDK %s minimum %s\n' \
    "$target_sdk" "${expo_major:-?}" "$required_sdk" >&2
  issues=1
fi

if [[ -n "$build_tools" ]]; then
  build_tools_major="${build_tools%%.*}"
  if [[ "$build_tools_major" =~ ^[0-9]+$ ]] && [[ "$build_tools_major" -lt "$required_sdk" ]]; then
    printf '  ✗ buildToolsVersion %s is below required %s.x\n' "$build_tools" "$required_sdk" >&2
    issues=1
  fi
fi

if [[ "$issues" -ne 0 ]]; then
  fail "Android SDK versions are incompatible with this Expo SDK.

  Fix in app.config.js → expo-build-properties → android:
    compileSdkVersion: ${required_sdk},
    targetSdkVersion: ${required_sdk},
    buildToolsVersion: '${required_sdk}.0.0'
  Docs: https://docs.expo.dev/versions/v${docs_major}.0.0/sdk/build-properties/"
fi

printf '  ✓ Android SDK versions OK for Expo %s\n' "${expo_major:-?}"
