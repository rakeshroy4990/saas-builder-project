#!/bin/bash

# ============================================================
# EAS Archive Size Fix Script — Agastya Healthcare
# Run from: /Users/rakeshroy/Documents/Projects/saas-builder-project
# Usage: bash eas-size-fix.sh
# ============================================================

set -e

REPO_ROOT="/Users/rakeshroy/Documents/Projects/saas-builder-project"
MOBILE_APP="$REPO_ROOT/mobile-hospital"
ARCHIVE_CHECK="/tmp/eas-archive-check"
THRESHOLD_MB=20

cd "$REPO_ROOT"

echo ""
echo "================================================"
echo "  EAS Archive Size Diagnostic & Fix"
echo "================================================"
echo ""

# ── STEP 1: Check current archive size ──────────────────────
echo "▶ Step 1: Checking current archive size..."
rm -rf "$ARCHIVE_CHECK"
cd "$MOBILE_APP"
npx eas-cli build:inspect --platform android --stage archive --output "$ARCHIVE_CHECK" 2>/dev/null || true
cd "$REPO_ROOT"

if [ -d "$ARCHIVE_CHECK" ] && [ "$(ls -A $ARCHIVE_CHECK)" ]; then
  ARCHIVE_SIZE_MB=$(du -sm "$ARCHIVE_CHECK" | awk '{print $1}')
  echo "  📦 Archive size: ${ARCHIVE_SIZE_MB} MB"
  echo ""
  echo "  Breakdown:"
  du -sh "$ARCHIVE_CHECK"/.*/ "$ARCHIVE_CHECK"/*/ 2>/dev/null | sort -rh | head -15
  echo ""

  if [ "$ARCHIVE_SIZE_MB" -le "$THRESHOLD_MB" ]; then
    echo "  ✅ Archive is under ${THRESHOLD_MB} MB — no action needed."
    echo ""
    exit 0
  fi

  echo "  ⚠️  Archive is over ${THRESHOLD_MB} MB — fixing..."
  echo ""
else
  echo "  ⚠️  Could not measure archive (eas-cli inspect unavailable)"
  echo "  Continuing with git history scan and .easignore refresh..."
  echo ""
fi

# ── STEP 2: Refresh .easignore ───────────────────────────────
echo "▶ Step 2: Refreshing .easignore at repo root..."
cat > "$REPO_ROOT/.easignore" << 'EASIGNORE'
# Sibling projects
frontend-hospital/
backend-hospital/
backend-realtime-lib/
frontend/
frontend-ecommerce/
pdf-rag-pipeline/
frontend-social/
# Keep packages/* — mobile-hospital depends on file:../packages/hospital-api-client and i18n-contract
backend-auth-lib/
backend-uimetadata-lib/
backend-extensibility-lib/
backend/
frontend-realtime-lib/
backend-social/
backend-ecommerce/
frontend-bluetooth-lib/
/docs/
/scripts/
/images/
infra/
ops/
render/

# Git internals
.git/
.cursor/

# Root-level junk
logo.jpeg
start-dev.sh
cloudbuild.yaml
cloudbuild-*.yaml
PRODUCTION_SECURITY_CHECKLIST.md
*.zip
pnpm-workspace.yaml
render.yaml
/package-lock.json
/package.json
Mongodb
UI Metadata

# Secrets — never upload
*.env
*secret*.json
client_secret_*.json

# Mobile app build artifacts
mobile-hospital/node_modules/
mobile-hospital/.expo/
mobile-hospital/android/
mobile-hospital/ios/
mobile-hospital/dist/
mobile-hospital/dist-android/
mobile-hospital/build/
mobile-hospital/*.apk
mobile-hospital/*.aab
mobile-hospital/__tests__/
mobile-hospital/coverage/

# General
**/*.mp4
**/*.mov
**/*.log
**/*.apk
**/*.aab
**/*.ipa
.vscode/
.idea/
.DS_Store
.yarn/cache
.pnp.*
EASIGNORE
echo "  ✅ .easignore written"
echo ""

# ── STEP 3: Scan git history for large objects ───────────────
echo "▶ Step 3: Scanning git history for large objects (>5 MB)..."
echo ""

LARGE_OBJECTS=$(git rev-list --objects --all \
  | git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' \
  | grep '^blob' \
  | sort -k3 -rn \
  | awk '$3 > 5000000 {print $3, $4}')

if [ -z "$LARGE_OBJECTS" ]; then
  echo "  ✅ No objects over 5 MB in git history"
  echo ""
else
  echo "  ⚠️  Large objects found:"
  echo "$LARGE_OBJECTS"
  echo ""

  # Backup
  BACKUP_DIR="../saas-builder-project-backup-$(date +%Y%m%d-%H%M%S)"
  echo "▶ Step 4: Backing up repo to $BACKUP_DIR..."
  cp -r "$REPO_ROOT" "$BACKUP_DIR"
  echo "  ✅ Backup done"
  echo ""

  # Install git-filter-repo if needed
  echo "▶ Step 5: Checking git-filter-repo..."
  if ! command -v git-filter-repo &> /dev/null; then
    echo "  Installing..."
    pip install git-filter-repo --break-system-packages 2>/dev/null \
      || brew install git-filter-repo
  fi
  echo "  ✅ git-filter-repo ready"
  echo ""

  # Save remote before filter-repo removes it
  REMOTE_URL=$(git remote get-url origin 2>/dev/null || echo "")

  # Build dynamic --path args from large objects
  echo "▶ Step 6: Purging large objects from git history..."
  FILTER_ARGS="--force"
  while IFS= read -r line; do
    PATH_PART=$(echo "$line" | awk '{print $2}')
    [ -n "$PATH_PART" ] && FILTER_ARGS="$FILTER_ARGS --path \"$PATH_PART\" --invert-paths"
  done <<< "$(git rev-list --objects --all \
    | git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' \
    | grep '^blob' \
    | sort -k3 -rn \
    | awk '$3 > 5000000 {print $3, $4}')"

  eval "git filter-repo $FILTER_ARGS" 2>/dev/null || true
  echo "  ✅ History purged"
  echo ""

  # Restore remote
  if [ -n "$REMOTE_URL" ]; then
    git remote add origin "$REMOTE_URL" 2>/dev/null \
      || git remote set-url origin "$REMOTE_URL"
    echo "  ⚠️  Force push required:"
    echo "      git push origin --force --all"
    echo ""
  fi
fi

# ── STEP 4: Re-measure archive ───────────────────────────────
echo "▶ Final check: Re-measuring archive size..."
rm -rf "$ARCHIVE_CHECK"
cd "$MOBILE_APP"
npx eas-cli build:inspect --platform android --stage archive --output "$ARCHIVE_CHECK" 2>/dev/null || true
cd "$REPO_ROOT"

echo ""
echo "================================================"
if [ -d "$ARCHIVE_CHECK" ] && [ "$(ls -A $ARCHIVE_CHECK)" ]; then
  FINAL_SIZE=$(du -sh "$ARCHIVE_CHECK" | awk '{print $1}')
  echo "  Final archive size: $FINAL_SIZE"
  echo ""
  echo "  Breakdown:"
  du -sh "$ARCHIVE_CHECK"/.*/ "$ARCHIVE_CHECK"/*/ 2>/dev/null | sort -rh | head -10
else
  echo "  Could not measure final size — check manually:"
  echo "  npx eas-cli build:inspect --platform android --stage archive --output /tmp/check"
  echo "  du -sh /tmp/check"
fi
echo "================================================"
echo ""
echo "✅ Done. Run your build:"
echo "   cd mobile-hospital && npm run eas:build:preview:android"
echo ""