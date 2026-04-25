#!/usr/bin/env bash
# Generate frontend/backend domain scaffold from replacement-points map.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MAP_FILE="$ROOT/docs/domain-bootstrap/replacement-points.yaml"
DOMAIN=""
DRY_RUN="false"

usage() {
  cat <<'EOF'
Usage:
  scripts/bootstrap-domain.sh --domain <domain-name> [--map <yaml-path>] [--dry-run]

Examples:
  scripts/bootstrap-domain.sh --domain ecommerce
  scripts/bootstrap-domain.sh --domain social --dry-run
  scripts/bootstrap-domain.sh --domain marketplace --map docs/domain-bootstrap/replacement-points.yaml

What it does:
  - Reads replace targets from replacement-points.yaml
  - Materializes frontend-<domain>/ and backend-<domain>/ starter paths
  - Writes starter placeholders only when files do not already exist
EOF
}

log() {
  printf '%s\n' "$*"
}

create_dir() {
  local path="$1"
  if [[ "$DRY_RUN" == "true" ]]; then
    log "[dry-run] mkdir -p $path"
  else
    mkdir -p "$path"
  fi
}

write_file_if_missing() {
  local path="$1"
  local content="$2"
  if [[ -f "$path" ]]; then
    log "skip existing: $path"
    return 0
  fi
  if [[ "$DRY_RUN" == "true" ]]; then
    log "[dry-run] create file: $path"
    return 0
  fi
  create_dir "$(dirname "$path")"
  printf '%s\n' "$content" > "$path"
  log "created: $path"
}

capitalize_first() {
  local raw="$1"
  printf '%s%s' "${raw:0:1}" "${raw:1}" | awk '{print toupper(substr($0,1,1)) substr($0,2)}'
}

extract_replace_targets() {
  local file="$1"
  awk '
    /replace_with:[[:space:]]*"/ {
      line = $0
      sub(/^[[:space:]]*replace_with:[[:space:]]*"/, "", line)
      sub(/"[[:space:]]*$/, "", line)
      print line
    }
  ' "$file" | sort -u
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain)
      DOMAIN="${2:-}"
      shift 2
      ;;
    --map)
      MAP_FILE="$ROOT/${2:-}"
      shift 2
      ;;
    --dry-run)
      DRY_RUN="true"
      shift
      ;;
    -h|--help|help)
      usage
      exit 0
      ;;
    *)
      log "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "$DOMAIN" ]]; then
  log "Missing required argument: --domain <domain-name>" >&2
  usage >&2
  exit 1
fi

if [[ ! -f "$MAP_FILE" ]]; then
  log "Replacement map not found: $MAP_FILE" >&2
  exit 1
fi

DOMAIN_CLASS="$(capitalize_first "$DOMAIN")"
TARGETS="$(extract_replace_targets "$MAP_FILE")"
if [[ -z "$TARGETS" ]]; then
  log "No replace_with targets found in map: $MAP_FILE" >&2
  exit 1
fi

log "Bootstrapping domain scaffold for: $DOMAIN"
log "Using map: $MAP_FILE"

while IFS= read -r target; do
  [[ -z "$target" ]] && continue
  resolved="${target//<domain>/$DOMAIN}"
  resolved="${resolved//<Domain>/$DOMAIN_CLASS}"
  resolved="${resolved//<domainpackage>/$DOMAIN}"
  full_path="$ROOT/$resolved"

  case "$full_path" in
    *.ts|*.js|*.java|*.vue|*.md|*.yaml|*.yml)
      create_dir "$(dirname "$full_path")"
      ;;
    *)
      create_dir "$full_path"
      ;;
  esac
done <<< "$TARGETS"

write_file_if_missing \
  "$ROOT/frontend-$DOMAIN/src/configs/$DOMAIN/pages.ts" \
"import type { PageConfig } from '../../core/types/PageConfig';

export const ${DOMAIN}Pages: PageConfig[] = [
  {
    packageName: '$DOMAIN',
    pageId: 'home',
    title: '${DOMAIN_CLASS} Home',
    container: {
      children: []
    }
  }
];
"

write_file_if_missing \
  "$ROOT/frontend-$DOMAIN/src/services/domain/$DOMAIN/index.ts" \
"import type { ServiceDefinition } from '../../../core/types/ServiceDefinition';

export const ${DOMAIN}Services: ServiceDefinition[] = [];
"

write_file_if_missing \
  "$ROOT/frontend-$DOMAIN/src/services/domain/$DOMAIN/services.ts" \
"export { ${DOMAIN}Services } from './index';
"

write_file_if_missing \
  "$ROOT/frontend-$DOMAIN/src/modules/${DOMAIN_CLASS}Module.ts" \
"import { PageRegistry } from '../core/registry/PageRegistry';
import { ServiceRegistry } from '../core/registry/ServiceRegistry';
import { ${DOMAIN}Pages } from '../configs/$DOMAIN/pages';
import { ${DOMAIN}Services } from '../services/domain/$DOMAIN/services';

export function register${DOMAIN_CLASS}Module(): void {
  ${DOMAIN}Pages.forEach((page) => PageRegistry.getInstance().register(page));
  ${DOMAIN}Services.forEach((service) => ServiceRegistry.getInstance().register(service));
}
"

write_file_if_missing \
  "$ROOT/backend-$DOMAIN/src/main/java/com/flexshell/controller/${DOMAIN_CLASS}Controller.java" \
"package com.flexshell.controller;

import com.flexshell.controller.dto.StandardApiResponse;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(\"/api/$DOMAIN\")
public class ${DOMAIN_CLASS}Controller {

    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<String>> health() {
        return ResponseEntity.ok(StandardApiResponse.success(\"OK\", \"$DOMAIN scaffold ready\"));
    }
}
"

write_file_if_missing \
  "$ROOT/backend-$DOMAIN/src/main/java/com/flexshell/service/${DOMAIN_CLASS}Service.java" \
"package com.flexshell.service;

import org.springframework.stereotype.Service;

@Service
public class ${DOMAIN_CLASS}Service {
}
"

write_file_if_missing \
  "$ROOT/backend-$DOMAIN/src/main/java/com/flexshell/$DOMAIN/${DOMAIN_CLASS}Entity.java" \
"package com.flexshell.$DOMAIN;

public class ${DOMAIN_CLASS}Entity {
}
"

write_file_if_missing \
  "$ROOT/backend-$DOMAIN/src/main/java/com/flexshell/$DOMAIN/${DOMAIN_CLASS}Repository.java" \
"package com.flexshell.$DOMAIN;

public interface ${DOMAIN_CLASS}Repository {
}
"

log "Done. Scaffold prepared for domain: $DOMAIN"
