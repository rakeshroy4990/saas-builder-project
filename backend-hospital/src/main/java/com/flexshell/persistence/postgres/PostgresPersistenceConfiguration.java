package com.flexshell.persistence.postgres;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

@Configuration
@ConditionalOnProperty(name = "app.persistence.provider", havingValue = "postgres")
@EnableJpaRepositories(basePackages = "com.flexshell.persistence.postgres.repository")
@EntityScan(basePackages = "com.flexshell.persistence.postgres.model")
public class PostgresPersistenceConfiguration {
}
