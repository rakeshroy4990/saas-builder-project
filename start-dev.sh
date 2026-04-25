#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UI_APP="${UI_APP:-ecommerce}"
BACKEND_APP="${BACKEND_APP:-$UI_APP}"
BACKEND_KIND="spring"
START_FRONTEND=1

case "$UI_APP" in
  ecommerce)
    FRONTEND_DIR="$ROOT_DIR/frontend-ecommerce"
    DEFAULT_UI_PORT=5173
    ;;
  hospital)
    FRONTEND_DIR="$ROOT_DIR/frontend-hospital"
    DEFAULT_UI_PORT=5174
    ;;
  social)
    FRONTEND_DIR="$ROOT_DIR/frontend-social"
    DEFAULT_UI_PORT=5175
    ;;
  none)
    FRONTEND_DIR=""
    DEFAULT_UI_PORT=0
    START_FRONTEND=0
    ;;
  *)
    echo "Unsupported UI_APP: $UI_APP. Use ecommerce|hospital|social|none" >&2
    exit 1
    ;;
esac

case "$BACKEND_APP" in
  ecommerce)
    BACKEND_DIR="$ROOT_DIR/backend-ecommerce"
    ;;
  hospital)
    BACKEND_DIR="$ROOT_DIR/backend-hospital"
    ;;
  social)
    BACKEND_DIR="$ROOT_DIR/backend-social"
    ;;
  pdf-rag)
    BACKEND_DIR="$ROOT_DIR/pdf-rag-pipeline"
    BACKEND_KIND="fastapi"
    ;;
  *)
    echo "Unsupported BACKEND_APP: $BACKEND_APP. Use ecommerce|hospital|social|pdf-rag" >&2
    exit 1
    ;;
esac

UI_PORT="${UI_PORT:-$DEFAULT_UI_PORT}"
if [[ "$BACKEND_KIND" == "fastapi" ]]; then
  BACKEND_PORT="${BACKEND_PORT:-8090}"
else
  BACKEND_PORT="${BACKEND_PORT:-8080}"
fi
if [[ "${BACKEND_DEBUG:-}" == "" ]]; then
  if [[ "$BACKEND_APP" == "hospital" ]]; then
    BACKEND_DEBUG=1
  else
    BACKEND_DEBUG=0
  fi
fi
BACKEND_DEBUG_PORT="${BACKEND_DEBUG_PORT:-5005}"
BACKEND_DEBUG_SUSPEND="${BACKEND_DEBUG_SUSPEND:-n}"
# Set RUN_TESTS=1 to run Gradle tests during the server build (slower).
RUN_TESTS="${RUN_TESTS:-0}"
# Coturn (TURN) for WebRTC: START_COTURN unset = on for UI_APP=hospital only; 1 = always; 0 = skip.
START_COTURN="${START_COTURN:-}"
FASTAPI_VENV_DIR="${FASTAPI_VENV_DIR:-$ROOT_DIR/pdf-rag-pipeline/.venv}"
EMAIL_NOTIFY_DIR="${EMAIL_NOTIFY_DIR:-$ROOT_DIR/packages/email-notify}"
EMAIL_NOTIFY_INSTALL="${EMAIL_NOTIFY_INSTALL:-1}"
if [[ "${START_EMAIL_NOTIFY:-}" == "" ]]; then
  if [[ "$BACKEND_APP" == "hospital" ]]; then
    START_EMAIL_NOTIFY=1
  else
    START_EMAIL_NOTIFY=0
  fi
fi
HOSPITAL_APPOINTMENT_EMAIL_PORT="${HOSPITAL_APPOINTMENT_EMAIL_PORT:-8787}"
if [[ "${START_HOSPITAL_APPOINTMENT_EMAIL_SERVER:-}" == "" ]]; then
  if [[ "$BACKEND_APP" == "hospital" && "$START_EMAIL_NOTIFY" == "1" ]]; then
    START_HOSPITAL_APPOINTMENT_EMAIL_SERVER=1
  else
    START_HOSPITAL_APPOINTMENT_EMAIL_SERVER=0
  fi
fi

select_fastapi_python() {
  local candidates=(python3.13 python3.12 python3.11 python3.10 python3)
  local candidate
  for candidate in "${candidates[@]}"; do
    if ! command -v "$candidate" >/dev/null 2>&1; then
      continue
    fi
    if "$candidate" -c 'import sys; raise SystemExit(0 if sys.version_info >= (3, 9) else 1)' >/dev/null 2>&1; then
      echo "$candidate"
      return 0
    fi
  done
  return 1
}

setup_gradle_java() {
  # Gradle/Kotlin DSL in this project can fail on very new JDKs (e.g. 26).
  # Prefer JDK 21, then 17, when available.
  if [[ "${OSTYPE:-}" == darwin* ]] && command -v /usr/libexec/java_home >/dev/null 2>&1; then
    local selected_java_home=""
    selected_java_home="$(/usr/libexec/java_home -v 21 2>/dev/null || true)"
    if [[ -z "$selected_java_home" ]]; then
      selected_java_home="$(/usr/libexec/java_home -v 17 2>/dev/null || true)"
    fi
    if [[ -n "$selected_java_home" ]]; then
      export JAVA_HOME="$selected_java_home"
      export PATH="$JAVA_HOME/bin:$PATH"
      echo "Using JAVA_HOME for Gradle: $JAVA_HOME"
    fi
  fi
}

load_backend_env() {
  local env_file="$BACKEND_DIR/.env"
  if [[ -f "$env_file" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$env_file"
    set +a
    echo "Loaded backend env from $env_file"
  else
    echo "No backend env file found at $env_file"
  fi
}

describe_port_owner() {
  local port="$1"
  local label="${2:-service}"
  local pids

  pids="$(lsof -ti tcp:"$port" || true)"
  if [[ -z "$pids" ]]; then
    echo "Port $port is free."
    return
  fi

  echo "Port $port currently used by:"
  for pid in $pids; do
    local cmd cwd
    cmd="$(ps -p "$pid" -o command= 2>/dev/null || true)"
    cwd="$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | awk 'NR==1 {sub(/^n/, ""); print; exit}')"
    echo "  - PID $pid"
    if [[ -n "$cmd" ]]; then
      echo "    command: $cmd"
    fi
    if [[ -n "$cwd" ]]; then
      echo "    cwd    : $cwd"
    fi
    if [[ "$label" == "backend" && -n "$cwd" && "$cwd" != "$BACKEND_DIR"* ]]; then
      echo "    warning: this backend process is not from $BACKEND_DIR"
    fi
  done
}

kill_port() {
  local port="$1"
  local pids

  pids="$(lsof -ti tcp:"$port" || true)"
  if [[ -n "$pids" ]]; then
    echo "Killing process(es) on port $port: $pids"
    if ! kill -9 $pids 2>/dev/null; then
      echo "Warning: unable to kill one or more processes on port $port. You may need to stop them manually." >&2
    fi
  else
    echo "Port $port is free."
  fi
}

should_start_coturn() {
  if [[ "$START_COTURN" == "0" ]]; then
    return 1
  fi
  if [[ "$START_COTURN" == "1" ]]; then
    return 0
  fi
  [[ "$UI_APP" == "hospital" ]]
}

restart_coturn() {
  local compose_dir="$ROOT_DIR/infra/coturn"
  if [[ ! -f "$compose_dir/docker-compose.yml" ]]; then
    echo "No $compose_dir/docker-compose.yml; skipping coturn."
    return
  fi
  if ! command -v docker >/dev/null 2>&1; then
    echo "docker not in PATH; skipping coturn (see infra/coturn/README.md)."
    return
  fi
  if ! docker info >/dev/null 2>&1; then
    echo "Docker daemon not reachable (e.g. Docker Desktop not running or no /var/run/docker.sock)."
    echo "Skipping coturn; start Docker and re-run, or use START_COTURN=0 $0 to skip this step."
    return
  fi
  echo "Restarting coturn (stop existing stack if any, then up)..."
  if ! (
    cd "$compose_dir"
    docker compose down 2>/dev/null || true
    docker compose up -d
    docker compose ps
  ); then
    echo "Warning: coturn docker compose failed; continue without TURN." >&2
  fi
}

build_frontend() {
  if [[ "$START_FRONTEND" != "1" ]]; then
    echo "UI build skipped (UI_APP=$UI_APP)."
    return
  fi
  echo "Building UI (npm install + vite build)..."
  (
    cd "$FRONTEND_DIR"
    npm install
    npm run build
  )
}

build_backend() {
  echo "Building server..."
  (
    cd "$BACKEND_DIR"
    if [[ "$BACKEND_KIND" == "fastapi" ]]; then
      local python_bin=""
      python_bin="$(select_fastapi_python || true)"
      if [[ -z "$python_bin" ]]; then
        echo "Python 3.9+ not found; cannot install FastAPI dependencies." >&2
        exit 1
      fi
      echo "Using $python_bin for FastAPI."
      if [[ -x "$FASTAPI_VENV_DIR/bin/python" ]]; then
        if ! "$FASTAPI_VENV_DIR/bin/python" -c 'import sys; raise SystemExit(0 if sys.version_info >= (3, 9) else 1)' >/dev/null 2>&1; then
          echo "Recreating FastAPI virtualenv: existing env is below Python 3.9."
          rm -rf "$FASTAPI_VENV_DIR"
        fi
      fi
      if [[ ! -d "$FASTAPI_VENV_DIR" ]]; then
        echo "Creating FastAPI virtualenv at $FASTAPI_VENV_DIR..."
        "$python_bin" -m venv "$FASTAPI_VENV_DIR"
      fi
      "$FASTAPI_VENV_DIR/bin/python" -m pip install -r requirements.txt
      return
    fi
    setup_gradle_java
    local gradle_test_args=()
    if [[ "$RUN_TESTS" != "1" ]]; then
      gradle_test_args=(-x test)
    fi
    if [[ -x "./gradlew" ]]; then
      ./gradlew build "${gradle_test_args[@]}"
    elif [[ -f build.gradle.kts ]] || [[ -f build.gradle ]]; then
      if command -v gradle >/dev/null 2>&1; then
        gradle build "${gradle_test_args[@]}"
      else
        echo "Gradle build files found but neither ./gradlew nor 'gradle' is available." >&2
        exit 1
      fi
    elif [[ -x "./mvnw" ]]; then
      if [[ "$RUN_TESTS" == "1" ]]; then
        ./mvnw -q package
      else
        ./mvnw -q package -DskipTests
      fi
    elif command -v mvn >/dev/null 2>&1 && [[ -f pom.xml ]]; then
      if [[ "$RUN_TESTS" == "1" ]]; then
        mvn -q package
      else
        mvn -q package -DskipTests
      fi
    else
      echo "No Gradle/Maven build in backend/; skip server build." >&2
    fi
  )
}

build_email_notify() {
  if [[ "$START_EMAIL_NOTIFY" != "1" ]]; then
    return
  fi
  if [[ ! -f "$EMAIL_NOTIFY_DIR/package.json" ]]; then
    echo "No email-notify package found at $EMAIL_NOTIFY_DIR; skipping."
    return
  fi

  echo "Preparing email-notify package..."
  (
    cd "$EMAIL_NOTIFY_DIR"
    if [[ "$EMAIL_NOTIFY_INSTALL" == "1" ]]; then
      npm install
    fi
    npm run build
  )
}

start_frontend() {
  if [[ "$START_FRONTEND" != "1" ]]; then
    return
  fi
  echo "Starting UI on port $UI_PORT..."
  (
    cd "$FRONTEND_DIR"
    npm run dev -- --port "$UI_PORT"
  ) &
  UI_PID=$!
}

start_backend() {
  echo "Starting backend on port $BACKEND_PORT..."
  (
    cd "$BACKEND_DIR"
    if [[ "$BACKEND_KIND" == "fastapi" ]]; then
      load_backend_env
      if [[ -x "$FASTAPI_VENV_DIR/bin/python" ]]; then
        "$FASTAPI_VENV_DIR/bin/python" -m uvicorn api.main:app --host 0.0.0.0 --reload --port "$BACKEND_PORT"
      else
        echo "FastAPI virtualenv missing at $FASTAPI_VENV_DIR/bin/python." >&2
        echo "Run the script once to install dependencies." >&2
        exit 1
      fi
      return
    fi
    setup_gradle_java
    load_backend_env
    local debug_jvm_args="-agentlib:jdwp=transport=dt_socket,server=y,suspend=${BACKEND_DEBUG_SUSPEND},address=*:${BACKEND_DEBUG_PORT}"
    local boot_jar=""
    if [[ "$BACKEND_DEBUG" == "1" ]]; then
      for candidate in "$BACKEND_DIR"/build/libs/*.jar; do
        [[ -f "$candidate" ]] || continue
        case "$candidate" in
          *-plain.jar) continue ;;
        esac
        boot_jar="$candidate"
        break
      done
    fi
    # Prefer Gradle when this repo uses build.gradle.kts / gradlew (see backend/).
    if [[ -x "./gradlew" ]]; then
      if [[ "$BACKEND_DEBUG" == "1" ]]; then
        if [[ -n "$boot_jar" ]]; then
          java $debug_jvm_args -jar "$boot_jar" --server.port="$BACKEND_PORT"
        else
          echo "Debug mode requested, but no boot jar found in $BACKEND_DIR/build/libs." >&2
          echo "Run build first or disable BACKEND_DEBUG." >&2
          exit 1
        fi
      else
        ./gradlew bootRun --args="--server.port=$BACKEND_PORT"
      fi
    elif [[ -f build.gradle.kts ]] || [[ -f build.gradle ]]; then
      if command -v gradle >/dev/null 2>&1; then
        if [[ "$BACKEND_DEBUG" == "1" ]]; then
          if [[ -n "$boot_jar" ]]; then
            java $debug_jvm_args -jar "$boot_jar" --server.port="$BACKEND_PORT"
          else
            echo "Debug mode requested, but no boot jar found in $BACKEND_DIR/build/libs." >&2
            echo "Run build first or disable BACKEND_DEBUG." >&2
            exit 1
          fi
        else
          gradle bootRun --args="--server.port=$BACKEND_PORT"
        fi
      else
        echo "Gradle build files found but neither ./gradlew nor 'gradle' is available." >&2
        echo "Run once in backend/: gradle wrapper   (or install Gradle)." >&2
        exit 1
      fi
    elif [[ -x "./mvnw" ]]; then
      if [[ "$BACKEND_DEBUG" == "1" ]]; then
        ./mvnw spring-boot:run -Dspring-boot.run.arguments="--server.port=$BACKEND_PORT" -Dspring-boot.run.jvmArguments="$debug_jvm_args"
      else
        ./mvnw spring-boot:run -Dspring-boot.run.arguments="--server.port=$BACKEND_PORT"
      fi
    elif command -v mvn >/dev/null 2>&1 && [[ -f pom.xml ]]; then
      if [[ "$BACKEND_DEBUG" == "1" ]]; then
        mvn spring-boot:run -Dspring-boot.run.arguments="--server.port=$BACKEND_PORT" -Dspring-boot.run.jvmArguments="$debug_jvm_args"
      else
        mvn spring-boot:run -Dspring-boot.run.arguments="--server.port=$BACKEND_PORT"
      fi
    else
      echo "No Spring Boot runner found (./gradlew, gradle, mvnw, or mvn + pom.xml)." >&2
      exit 1
    fi
  ) &
  BACKEND_PID=$!
}

start_email_notify() {
  if [[ "$START_EMAIL_NOTIFY" != "1" ]]; then
    return
  fi
  if [[ ! -f "$EMAIL_NOTIFY_DIR/package.json" ]]; then
    return
  fi

  echo "Starting email-notify watcher..."
  (
    cd "$EMAIL_NOTIFY_DIR"
    npm run build -- --watch
  ) &
  EMAIL_NOTIFY_PID=$!
}

start_hospital_appointment_email_server() {
  if [[ "$START_HOSPITAL_APPOINTMENT_EMAIL_SERVER" != "1" ]]; then
    return
  fi
  if [[ ! -f "$EMAIL_NOTIFY_DIR/package.json" ]]; then
    return
  fi

  echo "Starting hospital appointment email server on port $HOSPITAL_APPOINTMENT_EMAIL_PORT..."
  (
    cd "$EMAIL_NOTIFY_DIR"
    if [[ -f .env ]]; then
      set -a
      # shellcheck disable=SC1090
      source .env
      set +a
    fi
    export HOSPITAL_APPOINTMENT_EMAIL_PORT="$HOSPITAL_APPOINTMENT_EMAIL_PORT"
    node dist/src/hospitalAppointmentEmailServer.js
  ) &
  HOSPITAL_EMAIL_SERVER_PID=$!
}

cleanup() {
  echo ""
  echo "Stopping services..."
  if [[ -n "${UI_PID:-}" ]]; then kill "$UI_PID" 2>/dev/null || true; fi
  if [[ -n "${BACKEND_PID:-}" ]]; then kill "$BACKEND_PID" 2>/dev/null || true; fi
  if [[ -n "${EMAIL_NOTIFY_PID:-}" ]]; then kill "$EMAIL_NOTIFY_PID" 2>/dev/null || true; fi
  if [[ -n "${HOSPITAL_EMAIL_SERVER_PID:-}" ]]; then kill "$HOSPITAL_EMAIL_SERVER_PID" 2>/dev/null || true; fi
}

trap cleanup EXIT INT TERM

build_frontend
build_backend
build_email_notify

echo "Preparing ports..."
describe_port_owner "$UI_PORT" "ui"
describe_port_owner "$BACKEND_PORT" "backend"
if [[ "$START_HOSPITAL_APPOINTMENT_EMAIL_SERVER" == "1" ]]; then
  describe_port_owner "$HOSPITAL_APPOINTMENT_EMAIL_PORT" "hospital-appointment-email"
fi
kill_port "$UI_PORT"
kill_port "$BACKEND_PORT"
if [[ "$START_HOSPITAL_APPOINTMENT_EMAIL_SERVER" == "1" ]]; then
  kill_port "$HOSPITAL_APPOINTMENT_EMAIL_PORT"
fi

if should_start_coturn; then
  restart_coturn
else
  echo "Coturn skipped (START_COTURN=$START_COTURN, UI_APP=$UI_APP). Tip: START_COTURN=1 $0 to force."
fi

start_frontend
start_email_notify
start_hospital_appointment_email_server
start_backend

echo ""
echo "UI App   : $UI_APP"
echo "Backend  : $BACKEND_APP"
if [[ "$START_FRONTEND" == "1" ]]; then
  echo "UI       : http://localhost:$UI_PORT"
else
  echo "UI       : skipped"
fi
echo "Server   : http://localhost:$BACKEND_PORT"
if [[ "$START_EMAIL_NOTIFY" == "1" ]]; then
  echo "Email    : email-notify build watcher (packages/email-notify)"
else
  echo "Email    : skipped"
fi
if [[ "$START_HOSPITAL_APPOINTMENT_EMAIL_SERVER" == "1" ]]; then
  echo "Appt mail: http://localhost:$HOSPITAL_APPOINTMENT_EMAIL_PORT (POST /hospital/appointment-created)"
else
  echo "Appt mail: skipped"
fi
if [[ "$BACKEND_DEBUG" == "1" ]]; then
  echo "Debug    : JDWP open on localhost:$BACKEND_DEBUG_PORT (suspend=$BACKEND_DEBUG_SUSPEND)"
  echo "IntelliJ : Run -> Attach to Process / Remote JVM Debug"
fi
echo "Note     : UI and server were built before start; dev server still uses Vite (not dist/)."
if [[ "$RUN_TESTS" != "1" ]]; then
  echo "Tip      : RUN_TESTS=1 $0  to include Gradle/Maven tests in the server build."
fi
echo "Tip      : BACKEND_DEBUG=1 BACKEND_DEBUG_PORT=5005 $0"
echo "Tip      : UI_APP=hospital $0  (or UI_APP=social $0)"
echo "Tip      : BACKEND_APP=pdf-rag UI_APP=none $0"
echo "Tip      : Hospital dev starts coturn via Docker; START_COTURN=0 $0 to skip."
echo "Tip      : BACKEND_APP=social UI_APP=ecommerce $0"
echo "Tip      : START_EMAIL_NOTIFY=0 $0  to skip email-notify prep/watch."
echo "Tip      : START_HOSPITAL_APPOINTMENT_EMAIL_SERVER=0 $0  to skip appointment email HTTP server."
echo "Tip      : APP_EMAIL_ENABLED=true for backend to use the internal email server (app.email.*)."
echo "Press Ctrl+C to stop all services."
echo ""

wait
