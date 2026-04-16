#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UI_APP="${UI_APP:-ecommerce}"
BACKEND_APP="${BACKEND_APP:-$UI_APP}"

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
  *)
    echo "Unsupported UI_APP: $UI_APP. Use ecommerce|hospital|social" >&2
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
  *)
    echo "Unsupported BACKEND_APP: $BACKEND_APP. Use ecommerce|hospital|social" >&2
    exit 1
    ;;
esac

UI_PORT="${UI_PORT:-$DEFAULT_UI_PORT}"
BACKEND_PORT="${BACKEND_PORT:-8080}"
BACKEND_DEBUG="${BACKEND_DEBUG:-0}"
BACKEND_DEBUG_PORT="${BACKEND_DEBUG_PORT:-5005}"
BACKEND_DEBUG_SUSPEND="${BACKEND_DEBUG_SUSPEND:-n}"
# Set RUN_TESTS=1 to run Gradle tests during the server build (slower).
RUN_TESTS="${RUN_TESTS:-0}"

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
    kill -9 $pids
  else
    echo "Port $port is free."
  fi
}

build_frontend() {
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

start_frontend() {
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

cleanup() {
  echo ""
  echo "Stopping services..."
  if [[ -n "${UI_PID:-}" ]]; then kill "$UI_PID" 2>/dev/null || true; fi
  if [[ -n "${BACKEND_PID:-}" ]]; then kill "$BACKEND_PID" 2>/dev/null || true; fi
}

trap cleanup EXIT INT TERM

build_frontend
build_backend

echo "Preparing ports..."
describe_port_owner "$UI_PORT" "ui"
describe_port_owner "$BACKEND_PORT" "backend"
kill_port "$UI_PORT"
kill_port "$BACKEND_PORT"

start_frontend
start_backend

echo ""
echo "UI App   : $UI_APP"
echo "Backend  : $BACKEND_APP"
echo "UI       : http://localhost:$UI_PORT"
echo "Server   : http://localhost:$BACKEND_PORT"
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
echo "Tip      : BACKEND_APP=social UI_APP=ecommerce $0"
echo "Press Ctrl+C to stop both."
echo ""

wait
