FROM eclipse-temurin:17-jdk-jammy AS build
WORKDIR /app

# Copy all sibling libs the project depends on
COPY backend-uimetadata-lib/ ../backend-uimetadata-lib/
COPY backend-auth-lib/       ../backend-auth-lib/
COPY backend-realtime-lib/   ../backend-realtime-lib/

# Copy the main service
COPY backend-hospital/ .

RUN ./gradlew build -x test --no-daemon

FROM eclipse-temurin:17-jre-jammy AS runtime
WORKDIR /app
COPY --from=build /app/build/libs/*.jar app.jar
EXPOSE 8080
CMD ["java", "-XX:+UseContainerSupport", "-XX:MaxRAMPercentage=75.0", "-jar", "app.jar"]