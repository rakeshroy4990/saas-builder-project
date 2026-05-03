package com.flexshell.realtime.chat.support;

import com.flexshell.realtime.chat.ChatRoomEntity;
import com.flexshell.realtime.chat.ChatService;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Objects;

@Service
public class SupportChatService {
    private final ObjectProvider<SupportRequestRepository> supportRequestRepositoryProvider;
    private final SupportAgentPicker agentPicker;
    private final SupportRequesterProfileResolver requesterProfileResolver;
    private final SimpMessagingTemplate messagingTemplate;
    private final ObjectProvider<MongoTemplate> mongoTemplateProvider;
    private final ChatService chatService;

    public SupportChatService(
            ObjectProvider<SupportRequestRepository> supportRequestRepositoryProvider,
            SupportAgentPicker agentPicker,
            SupportRequesterProfileResolver requesterProfileResolver,
            SimpMessagingTemplate messagingTemplate,
            ObjectProvider<MongoTemplate> mongoTemplateProvider,
            ChatService chatService
    ) {
        this.supportRequestRepositoryProvider = supportRequestRepositoryProvider;
        this.agentPicker = agentPicker;
        this.requesterProfileResolver = requesterProfileResolver;
        this.messagingTemplate = messagingTemplate;
        this.mongoTemplateProvider = mongoTemplateProvider;
        this.chatService = chatService;
    }

    private SupportRequestRepository requests() {
        SupportRequestRepository r = supportRequestRepositoryProvider.getIfAvailable();
        if (r == null) {
            throw new IllegalStateException("Support chat persistence is unavailable");
        }
        return r;
    }

    private MongoTemplate mongo() {
        MongoTemplate t = mongoTemplateProvider.getIfAvailable();
        if (t == null) {
            throw new IllegalStateException("MongoDB template is unavailable");
        }
        return t;
    }

    public SupportRequestEntity createRequest(String requesterUserId) {
        String requester = normalize(requesterUserId);
        if (requester.isEmpty()) throw new IllegalArgumentException("Missing requester");

        SupportRequestEntity req = new SupportRequestEntity();
        req.setRequesterUserId(requester);
        req.setStatus(SupportRequestStatus.OPEN);
        req.setCreatedTimestamp(Instant.now());
        req.setUpdatedTimestamp(Instant.now());
        SupportRequestEntity saved = requests().save(req);

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
     */
    public ChatRoomEntity acceptRequest(String requestId, String agentUserId) {
        String rid = normalize(requestId);
        String agent = normalize(agentUserId);
        if (rid.isEmpty() || agent.isEmpty()) throw new IllegalArgumentException("Missing accept details");

        Query q = new Query(Criteria.where("_id").is(rid).and("Status").is(SupportRequestStatus.OPEN));
        Update u = new Update()
                .set("Status", SupportRequestStatus.ASSIGNED)
                .set("AssignedAgentUserId", agent)
                .set("UpdatedTimestamp", Instant.now());
        SupportRequestEntity claimed = mongo().findAndModify(
                q,
                u,
                FindAndModifyOptions.options().returnNew(true),
                SupportRequestEntity.class
        );
        if (claimed == null) {
            throw new IllegalStateException("Request already claimed");
        }

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

        Query q = new Query(Criteria.where("_id").is(rid).and("Status").is(SupportRequestStatus.OPEN));
        Update u = new Update()
                .set("Status", SupportRequestStatus.CLOSED)
                .set("AssignedAgentUserId", agent)
                .set("UpdatedTimestamp", Instant.now());
        SupportRequestEntity closed = mongo().findAndModify(
                q,
                u,
                FindAndModifyOptions.options().returnNew(true),
                SupportRequestEntity.class
        );
        if (closed == null) {
            throw new IllegalStateException("Request already handled");
        }

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
        return requests().findTop20ByStatusOrderByCreatedTimestampDesc(SupportRequestStatus.OPEN)
                .stream()
                .map(req -> new SupportRequestView(
                        req.getId(),
                        normalize(req.getRequesterUserId()),
                        requesterProfileResolver.resolveDisplayName(req.getRequesterUserId())
                ))
                .toList();
    }

    private String normalize(String v) {
        return Objects.toString(v, "").trim();
    }
}

