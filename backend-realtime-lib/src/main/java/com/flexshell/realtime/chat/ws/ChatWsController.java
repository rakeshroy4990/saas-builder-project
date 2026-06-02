package com.flexshell.realtime.chat.ws;

import com.flexshell.compliance.AuditLogService;
import com.flexshell.realtime.chat.ChatMessageEntity;
import com.flexshell.realtime.chat.ChatService;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.util.List;
import java.util.Map;

@Controller
public class ChatWsController {
    private final ChatService chatService;
    private final SimpMessagingTemplate messagingTemplate;
    private final AuditLogService auditLogService;

    public ChatWsController(
            ChatService chatService,
            SimpMessagingTemplate messagingTemplate,
            AuditLogService auditLogService
    ) {
        this.chatService = chatService;
        this.messagingTemplate = messagingTemplate;
        this.auditLogService = auditLogService;
    }

    @MessageMapping("/chat.send")
    public void send(ChatSendRequest request, Principal principal) {
        String userId = principal == null ? "" : String.valueOf(principal.getName());
        ChatMessageEntity saved = chatService.sendMessage(
                request.getRoomId(),
                userId,
                request.getBody(),
                request.getClientMessageId(),
                request.getMessageId()
        );
        auditLogService.log(userId, "CHAT_MESSAGE_SENT", "ChatRoom", saved.getRoomId(), Map.of("sequence", saved.getSequenceNumber()));

        List<String> participants = chatService.roomParticipants(saved.getRoomId());
        ChatMessageEvent event = toEvent(saved);

        for (String participant : participants) {
            if (participant == null || participant.isBlank()) continue;
            messagingTemplate.convertAndSendToUser(participant.trim(), "/queue/chat", event);
        }
    }

    @MessageMapping("/chat.ack")
    public void ack(ChatAckRequest request, Principal principal) {
        String userId = principal == null ? "" : String.valueOf(principal.getName());
        chatService.ack(request.getRoomId(), userId, request.getUpToSequenceNumber());
        auditLogService.log(userId, "CHAT_ACK", "ChatRoom", request.getRoomId(), Map.of("upTo", request.getUpToSequenceNumber()));
    }

    private ChatMessageEvent toEvent(ChatMessageEntity saved) {
        ChatMessageEvent event = new ChatMessageEvent();
        event.setRoomId(saved.getRoomId());
        event.setMessageId(saved.getId());
        event.setSequenceNumber(saved.getSequenceNumber());
        event.setSenderId(saved.getSenderId());
        event.setBody(saved.getBody());
        event.setClientMessageId(saved.getClientMessageId());
        event.setCreatedTimestamp(saved.getCreatedTimestamp());
        return event;
    }
}
