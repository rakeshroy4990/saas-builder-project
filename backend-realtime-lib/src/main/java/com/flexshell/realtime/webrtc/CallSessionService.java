package com.flexshell.realtime.webrtc;

import com.flexshell.compliance.PhiRetentionPolicy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Objects;

@Service
public class CallSessionService {
    private static final Logger log = LoggerFactory.getLogger(CallSessionService.class);
    private final CallSessionRepository repository;
    private final CallPermissionEvaluator permissionEvaluator;
    private final PhiRetentionPolicy retentionPolicy;

    public CallSessionService(
            CallSessionRepository repository,
            CallPermissionEvaluator permissionEvaluator,
            PhiRetentionPolicy retentionPolicy
    ) {
        this.repository = repository;
        this.permissionEvaluator = permissionEvaluator;
        this.retentionPolicy = retentionPolicy;
    }

    public CallSessionEntity invite(String initiatorId, String receiverId) {
        String from = normalize(initiatorId);
        String to = normalize(receiverId);
        if (!permissionEvaluator.canInitiate(from, to)) {
            throw new SecurityException("You do not have permission to initiate this call");
        }

        CallSessionEntity session = new CallSessionEntity();
        session.setInitiatorId(from);
        session.setReceiverId(to);
        session.setStartTime(Instant.now());
        session.setStatus(CallSessionStatus.RINGING);
        session.setExpiresAt(retentionPolicy.expiresAtFromNow());
        return repository.save(session);
    }

    public CallSessionEntity requireSession(String callId) {
        String id = normalize(callId);
        if (id.isEmpty()) throw new IllegalArgumentException("Missing callId");
        return repository.findById(id).orElseThrow(() -> new IllegalArgumentException("Call session not found"));
    }

    public CallSessionEntity accept(String callId, String actorUserId) {
        CallSessionEntity session = requireSession(callId);
        ensureParticipant(session, actorUserId);
        session.setStatus(CallSessionStatus.ACTIVE);
        log.info("event_name=video_call_event domain=video status=success reason_code=call_connected call_id={} user_id={}",
                session.getCallId(), normalize(actorUserId));
        return repository.save(session);
    }

    public CallSessionEntity reject(String callId, String actorUserId) {
        CallSessionEntity session = requireSession(callId);
        ensureParticipant(session, actorUserId);
        session.setStatus(CallSessionStatus.REJECTED);
        session.setEndTime(Instant.now());
        session.setEndedReason("REJECTED");
        return repository.save(session);
    }

    public CallSessionEntity end(String callId, String actorUserId, String reason) {
        CallSessionEntity session = requireSession(callId);
        ensureParticipant(session, actorUserId);
        if (session.getStatus() == CallSessionStatus.ENDED) return session;
        session.setStatus(CallSessionStatus.ENDED);
        session.setEndTime(Instant.now());
        session.setEndedReason(normalize(reason));
        log.info("event_name=video_call_event domain=video status=drop reason_code=call_dropped call_id={} user_id={} ended_reason={}",
                session.getCallId(), normalize(actorUserId), normalize(reason));
        return repository.save(session);
    }

    public void ensureParticipant(CallSessionEntity session, String actorUserId) {
        String actor = normalize(actorUserId);
        if (actor.isEmpty()) throw new SecurityException("Missing user");
        if (actor.equals(normalize(session.getInitiatorId()))) return;
        if (actor.equals(normalize(session.getReceiverId()))) return;
        throw new SecurityException("Not a participant in this call");
    }

    public String otherParticipant(CallSessionEntity session, String actorUserId) {
        String actor = normalize(actorUserId);
        String initiator = normalize(session.getInitiatorId());
        String receiver = normalize(session.getReceiverId());
        if (actor.equals(initiator)) return receiver;
        if (actor.equals(receiver)) return initiator;
        return "";
    }

    private String normalize(String v) {
        return Objects.toString(v, "").trim();
    }
}

