package com.flexshell.realtime.chat;

import com.flexshell.auth.UserEntity;
import com.flexshell.persistence.api.UserAccess;
import com.flexshell.realtime.chat.support.SupportRequesterProfileResolver;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

import java.util.Objects;

@Component
public class HospitalSupportRequesterProfileResolver implements SupportRequesterProfileResolver {
    private final ObjectProvider<UserAccess> userAccessProvider;

    public HospitalSupportRequesterProfileResolver(ObjectProvider<UserAccess> userAccessProvider) {
        this.userAccessProvider = userAccessProvider;
    }

    @Override
    public String resolveDisplayName(String requesterUserId) {
        String userId = normalize(requesterUserId);
        if (userId.isEmpty()) return "Patient";
        UserAccess users = userAccessProvider.getIfAvailable();
        if (users == null) return userId;
        UserEntity user = users.findById(userId).orElse(null);
        if (user == null) return userId;

        String firstName = normalize(user.getFirstName());
        String lastName = normalize(user.getLastName());
        String full = (firstName + " " + lastName).trim();
        if (!full.isEmpty()) return full;

        String email = normalize(user.getEmail());
        if (!email.isEmpty()) return email;
        return userId;
    }

    private String normalize(String value) {
        return Objects.toString(value, "").trim();
    }
}

