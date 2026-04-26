package com.flexshell.realtime.chat;

import com.flexshell.auth.UserEntity;
import com.flexshell.auth.UserRepository;
import com.flexshell.realtime.chat.support.SupportRequesterProfileResolver;
import org.springframework.stereotype.Component;

import java.util.Objects;

@Component
public class HospitalSupportRequesterProfileResolver implements SupportRequesterProfileResolver {
    private final UserRepository userRepository;

    public HospitalSupportRequesterProfileResolver(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public String resolveDisplayName(String requesterUserId) {
        String userId = normalize(requesterUserId);
        if (userId.isEmpty()) return "Patient";
        UserEntity user = userRepository.findById(userId).orElse(null);
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

