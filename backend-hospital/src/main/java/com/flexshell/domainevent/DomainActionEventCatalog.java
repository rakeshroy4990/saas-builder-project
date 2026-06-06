package com.flexshell.domainevent;

import com.flexshell.persistence.postgres.model.DomainActionEventJpaEntity;
import com.flexshell.persistence.postgres.repository.DomainActionEventJpaRepository;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;

@Service
@ConditionalOnProperty(name = "app.persistence.provider", havingValue = "postgres")
public class DomainActionEventCatalog {

    private final DomainActionEventJpaRepository repository;

    public DomainActionEventCatalog(DomainActionEventJpaRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public Optional<DomainActionEventJpaEntity> resolveBinding(String httpMethod, String requestPath) {
        String method = Objects.toString(httpMethod, "").trim().toUpperCase(Locale.ROOT);
        List<DomainActionEventJpaEntity> bindings = repository.findByEnabledTrueAndDeletedFalseOrderByHttpMethodAscEndpointPatternAsc();
        for (DomainActionEventJpaEntity binding : bindings) {
            if (!binding.getHttpMethod().equalsIgnoreCase(method)) {
                continue;
            }
            if (DomainEventEndpointNormalizer.matchesPattern(requestPath, binding.getEndpointPattern())) {
                return Optional.of(binding);
            }
        }
        return Optional.empty();
    }

    @Transactional(readOnly = true)
    public List<DomainActionEventJpaEntity> listAll() {
        return repository.findByDeletedFalseOrderByHttpMethodAscEndpointPatternAsc();
    }
}
