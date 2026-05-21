FROM eclipse-temurin:17-jdk-jammy AS build
WORKDIR /app

# ── Layer 1: Gradle wrapper + build files ───────────────────────
COPY backend-hospital/gradle/        ./gradle/
COPY backend-hospital/gradlew        ./
COPY backend-hospital/build.gradle   ./
COPY backend-hospital/settings.gradle ./

# ── Layer 2: Sibling composite builds (required for includeBuild) ─
COPY backend-uimetadata-lib/ ../backend-uimetadata-lib/
COPY backend-auth-lib/       ../backend-auth-lib/
COPY backend-realtime-lib/   ../backend-realtime-lib/

# ── Layer 3: App source ─────────────────────────────────────────
COPY backend-hospital/src/ ./src/

# ── Layer 4: Single compile (bootJar only — no separate `dependencies` task) ──
# BuildKit cache mounts persist Gradle downloads between Cloud Build runs.
RUN --mount=type=cache,target=/root/.gradle/caches \
    --mount=type=cache,target=/root/.gradle/wrapper \
    ./gradlew bootJar -x test --no-daemon

FROM eclipse-temurin:17-jre-jammy AS runtime
WORKDIR /app
COPY --from=build /app/build/libs/*.jar app.jar
EXPOSE 8080
CMD ["java", "-XX:+UseContainerSupport", "-XX:MaxRAMPercentage=75.0", "-jar", "app.jar"]
