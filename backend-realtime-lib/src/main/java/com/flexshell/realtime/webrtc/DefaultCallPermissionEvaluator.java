package com.flexshell.realtime.webrtc;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.stereotype.Component;

/**
 * Default conservative policy: deny all unless explicitly allowed via config.
 */
@Component
@ConditionalOnMissingBean(CallPermissionEvaluator.class)
public class DefaultCallPermissionEvaluator implements CallPermissionEvaluator {
    @Value("${app.realtime.calls.allow-all:false}")
    private boolean allowAll;

    @Override
    public boolean canInitiate(String initiatorId, String receiverId) {
        return allowAll;
    }
}

