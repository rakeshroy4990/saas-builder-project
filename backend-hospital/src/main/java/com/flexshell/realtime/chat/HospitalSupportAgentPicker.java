package com.flexshell.realtime.chat;

import com.flexshell.auth.UserEntity;
import com.flexshell.persistence.api.UserAccess;
import com.flexshell.auth.UserRole;
import com.flexshell.realtime.chat.support.SupportAgentPicker;
import com.flexshell.realtime.ws.auth.WsSessionAuthRegistry;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Objects;

@Component
public class HospitalSupportAgentPicker implements SupportAgentPicker {
    private final WsSessionAuthRegistry wsSessionAuthRegistry;
    private final ObjectProvider<UserAccess> userAccessProvider;

    public HospitalSupportAgentPicker(
            WsSessionAuthRegistry wsSessionAuthRegistry,
            ObjectProvider<UserAccess> userAccessProvider) {
        this.wsSessionAuthRegistry = wsSessionAuthRegistry;
        this.userAccessProvider = userAccessProvider;
    }

    @Override
    public List<String> listOnlineAgentUserIds() {
        return wsSessionAuthRegistry.snapshot().values().stream()
                .map(WsSessionAuthRegistry.SessionAuth::userId)
                .map(this::normalize)
                .filter(id -> !id.isEmpty() && !id.startsWith("anonymous:"))
                .distinct()
                .filter(this::isAdmin)
                .toList();
    }

    private boolean isAdmin(String userId) {
        UserAccess users = userAccessProvider.getIfAvailable();
        if (users == null) {
            return false;
        }
        UserEntity user = users.findById(userId).orElse(null);
        return user != null && user.getRole() == UserRole.ADMIN;
    }

    private String normalize(String v) {
        return Objects.toString(v, "").trim();
    }
}

