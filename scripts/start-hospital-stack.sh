#!/usr/bin/env bash
# Start frontend-hospital, backend-hospital, and pdf-rag-pipeline together.
#
# Usage:
#   ./scripts/start-hospital-stack.sh
#   UI_PORT=5174 BACKEND_PORT=8081 RAG_PORT=8090 ./scripts/start-hospital-stack.sh
#   FORCE_KILL=1 ./scripts/start-hospital-stack.sh   # kill anything on the ports (dangerous)
#
# Defaults leave 8080 free for other local apps (e.g. gyanwire). Frontend is pointed at
# BACKEND_PORT via VITE_SPRING_API_BASE_URL for this process only.
# By default only stops leftover processes from this stack's directories.
#
# Press Ctrl+C to stop all three.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend-hospital"
BACKEND_DIR="$ROOT_DIR/backend-hospital"
RAG_DIR="$ROOT_DIR/pdf-rag-pipeline"
RAG_VENV="${RAG_VENV:-$RAG_DIR/.venv}"

UI_PORT="${UI_PORT:-5174}"
BACKEND_PORT="${BACKEND_PORT:-8081}"
RAG_PORT="${RAG_PORT:-8090}"
FORCE_KILL="${FORCE_KILL:-0}"
SPRING_API_BASE_URL="${VITE_SPRING_API_BASE_URL:-http://localhost:$BACKEND_PORT}"

FRONTEND_PID=""
BACKEND_PID=""
RAG_PID=""

log() {
  printf '%s\n' "$*"
}

die() {
  printf '%s\n' "$*" >&2
  exit 1
}

require_dir() {
  local path="$1"
  local label="$2"
  [[ -d "$path" ]] || die "Missing $label directory: $path"
}

setup_gradle_java() {
  if [[ "${OSTYPE:-}" == darwin* ]] && command -v /usr/libexec/java_home >/dev/null 2>&1; then
    local selected_java_home=""
    selected_java_home="$(/usr/libexec/java_home -v 21 2>/dev/null || true)"
    if [[ -z "$selected_java_home" ]]; then
      selected_java_home="$(/usr/libexec/java_home -v 17 2>/dev/null || true)"
    fi
    if [[ -n "$selected_java_home" ]]; then
      export JAVA_HOME="$selected_java_home"
      export PATH="$JAVA_HOME/bin:$PATH"
      log "Using JAVA_HOME for Gradle: $JAVA_HOME"
    fi
  fi
}

load_env_file() {
  local env_file="$1"
  if [[ -f "$env_file" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$env_file"
    set +a
    log "Loaded env from $env_file"
  fi
}

pid_cwd() {
  local pid="$1"
  # lsof -Fn emits p<pid> then n<path>; only the n-line is the cwd.
  lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | awk '/^n/ { sub(/^n/, ""); print; exit }'
}

pid_command() {
  local pid="$1"
  ps -p "$pid" -o command= 2>/dev/null || true
}

# True when cwd or command line is under expected_dir (covers Vite leftover after cwd parse quirks).
is_stack_process() {
  local expected_dir="$1"
  local cwd="$2"
  local cmd="$3"
  [[ -n "$cwd" && "$cwd" == "$expected_dir"* ]] && return 0
  [[ -n "$cmd" && "$cmd" == *"$expected_dir"* ]] && return 0
  return 1
}

# PIDs that are actually listening on the port (ignore Cursor/Chrome client connections).
listening_pids() {
  local port="$1"
  lsof -nP -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true
}

# Free a port only when every LISTENER belongs to expected_dir (or FORCE_KILL=1).
prepare_port() {
  local port="$1"
  local expected_dir="$2"
  local label="$3"
  local port_hint="$4"
  local pids pid cwd cmd own_pids foreign=0

  pids="$(listening_pids "$port")"
  if [[ -z "$pids" ]]; then
    return 0
  fi

  if [[ "$FORCE_KILL" == "1" ]]; then
    log "FORCE_KILL=1: freeing port $port (listener PIDs: $pids)"
    kill -9 $pids 2>/dev/null || true
    return 0
  fi

  own_pids=""
  for pid in $pids; do
    cwd="$(pid_cwd "$pid")"
    cmd="$(pid_command "$pid")"
    if is_stack_process "$expected_dir" "$cwd" "$cmd"; then
      own_pids="${own_pids:+$own_pids }$pid"
      continue
    fi
    foreign=1
    log "Port $port is in use by another process (not $label):"
    log "  PID $pid"
    [[ -n "$cmd" ]] && log "  command: $cmd"
    [[ -n "$cwd" ]] && log "  cwd    : $cwd"
  done

  if [[ "$foreign" == "1" ]]; then
    die "Refusing to kill non-hospital process on port $port.
Pick a free port, e.g. $port_hint $0
Or stop the other app yourself, or set FORCE_KILL=1 (kills anything on the port)."
  fi

  if [[ -n "$own_pids" ]]; then
    log "Stopping previous $label on port $port (PIDs: $own_pids)"
    kill -9 $own_pids 2>/dev/null || true
  fi
}

cleanup() {
  log "Stopping hospital stack..."
  if [[ -n "${FRONTEND_PID}" ]]; then kill "$FRONTEND_PID" 2>/dev/null || true; fi
  if [[ -n "${BACKEND_PID}" ]]; then kill "$BACKEND_PID" 2>/dev/null || true; fi
  if [[ -n "${RAG_PID}" ]]; then kill "$RAG_PID" 2>/dev/null || true; fi
}

start_frontend() {
  log "Starting frontend-hospital on port $UI_PORT (API → $SPRING_API_BASE_URL)..."
  (
    cd "$FRONTEND_DIR"
    export VITE_SPRING_API_BASE_URL="$SPRING_API_BASE_URL"
    npm run dev -- --port "$UI_PORT"
  ) &
  FRONTEND_PID=$!
}

start_backend() {
  log "Starting backend-hospital on port $BACKEND_PORT..."
  (
    cd "$BACKEND_DIR"
    setup_gradle_java
    load_env_file "$BACKEND_DIR/.env"
    if [[ -x "./gradlew" ]]; then
      ./gradlew bootRun --args="--server.port=$BACKEND_PORT"
    elif command -v gradle >/dev/null 2>&1; then
      gradle bootRun --args="--server.port=$BACKEND_PORT"
    else
      die "No ./gradlew or gradle found in $BACKEND_DIR"
    fi
  ) &
  BACKEND_PID=$!
}

start_rag() {
  log "Starting pdf-rag-pipeline on port $RAG_PORT..."
  (
    cd "$RAG_DIR"
    load_env_file "$RAG_DIR/.env"
    if [[ -x "$RAG_VENV/bin/python" ]]; then
      "$RAG_VENV/bin/python" -m uvicorn api.main:app --host 0.0.0.0 --reload --port "$RAG_PORT"
    elif command -v uvicorn >/dev/null 2>&1; then
      uvicorn api.main:app --host 0.0.0.0 --reload --port "$RAG_PORT"
    else
      die "pdf-rag venv missing at $RAG_VENV/bin/python (and uvicorn not on PATH). Create .venv and pip install -r requirements.txt first."
    fi
  ) &
  RAG_PID=$!
}

require_dir "$FRONTEND_DIR" "frontend-hospital"
require_dir "$BACKEND_DIR" "backend-hospital"
require_dir "$RAG_DIR" "pdf-rag-pipeline"

trap cleanup EXIT INT TERM

prepare_port "$UI_PORT" "$FRONTEND_DIR" "frontend-hospital" "UI_PORT=5175"
prepare_port "$BACKEND_PORT" "$BACKEND_DIR" "backend-hospital" "BACKEND_PORT=8082"
prepare_port "$RAG_PORT" "$RAG_DIR" "pdf-rag-pipeline" "RAG_PORT=8091"

start_rag
start_backend
start_frontend

log ""
log "Hospital stack running:"
log "  Frontend : http://localhost:$UI_PORT"
log "  Backend  : http://localhost:$BACKEND_PORT"
log "  API base : $SPRING_API_BASE_URL"
log "  PDF RAG  : http://localhost:$RAG_PORT"
log "Press Ctrl+C to stop all services."
log ""

wait
