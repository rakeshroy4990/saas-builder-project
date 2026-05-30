package com.flexshell.realtime.chat.support;

import com.flexshell.realtime.chat.ChatRoomEntity;
import com.flexshell.realtime.chat.ChatService;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

@Service
public class SupportChatService {
    private final ObjectProvider<SupportChatPersistence> supportChatPersistenceProvider;
    private final SupportAgentPicker agentPicker;
    private final SupportRequesterProfileResolver requesterProfileResolver;
    private final SimpMessagingTemplate messagingTemplate;
    private final ChatService chatService;

    public SupportChatService(
            ObjectProvider<SupportChatPersistence> supportChatPersistenceProvider,
            SupportAgentPicker agentPicker,
            SupportRequesterProfileResolver requesterProfileResolver,
            SimpMessagingTemplate messagingTemplate,
            ChatService chatService
    ) {
        this.supportChatPersistenceProvider = supportChatPersistenceProvider;
        this.agentPicker = agentPicker;
        this.requesterProfileResolver = requesterProfileResolver;
        this.messagingTemplate = messagingTemplate;
        this.chatService = chatService;
    }

    private SupportChatPersistence persistence() {
        SupportChatPersistence p = supportChatPersistenceProvider.getIfAvailable();
        if (p == null) {
            throw new IllegalStateException("Support chat persistence is unavailable");
        }
        return p;
    }

    public SupportRequestEntity createRequest(String requesterUserId) {
        String requester = normalize(requesterUserId);
        if (requester.isEmpty()) throw new IllegalArgumentException("Missing requester");

        SupportRequestEntity req = new SupportRequestEntity();
        req.setRequesterUserId(requester);
        req.setStatus(SupportRequestStatus.OPEN);
        req.setCreatedTimestamp(Instant.now());
        req.setUpdatedTimestamp(Instant.now());
        SupportRequestEntity saved = persistence().save(req);

        List<String> onlineAgents = agentPicker.listOnlineAgentUserIds();
        String requesterDisplayName = requesterProfileResolver.resolveDisplayName(requester);
        SupportWsEvent event = SupportWsEvent.requestCreated(saved.getId(), requester, requesterDisplayName);
        for (String agentUserId : onlineAgents) {
            if (normalize(agentUserId).isEmpty()) continue;
            messagingTemplate.convertAndSendToUser(agentUserId, "/queue/support", event);
        }
        return saved;
    }

    /**
     * First-wins claim: only one agent can assign an OPEN request.
     * Idempotent when the same agent retries after a partial failure (request already ASSIGNED to them).
     */
    @Transactional
    public ChatRoomEntity acceptRequest(String requestId, String agentUserId) {
        String rid = normalize(requestId);
        String agent = normalize(agentUserId);
        if (rid.isEmpty() || agent.isEmpty()) throw new IllegalArgumentException("Missing accept details");

        SupportRequestEntity claimed = resolveClaimedRequest(rid, agent);

        String requester = normalize(claimed.getRequesterUserId());
        ChatRoomEntity room = chatService.ensureDirectRoom(requester, agent);
        String requesterDisplayName = requesterProfileResolver.resolveDisplayName(requester);

        SupportWsEvent assignedEvent = SupportWsEvent.assigned(claimed.getId(), requester, requesterDisplayName, agent, room.getId());
        messagingTemplate.convertAndSendToUser(requester, "/queue/support", assignedEvent);
        messagingTemplate.convertAndSendToUser(agent, "/queue/support", assignedEvent);
        for (String agentPickerUserId : agentPicker.listOnlineAgentUserIds()) {
            String normalized = normalize(agentPickerUserId);
            if (normalized.isEmpty() || normalized.equals(agent)) continue;
            messagingTemplate.convertAndSendToUser(normalized, "/queue/support", assignedEvent);
        }

        return room;
    }

    public void rejectRequest(String requestId, String agentUserId) {
        String rid = normalize(requestId);
        String agent = normalize(agentUserId);
        if (rid.isEmpty() || agent.isEmpty()) throw new IllegalArgumentException("Missing reject details");

        SupportRequestEntity closed = persistence().closeOpenRequest(rid, agent)
                .orElseThrow(() -> new IllegalStateException("Request already handled"));

        String requester = normalize(closed.getRequesterUserId());
        String requesterDisplayName = requesterProfileResolver.resolveDisplayName(requester);
        SupportWsEvent closedEvent = SupportWsEvent.closed(closed.getId(), requester, requesterDisplayName, agent);
        messagingTemplate.convertAndSendToUser(requester, "/queue/support", closedEvent);
        for (String agentPickerUserId : agentPicker.listOnlineAgentUserIds()) {
            String normalized = normalize(agentPickerUserId);
            if (normalized.isEmpty()) continue;
            messagingTemplate.convertAndSendToUser(normalized, "/queue/support", closedEvent);
        }
    }

    public List<SupportRequestView> listOpenRequests() {
        return persistence().listOpenRequests(20)
                .stream()
                .map(req -> new SupportRequestView(
                        req.getId(),
                        normalize(req.getRequesterUserId()),
                        requesterProfileResolver.resolveDisplayName(req.getRequesterUserId())
                ))
                .toList();
    }

    private SupportRequestEntity resolveClaimedRequest(String requestId, String agentUserId) {
        Optional<SupportRequestEntity> claimed = persistence().claimOpenRequest(requestId, agentUserId);
        if (claimed.isPresent()) {
            return claimed.get();
        }
        SupportRequestEntity existing = persistence().findRequestById(requestId)
                .orElseThrow(() -> new IllegalStateException("Support request not found"));
        if (existing.getStatus() == SupportRequestStatus.ASSIGNED
                && agentUserId.equals(normalize(existing.getAssignedAgentUserId()))) {
            return existing;
        }
        throw new IllegalStateException("Request already claimed");
    }

    private String normalize(String v) {
        return Objects.toString(v, "").trim();
    }
}
