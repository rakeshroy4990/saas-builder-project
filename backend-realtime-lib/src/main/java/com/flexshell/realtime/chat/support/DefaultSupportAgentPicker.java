package com.flexshell.realtime.chat.support;

import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@ConditionalOnMissingBean(SupportAgentPicker.class)
public class DefaultSupportAgentPicker implements SupportAgentPicker {
    @Override
    public List<String> listOnlineAgentUserIds() {
        return List.of();
    }
}

