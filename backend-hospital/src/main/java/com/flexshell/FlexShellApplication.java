
package com.flexshell;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.util.HashMap;
import java.util.Map;

@SpringBootApplication
@EnableScheduling
public class FlexShellApplication {
    private static final Logger log = LoggerFactory.getLogger(FlexShellApplication.class);
    private static final String PERSISTENCE_PROVIDER_ENV = "APP_PERSISTENCE_PROVIDER";

    private static final String EXCLUDE_MONGO = String.join(
            ",",
            "org.springframework.boot.autoconfigure.mongo.MongoAutoConfiguration",
            "org.springframework.boot.autoconfigure.data.mongo.MongoDataAutoConfiguration",
            "org.springframework.boot.autoconfigure.data.mongo.MongoRepositoriesAutoConfiguration");

    public static void main(String[] args) {
        String persistence = resolvePersistenceProvider();
        if (!"postgres".equalsIgnoreCase(persistence)) {
            throw new IllegalStateException(
                    "MongoDB persistence is no longer supported. Set APP_PERSISTENCE_PROVIDER=postgres.");
        }

        SpringApplication app = new SpringApplication(FlexShellApplication.class);
        Map<String, Object> defaults = new HashMap<>();
        log.info("Using PostgreSQL persistence (Flyway + JPA). Mongo auto-configuration disabled.");
        defaults.put("app.persistence.provider", "postgres");
        defaults.put("app.mongo.enabled", "false");
        defaults.put("spring.profiles.active", "postgres");
        defaults.put("spring.flyway.enabled", "true");
        defaults.put("spring.jpa.hibernate.ddl-auto", "none");
        defaults.put("spring.jpa.open-in-view", "false");
        defaults.put("spring.autoconfigure.exclude", EXCLUDE_MONGO);
        app.setDefaultProperties(defaults);
        app.run(args);
    }

    /**
     * Order: {@code APP_PERSISTENCE_PROVIDER} env → {@code -Dapp.persistence.provider=...} system property
     * → default {@code postgres}.
     */
    private static String resolvePersistenceProvider() {
        String v = System.getenv(PERSISTENCE_PROVIDER_ENV);
        if (v != null && !v.isBlank()) {
            return v.trim();
        }
        v = System.getProperty("app.persistence.provider");
        if (v != null && !v.isBlank()) {
            return v.trim();
        }
        return "postgres";
    }
}
