FROM eclipse-temurin:17-jre-jammy

WORKDIR /app

COPY --from=build build/libs/*.jar app.jar

EXPOSE 8080

CMD ["java", "-XX:+UseContainerSupport", "-XX:MaxRAMPercentage=75.0", "-jar", "app.jar"]