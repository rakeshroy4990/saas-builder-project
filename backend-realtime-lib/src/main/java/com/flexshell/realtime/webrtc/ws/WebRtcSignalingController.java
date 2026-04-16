package com.flexshell.realtime.webrtc.ws;

import com.flexshell.compliance.AuditLogService;
import com.flexshell.realtime.webrtc.CallSessionEntity;
import com.flexshell.realtime.webrtc.CallSessionHeartbeatRegistry;
import com.flexshell.realtime.webrtc.CallSessionService;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.util.Map;
import java.util.Objects;

@Controller
public class WebRtcSignalingController {
    private final CallSessionService callSessionService;
    private final SimpMessagingTemplate messagingTemplate;
    private final CallSessionHeartbeatRegistry heartbeatRegistry;
    private final AuditLogService auditLogService;

    public WebRtcSignalingController(
            CallSessionService callSessionService,
            SimpMessagingTemplate messagingTemplate,
            CallSessionHeartbeatRegistry heartbeatRegistry,
            AuditLogService auditLogService
    ) {
        this.callSessionService = callSessionService;
        this.messagingTemplate = messagingTemplate;
        this.heartbeatRegistry = heartbeatRegistry;
        this.auditLogService = auditLogService;
    }

    @MessageMapping("/webrtc.signal")
    public void signal(WebRtcSignalRequest request, Principal principal) {
        String fromUserId = principal == null ? "" : String.valueOf(principal.getName());
        String type = normalize(request.getType());
        if (type.isEmpty()) throw new IllegalArgumentException("Missing type");

        switch (type) {
            case "invite" -> handleInvite(request, fromUserId);
            case "accept" -> handleAccept(request, fromUserId);
            case "reject" -> handleReject(request, fromUserId);
            case "end" -> handleEnd(request, fromUserId);
            case "offer", "answer", "ice" -> handleRelay(request, fromUserId);
            case "heartbeat" -> handleHeartbeat(request, fromUserId);
            default -> throw new IllegalArgumentException("Unsupported signal type");
        }
    }

    private void handleInvite(WebRtcSignalRequest request, String fromUserId) {
        String toUserId = normalize(request.getToUserId());
        if (toUserId.isEmpty()) throw new IllegalArgumentException("Missing toUserId");

        CallSessionEntity session = callSessionService.invite(fromUserId, toUserId);
        auditLogService.log(fromUserId, "CALL_INVITE", "CallSession", session.getCallId(), Map.of("toUserId", toUserId));
        WebRtcSignalEvent event = baseEvent("invite", session.getCallId(), fromUserId, toUserId, request.getPayload());

        messagingTemplate.convertAndSendToUser(toUserId, "/queue/webrtc", event);
        messagingTemplate.convertAndSendToUser(fromUserId, "/queue/webrtc", event);
    }

    private void handleAccept(WebRtcSignalRequest request, String fromUserId) {
        CallSessionEntity session = callSessionService.accept(request.getCallId(), fromUserId);
        auditLogService.log(fromUserId, "CALL_ACCEPT", "CallSession", session.getCallId(), Map.of());
        String other = callSessionService.otherParticipant(session, fromUserId);
        WebRtcSignalEvent event = baseEvent("accept", session.getCallId(), fromUserId, other, request.getPayload());

        messagingTemplate.convertAndSendToUser(other, "/queue/webrtc", event);
        messagingTemplate.convertAndSendToUser(fromUserId, "/queue/webrtc", event);
    }

    private void handleReject(WebRtcSignalRequest request, String fromUserId) {
        CallSessionEntity session = callSessionService.reject(request.getCallId(), fromUserId);
        auditLogService.log(fromUserId, "CALL_REJECT", "CallSession", session.getCallId(), Map.of());
        String other = callSessionService.otherParticipant(session, fromUserId);
        WebRtcSignalEvent event = baseEvent("reject", session.getCallId(), fromUserId, other, request.getPayload());

        messagingTemplate.convertAndSendToUser(other, "/queue/webrtc", event);
        messagingTemplate.convertAndSendToUser(fromUserId, "/queue/webrtc", event);
    }

    private void handleEnd(WebRtcSignalRequest request, String fromUserId) {
        CallSessionEntity session = callSessionService.end(request.getCallId(), fromUserId, "ENDED");
        auditLogService.log(fromUserId, "CALL_END", "CallSession", session.getCallId(), Map.of());
        String other = callSessionService.otherParticipant(session, fromUserId);
        WebRtcSignalEvent event = baseEvent("end", session.getCallId(), fromUserId, other, request.getPayload());

        messagingTemplate.convertAndSendToUser(other, "/queue/webrtc", event);
        messagingTemplate.convertAndSendToUser(fromUserId, "/queue/webrtc", event);
    }

    private void handleRelay(WebRtcSignalRequest request, String fromUserId) {
        CallSessionEntity session = callSessionService.requireSession(request.getCallId());
        callSessionService.ensureParticipant(session, fromUserId);
        String other = callSessionService.otherParticipant(session, fromUserId);
        WebRtcSignalEvent event = baseEvent(normalize(request.getType()), session.getCallId(), fromUserId, other, request.getPayload());
        messagingTemplate.convertAndSendToUser(other, "/queue/webrtc", event);
    }

    private void handleHeartbeat(WebRtcSignalRequest request, String fromUserId) {
        CallSessionEntity session = callSessionService.requireSession(request.getCallId());
        callSessionService.ensureParticipant(session, fromUserId);
        heartbeatRegistry.beat(session.getCallId());
        String other = callSessionService.otherParticipant(session, fromUserId);
        WebRtcSignalEvent event = baseEvent("heartbeat", session.getCallId(), fromUserId, other, request.getPayload());
        messagingTemplate.convertAndSendToUser(other, "/queue/webrtc", event);
    }

    private WebRtcSignalEvent baseEvent(String signalType, String callId, String fromUserId, String toUserId, Object payload) {
        WebRtcSignalEvent event = new WebRtcSignalEvent();
        event.setSignalType(signalType);
        event.setCallId(normalize(callId));
        event.setFromUserId(normalize(fromUserId));
        event.setToUserId(normalize(toUserId));
        if (payload instanceof java.util.Map<?, ?> map) {
            //noinspection unchecked
            event.setPayload((java.util.Map<String, Object>) map);
        }
        return event;
    }

    private String normalize(String v) {
        return Objects.toString(v, "").trim();
    }
}

