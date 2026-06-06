package com.flexshell.config;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import org.springframework.boot.autoconfigure.jackson.Jackson2ObjectMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * HTTP JSON wire format: PascalCase property names ({@code PatientName}, {@code ErrorCode}).
 */
@Configuration
public class JacksonApiNamingConfig {

    @Bean
    public Jackson2ObjectMapperBuilderCustomizer apiJsonUpperCamelCase() {
        return builder -> builder.propertyNamingStrategy(PropertyNamingStrategies.UPPER_CAMEL_CASE);
    }
}
