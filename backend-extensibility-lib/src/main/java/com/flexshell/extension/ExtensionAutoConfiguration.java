package com.flexshell.extension;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;

import java.nio.file.Path;

@Configuration
public class ExtensionAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean
    public EndpointMapLoader endpointMapLoader(
            ObjectMapper objectMapper,
            @Value("${app.extension.endpoint-map-path:}") String externalPath
    ) {
        Path path = externalPath == null || externalPath.isBlank()
                ? null
                : Path.of(externalPath.trim());
        return new EndpointMapLoader(objectMapper, path);
    }

    @Bean
    @ConditionalOnMissingBean
    public HookRegistry hookRegistry(EndpointMapLoader endpointMapLoader) {
        return new HookRegistry(endpointMapLoader);
    }

    @Bean
    @ConditionalOnMissingBean
    public ExtensionHookInvoker extensionHookInvoker(HookRegistry hookRegistry) {
        return new ExtensionHookInvoker(hookRegistry);
    }

    @Bean
    @ConditionalOnMissingBean
    public FilterRegistrationBean<ExtensionRerouteFilter> extensionRerouteFilter(HookRegistry hookRegistry) {
        FilterRegistrationBean<ExtensionRerouteFilter> registration = new FilterRegistrationBean<>();
        registration.setFilter(new ExtensionRerouteFilter(hookRegistry));
        registration.addUrlPatterns("/api/*");
        registration.setOrder(Ordered.HIGHEST_PRECEDENCE + 20);
        return registration;
    }
}
