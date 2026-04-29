FROM eclipse-temurin:17-jdk-jammy AS build
WORKDIR /app

# Copy sibling libs
COPY backend-uimetadata-lib/ ../backend-uimetadata-lib/
COPY backend-auth-lib/       ../backend-auth-lib/
COPY backend-realtime-lib/   ../backend-realtime-lib/

# Copy gradle wrapper + build files ONLY first
# This layer is cached unless build.gradle/settings.gradle changes
COPY backend-hospital/gradle/       ./gradle/
COPY backend-hospital/gradlew       ./
COPY backend-hospital/build.gradle  ./
COPY backend-hospital/settings.gradle ./

# Download all dependencies — cached layer, reused on every build
# unless build.gradle changes
RUN ./gradlew dependencies --no-daemon || true

# Now copy the actual source code
COPY backend-hospital/src/ ./src/

# Build — only reruns when src/ changes, deps already cached above
RUN ./gradlew build -x test --no-daemon

FROM eclipse-temurin:17-jre-jammy AS runtime
WORKDIR /app
COPY --from=build /app/build/libs/*.jar app.jar
EXPOSE 8080
CMD ["java", "-XX:+UseContainerSupport", "-XX:MaxRAMPercentage=75.0", "-jar", "app.jar"]