#!/usr/bin/env bash

set -euo pipefail

cd "/Users/rakeshroy/Documents/Projects/saas-builder-project/pdf-rag-pipeline"
source ".venv/bin/activate"
PIDS_ON_PORT="$(lsof -ti tcp:8090 || true)"
if [[ -n "$PIDS_ON_PORT" ]]; then
  echo "Port 8090 is occupied. Killing process(es): $PIDS_ON_PORT"
  kill -9 $PIDS_ON_PORT
fi
uvicorn api.main:app --reload --port 8090
