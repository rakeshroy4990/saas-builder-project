#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"
BACKEND_DIR="$ROOT_DIR/backend"

UI_PORT="${UI_PORT:-5173}"
BACKEND_PORT="${BACKEND_PORT:-8080}"
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
    # Prefer Gradle when this repo uses build.gradle.kts / gradlew (see backend/).
    if [[ -x "./gradlew" ]]; then
      ./gradlew bootRun --args="--server.port=$BACKEND_PORT"
    elif [[ -f build.gradle.kts ]] || [[ -f build.gradle ]]; then
      if command -v gradle >/dev/null 2>&1; then
        gradle bootRun --args="--server.port=$BACKEND_PORT"
      else
        echo "Gradle build files found but neither ./gradlew nor 'gradle' is available." >&2
        echo "Run once in backend/: gradle wrapper   (or install Gradle)." >&2
        exit 1
      fi
    elif [[ -x "./mvnw" ]]; then
      ./mvnw spring-boot:run -Dspring-boot.run.arguments="--server.port=$BACKEND_PORT"
    elif command -v mvn >/dev/null 2>&1 && [[ -f pom.xml ]]; then
      mvn spring-boot:run -Dspring-boot.run.arguments="--server.port=$BACKEND_PORT"
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
echo "UI       : http://localhost:$UI_PORT"
echo "Backend  : http://localhost:$BACKEND_PORT"
echo "Note     : UI and server were built before start; dev server still uses Vite (not dist/)."
if [[ "$RUN_TESTS" != "1" ]]; then
  echo "Tip      : RUN_TESTS=1 $0  to include Gradle/Maven tests in the server build."
fi
echo "Press Ctrl+C to stop both."
echo ""

wait
