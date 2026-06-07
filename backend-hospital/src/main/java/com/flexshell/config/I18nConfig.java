package com.flexshell.config;

import com.flexshell.auth.i18n.ApiMessageResolver;
import com.flexshell.i18n.HospitalMessageResolver;
import com.flexshell.i18n.LayeredMessageSource;
import com.flexshell.i18n.LocalizedApiMessages;
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
        ReloadableResourceBundleMessageSource hospital = new ReloadableResourceBundleMessageSource();
        hospital.setBasename("classpath:hospital-messages");
        hospital.setDefaultEncoding("UTF-8");
        hospital.setFallbackToSystemLocale(false);

        ReloadableResourceBundleMessageSource auth = new ReloadableResourceBundleMessageSource();
        auth.setBasename("classpath:messages");
        auth.setDefaultEncoding("UTF-8");
        auth.setFallbackToSystemLocale(false);

        return new LayeredMessageSource(hospital, auth);
    }

    @Bean
    ApiMessageResolver apiMessageResolver(MessageSource apiMessageSource) {
        return new ApiMessageResolver(apiMessageSource);
    }

    @Bean
    HospitalMessageResolver hospitalMessageResolver(MessageSource apiMessageSource) {
        return new HospitalMessageResolver(apiMessageSource);
    }

    @Bean
    LocalizedApiMessages localizedApiMessages(HospitalMessageResolver hospitalMessageResolver) {
        return new LocalizedApiMessages(hospitalMessageResolver);
    }

    @Bean
    RequestLocaleFilter requestLocaleFilter(ObjectProvider<UserAccess> userAccessProvider) {
        return new RequestLocaleFilter(userAccessProvider);
    }
}
