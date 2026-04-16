package com.flexshell.realtime.chat.support;

import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnMissingBean(SupportRequesterProfileResolver.class)
public class DefaultSupportRequesterProfileResolver implements SupportRequesterProfileResolver {
    @Override
    public String resolveDisplayName(String requesterUserId) {
        return requesterUserId == null ? "" : requesterUserId.trim();
    }
}

