package com.flexshell.realtime.webrtc.ws;

import com.flexshell.realtime.webrtc.CallSessionConnectionRegistry;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;

import java.util.Objects;

@Component
public class WebRtcSessionBindingInterceptor implements ChannelInterceptor {
    private final CallSessionConnectionRegistry connectionRegistry;

    public WebRtcSessionBindingInterceptor(CallSessionConnectionRegistry connectionRegistry) {
        this.connectionRegistry = connectionRegistry;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null) return message;
        if (!StompCommand.SEND.equals(accessor.getCommand())) return message;

        String destination = Objects.toString(accessor.getDestination(), "");
        if (!destination.startsWith("/app/webrtc.signal")) return message;

        Object payload = message.getPayload();
        if (payload instanceof WebRtcSignalRequest req) {
            String callId = Objects.toString(req.getCallId(), "").trim();
            String sessionId = Objects.toString(accessor.getSessionId(), "").trim();
            if (!callId.isEmpty() && !sessionId.isEmpty()) {
                connectionRegistry.bind(sessionId, callId);
            }
        }
        return message;
    }
}

