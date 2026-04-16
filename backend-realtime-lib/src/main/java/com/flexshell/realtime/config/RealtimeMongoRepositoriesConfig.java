package com.flexshell.realtime.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConditionalOnProperty(prefix = "spring.data.mongodb", name = "uri")
public class RealtimeMongoRepositoriesConfig {
    // Intentionally empty.
    // When MongoDB is enabled, Spring Boot auto-config enables repository scanning for the application.
    // Explicit @EnableMongoRepositories here can cause duplicate repository bean registration in host apps.
}

