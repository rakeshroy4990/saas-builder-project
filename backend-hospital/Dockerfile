FROM eclipse-temurin:17-jdk-jammy AS build
WORKDIR /app

# ── Layer 1: Gradle wrapper + build files only ──────────────────
# Cached unless build.gradle/settings.gradle changes
COPY backend-hospital/gradle/        ./gradle/
COPY backend-hospital/gradlew        ./
COPY backend-hospital/build.gradle   ./
COPY backend-hospital/settings.gradle ./

# ── Layer 2: Dependency download ────────────────────────────────
# Only reruns when build.gradle changes — NOT when lib source changes
RUN ./gradlew dependencies --no-daemon --no-build-cache \
    && echo "Dependencies downloaded successfully"
# Removed || true — fail loudly if deps can't resolve

# ── Layer 3: Sibling libs (source, changes often) ───────────────
COPY backend-uimetadata-lib/ ../backend-uimetadata-lib/
COPY backend-auth-lib/       ../backend-auth-lib/
COPY backend-realtime-lib/   ../backend-realtime-lib/

# ── Layer 4: App source ─────────────────────────────────────────
COPY backend-hospital/src/ ./src/

# ── Layer 5: Build ──────────────────────────────────────────────
RUN ./gradlew build -x test --no-daemon

FROM eclipse-temurin:17-jre-jammy AS runtime
WORKDIR /app
COPY --from=build /app/build/libs/*.jar app.jar
EXPOSE 8080
CMD ["java", "-XX:+UseContainerSupport", "-XX:MaxRAMPercentage=75.0", "-jar", "app.jar"]