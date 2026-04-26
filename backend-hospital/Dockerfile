FROM eclipse-temurin:17-jdk-alpine AS build

# Mirror local structure at root level
# locally:  ~/saas-builder-project/backend-hospital
#           ~/saas-builder-project/backend-uimetadata-lib
# docker:   /backend-hospital
#           /backend-uimetadata-lib  ← ../  resolves correctly

COPY backend-uimetadata-lib/ /backend-uimetadata-lib/
COPY backend-auth-lib/       /backend-auth-lib/
COPY backend-realtime-lib/   /backend-realtime-lib/
COPY backend-hospital/       /backend-hospital/

RUN ls /

WORKDIR /backend-hospital
RUN chmod +x gradlew && ./gradlew bootJar --no-daemon

FROM eclipse-temurin:17-jre-alpine
COPY --from=build /backend-hospital/build/libs/*.jar /app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app.jar"]