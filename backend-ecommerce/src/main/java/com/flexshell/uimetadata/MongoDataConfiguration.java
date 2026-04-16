package com.flexshell.uimetadata;

import com.flexshell.compliance.AuditEventRepository;
import com.flexshell.realtime.chat.ChatAckRepository;
import com.flexshell.realtime.chat.ChatMessageRepository;
import com.flexshell.realtime.chat.ChatRoomRepository;
import com.flexshell.realtime.chat.support.SupportRequestRepository;
import com.flexshell.realtime.webrtc.CallSessionRepository;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;

/**
 * Enables Mongo repositories only when {@code spring.data.mongodb.uri} is set (e.g. from
 * {@code SPRING_DATA_MONGODB_URI}). Keeps tests and local runs working without Atlas.
 */
@Configuration
@ConditionalOnProperty(prefix = "spring.data.mongodb", name = "uri")
public class MongoDataConfiguration {
    // Intentionally empty: when Mongo is enabled, Spring Boot auto-config will scan repositories.
}
