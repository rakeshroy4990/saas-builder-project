
package com.flexshell;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@SpringBootApplication
@EnableScheduling
public class FlexShellApplication {
    private static final Logger log = LoggerFactory.getLogger(FlexShellApplication.class);
    private static final String MONGO_URI_ENV = "SPRING_DATA_MONGODB_URI";
    private static final String MONGO_URL_ENV = "MONGODB_URL";
    private static final String MONGO_PASSWORD_ENV = "MONGODB_PASSWORD";
    private static final Pattern TEMPLATE_PATTERN = Pattern.compile("\\{\\{([A-Z0-9_]+)}}");

    public static void main(String[] args) {
        SpringApplication app = new SpringApplication(FlexShellApplication.class);
        String mongoUri = resolveMongoUri();
        if (mongoUri == null || mongoUri.isBlank()) {
            log.warn("MongoDB URI not resolved. Disabling Mongo auto-configuration; Mongo repositories (including UserRepository) will not be available.");
            Map<String, Object> defaults = new HashMap<>();
            defaults.put("app.mongo.enabled", "false");
            defaults.put(
                    "spring.autoconfigure.exclude",
                    String.join(
                            ",",
                            "org.springframework.boot.autoconfigure.mongo.MongoAutoConfiguration",
                            "org.springframework.boot.autoconfigure.data.mongo.MongoDataAutoConfiguration",
                            "org.springframework.boot.autoconfigure.data.mongo.MongoRepositoriesAutoConfiguration"));
            app.setDefaultProperties(defaults);
        } else {
            log.info("MongoDB URI resolved. Enabling Mongo repositories.");
            Map<String, Object> defaults = new HashMap<>();
            defaults.put("app.mongo.enabled", "true");
            defaults.put("spring.data.mongodb.uri", mongoUri);
            app.setDefaultProperties(defaults);
        }
        app.run(args);
    }

    /**
     * Supported env vars:
     * 1) SPRING_DATA_MONGODB_URI (preferred, full URI)
     * 2) MONGODB_URL + MONGODB_PASSWORD (legacy `<db_password>` token)
     * 3) MONGODB_URL with `{{ENV_VAR}}` placeholders, e.g. {{DB_USER}} and {{DB_PASSWORD}}
     */
    private static String resolveMongoUri() {
        String explicit = System.getenv(MONGO_URI_ENV);
        if (explicit != null && !explicit.isBlank()) return explicit;

        String url = System.getenv(MONGO_URL_ENV);
        if (url == null || url.isBlank()) return null;

        url = replaceDoubleBraceTemplates(url);

        String password = System.getenv(MONGO_PASSWORD_ENV);
        if (password != null && !password.isBlank() && url.contains("<db_password>")) {
            String encoded = URLEncoder.encode(password, StandardCharsets.UTF_8).replace("+", "%20");
            return url.replace("<db_password>", encoded);
        }
        return url;
    }

    private static String replaceDoubleBraceTemplates(String urlTemplate) {
        Matcher matcher = TEMPLATE_PATTERN.matcher(urlTemplate);
        StringBuffer resolved = new StringBuffer();
        while (matcher.find()) {
            String envVarName = matcher.group(1);
            String envValue = System.getenv(envVarName);
            if (envValue == null || envValue.isBlank()) {
                throw new IllegalStateException(
                        "MONGODB_URL contains {{" + envVarName + "}} but environment variable '"
                                + envVarName
                                + "' is missing or empty. Set it on the host (e.g. Render), or use SPRING_DATA_MONGODB_URI with a full connection string.");
            }
            // Userinfo in mongodb+srv URIs must be percent-encoded (user, password, and special chars).
            String replacement = encodeUriSegment(envValue);
            matcher.appendReplacement(resolved, Matcher.quoteReplacement(replacement));
        }
        matcher.appendTail(resolved);
        String out = resolved.toString();
        if (out.contains("{{")) {
            throw new IllegalStateException(
                    "MONGODB_URL still contains '{{' after template resolution; check placeholders and env vars.");
        }
        return out;
    }

    private static String encodeUriSegment(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8).replace("+", "%20");
    }
}
