package com.flexshell.realtime.chat;

import com.flexshell.auth.UserEntity;
import com.flexshell.auth.UserRepository;
import com.flexshell.auth.UserRole;
import com.flexshell.realtime.chat.support.SupportAgentPicker;
import com.flexshell.realtime.ws.auth.WsSessionAuthRegistry;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Objects;

@Component
public class HospitalSupportAgentPicker implements SupportAgentPicker {
    private final WsSessionAuthRegistry wsSessionAuthRegistry;
    private final UserRepository userRepository;

    public HospitalSupportAgentPicker(WsSessionAuthRegistry wsSessionAuthRegistry, UserRepository userRepository) {
        this.wsSessionAuthRegistry = wsSessionAuthRegistry;
        this.userRepository = userRepository;
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
        UserEntity user = userRepository.findById(userId).orElse(null);
        return user != null && user.getRole() == UserRole.ADMIN;
    }

    private String normalize(String v) {
        return Objects.toString(v, "").trim();
    }
}

