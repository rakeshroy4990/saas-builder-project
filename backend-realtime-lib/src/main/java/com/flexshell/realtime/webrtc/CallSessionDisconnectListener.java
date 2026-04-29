package com.flexshell.realtime.webrtc;

import com.flexshell.realtime.ws.auth.WsSessionAuthRegistry;
import com.flexshell.realtime.webrtc.ws.WebRtcSignalEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.util.Map;

@Component
public class CallSessionDisconnectListener {
    private static final Logger log = LoggerFactory.getLogger(CallSessionDisconnectListener.class);
    private final CallSessionConnectionRegistry connectionRegistry;
    private final CallSessionService callSessionService;
    private final WsSessionAuthRegistry wsSessionAuthRegistry;
    private final SimpMessagingTemplate messagingTemplate;
    private final CallSessionHeartbeatRegistry heartbeatRegistry;

    public CallSessionDisconnectListener(
            CallSessionConnectionRegistry connectionRegistry,
            CallSessionService callSessionService,
            WsSessionAuthRegistry wsSessionAuthRegistry,
            SimpMessagingTemplate messagingTemplate,
            CallSessionHeartbeatRegistry heartbeatRegistry
    ) {
        this.connectionRegistry = connectionRegistry;
        this.callSessionService = callSessionService;
        this.wsSessionAuthRegistry = wsSessionAuthRegistry;
        this.messagingTemplate = messagingTemplate;
        this.heartbeatRegistry = heartbeatRegistry;
    }

    @EventListener
    public void onDisconnect(SessionDisconnectEvent event) {
        if (event == null) return;
        String sessionId = event.getSessionId();
        WsSessionAuthRegistry.SessionAuth auth = wsSessionAuthRegistry.get(sessionId);
        String userId = auth == null ? "" : auth.userId();

        String callId = connectionRegistry.unbind(sessionId);
        wsSessionAuthRegistry.remove(sessionId);
        if (callId == null || callId.isBlank()) return;
        if (userId == null || userId.isBlank()) return;

        CallSessionEntity session;
        try {
            session = callSessionService.end(callId, userId, "DISCONNECTED");
        } catch (Exception ex) {
            log.warn("event_name=video_call_event domain=video status=drop reason_code=stomp_disconnect call_id={} user_id={}", callId, userId);
            return;
        }
        log.info("event_name=video_call_event domain=video status=drop reason_code=peer_disconnected call_id={} user_id={}", callId, userId);
        heartbeatRegistry.remove(callId);
        String other = callSessionService.otherParticipant(session, userId);
        if (other == null || other.isBlank()) return;

        WebRtcSignalEvent eventPayload = new WebRtcSignalEvent();
        eventPayload.setSignalType("end");
        eventPayload.setCallId(session.getCallId());
        eventPayload.setFromUserId(userId);
        eventPayload.setToUserId(other);
        eventPayload.setPayload(Map.of("reason", "DISCONNECTED"));
        messagingTemplate.convertAndSendToUser(other, "/queue/webrtc", eventPayload);
    }
}

