#!/usr/bin/env bash
# Fail if duplicate component `id` values appear in the same file under frontend configs.
# UI metadata merge matches by id; duplicates cause one CMS patch to apply to every sibling.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FAILED=0

check_dir() {
  local dir="$1"
  [ -d "$dir" ] || return 0
  while IFS= read -r -d '' file; do
  local dupes
  dupes="$(grep -oE "id: '[^']+'" "$file" 2>/dev/null | sed "s/id: '//;s/'$//" | sort | uniq -d || true)"
  if [ -n "$dupes" ]; then
    echo "FAIL: duplicate component id(s) in $file"
    echo "$dupes" | sed 's/^/  - /'
    FAILED=1
  fi
  done < <(find "$dir" -type f \( -name '*.ts' -o -name '*.json' \) -print0 2>/dev/null)
}

echo "Checking unique component ids in frontend page/config trees..."

for base in frontend-hospital frontend-ecommerce frontend-social frontend; do
  check_dir "$ROOT/$base/src/configs"
done

# UI metadata reference / saved examples in backend (optional catalog)
check_dir "$ROOT/backend-hospital/src/main/resources"

if [ "$FAILED" -ne 0 ]; then
  echo ""
  echo "Use a unique id per component node in the same page/config file."
  echo "See .cursor/rules/ui-component-ids.mdc"
  exit 1
fi

echo "UI component id uniqueness checks passed."
