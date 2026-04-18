#!/usr/bin/env bash
# Local checks and commands for deploying hospital frontend + backend on Render.
# Docs: https://render.com/docs/infrastructure-as-code
# Dashboard (manual web service): https://dashboard.render.com/web/new

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

usage() {
  cat <<'EOF'
Usage:
  scripts/render-deploy.sh docker-build-backend   # verify backend Docker image builds locally
  scripts/render-deploy.sh npm-build-frontend     # verify static site build (repo root, monorepo paths)
  scripts/render-deploy.sh print-env              # show env vars to set on Render

Blueprint (recommended):
  1. Push this repo (including render.yaml) to GitHub/GitLab.
  2. Render Dashboard → Blueprints → New Blueprint Instance → select render.yaml.
  3. When prompted, set sync: false vars: SPRING_DATA_MONGODB_URI, APP_CORS_ALLOWED_ORIGIN_PATTERNS,
     VITE_SPRING_API_BASE_URL (use your backend https://<hospital-backend>.onrender.com, no trailing slash).

After the first backend deploy, copy its URL into VITE_SPRING_API_BASE_URL and redeploy the static site.
Set APP_CORS_ALLOWED_ORIGIN_PATTERNS to your static site origin, e.g. https://<hospital-frontend>.onrender.com
EOF
}

cmd="${1:-}"

case "$cmd" in
  docker-build-backend)
    docker build -f render/Dockerfile.backend-hospital -t hospital-backend:local .
    ;;
  npm-build-frontend)
    cd frontend-hospital && npm ci && npm run build
    ;;
  print-env)
    cat <<'EOF'
Backend (Web Service, Docker — see render.yaml):
  SPRING_DATA_MONGODB_URI     Mongo connection string (required for full API)
  APP_CORS_ALLOWED_ORIGIN_PATTERNS   e.g. https://your-frontend.onrender.com,http://localhost:5173
  APP_AUTH_JWT_SECRET         strong secret (Blueprint uses generateValue)
  APP_AUTH_COOKIE_SECURE      true in production (set in render.yaml)

Frontend (Static Site — build-time):
  VITE_SPRING_API_BASE_URL    e.g. https://your-backend.onrender.com  (no trailing slash)

Optional:
  APP_MONGODB_DATABASE, APP_HOSPITAL_TIME_ZONE, APP_BOOTSTRAP_ADMIN_* (see application.properties)
EOF
    ;;
  ""|-h|--help|help)
    usage
    ;;
  *)
    echo "Unknown command: $cmd" >&2
    usage >&2
    exit 1
    ;;
esac
