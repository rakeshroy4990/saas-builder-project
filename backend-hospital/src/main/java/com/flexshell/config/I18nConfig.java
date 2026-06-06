package com.flexshell.config;

import com.flexshell.auth.i18n.ApiMessageResolver;
import com.flexshell.persistence.api.UserAccess;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.MessageSource;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.support.ReloadableResourceBundleMessageSource;

@Configuration
public class I18nConfig {

    @Bean
    MessageSource apiMessageSource() {
        ReloadableResourceBundleMessageSource source = new ReloadableResourceBundleMessageSource();
        source.setBasename("classpath:messages");
        source.setDefaultEncoding("UTF-8");
        source.setFallbackToSystemLocale(false);
        return source;
    }

    @Bean
    ApiMessageResolver apiMessageResolver(MessageSource apiMessageSource) {
        return new ApiMessageResolver(apiMessageSource);
    }

    @Bean
    RequestLocaleFilter requestLocaleFilter(ObjectProvider<UserAccess> userAccessProvider) {
        return new RequestLocaleFilter(userAccessProvider);
    }
}
