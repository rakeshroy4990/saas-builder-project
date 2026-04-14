package com.example.flexshell.uimetadata;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories;

/**
 * Enables Mongo repositories only when {@code spring.data.mongodb.uri} is set (e.g. from
 * {@code SPRING_DATA_MONGODB_URI}). Keeps tests and local runs working without Atlas.
 */
@Configuration
@ConditionalOnProperty(prefix = "spring.data.mongodb", name = "uri")
@EnableMongoRepositories(basePackageClasses = UiMetadataRepository.class)
public class MongoDataConfiguration {
}
