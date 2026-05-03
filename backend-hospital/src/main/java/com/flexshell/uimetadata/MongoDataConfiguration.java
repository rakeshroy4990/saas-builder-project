package com.flexshell.uimetadata;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;

/**
 * Enables Mongo repositories only when {@code spring.data.mongodb.uri} is set (e.g. from
 * {@code SPRING_DATA_MONGODB_URI}). Keeps tests and local runs working without Atlas.
 */
@Configuration
@ConditionalOnProperty(prefix = "app.mongo", name = "enabled", havingValue = "true")
public class MongoDataConfiguration {
    // Intentionally empty: when Mongo is enabled, Spring Boot auto-config will scan repositories.
}
