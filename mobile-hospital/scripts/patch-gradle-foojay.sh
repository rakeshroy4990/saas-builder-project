#!/usr/bin/env bash
# React Native 0.85.x ships @react-native/gradle-plugin with foojay-resolver-convention 0.5.0,
# which is incompatible with Gradle 9 (IBM_SEMERU removed). Bump to 1.0.0 after npm install.
# See: https://github.com/facebook/react-native/issues/56287

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$APP_DIR/.." && pwd)"

resolve_gradle_plugin_settings() {
  local candidates=(
    "$APP_DIR/node_modules/@react-native/gradle-plugin/settings.gradle.kts"
    "$REPO_ROOT/node_modules/@react-native/gradle-plugin/settings.gradle.kts"
  )
  local path
  for path in "${candidates[@]}"; do
    if [[ -f "$path" ]]; then
      printf '%s' "$path"
      return 0
    fi
  done
  return 1
}

SETTINGS_FILE="$(resolve_gradle_plugin_settings || true)"
if [[ -z "$SETTINGS_FILE" ]]; then
  printf 'patch-gradle-foojay: @react-native/gradle-plugin not installed yet — skipping\n'
  exit 0
fi

OLD='id("org.gradle.toolchains.foojay-resolver-convention").version("0.5.0")'
NEW='id("org.gradle.toolchains.foojay-resolver-convention").version("1.0.0")'

if grep -qF "$NEW" "$SETTINGS_FILE"; then
  printf 'patch-gradle-foojay: already on foojay-resolver-convention 1.0.0\n'
  exit 0
fi

if ! grep -qF "$OLD" "$SETTINGS_FILE"; then
  printf 'patch-gradle-foojay: unexpected settings.gradle.kts — manual review needed:\n  %s\n' "$SETTINGS_FILE" >&2
  exit 1
fi

perl -0pi -e "s/\Q$OLD\E/$NEW/g" "$SETTINGS_FILE"
printf 'patch-gradle-foojay: upgraded foojay-resolver-convention 0.5.0 → 1.0.0 in\n  %s\n' "$SETTINGS_FILE"
