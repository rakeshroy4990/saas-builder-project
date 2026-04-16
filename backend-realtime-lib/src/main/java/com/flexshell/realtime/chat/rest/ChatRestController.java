package com.flexshell.realtime.chat.rest;

import com.flexshell.compliance.AuditLogService;
import com.flexshell.realtime.chat.ChatMessageEntity;
import com.flexshell.realtime.chat.ChatRoomEntity;
import com.flexshell.realtime.chat.ChatService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/chat")
public class ChatRestController {
    private final ChatService chatService;
    private final AuditLogService auditLogService;

    public ChatRestController(ChatService chatService, AuditLogService auditLogService) {
        this.chatService = chatService;
        this.auditLogService = auditLogService;
    }

    @GetMapping("/rooms")
    public Map<String, Object> rooms(Principal principal) {
        String userId = principal == null ? "" : principal.getName();
        List<ChatRoomEntity> rooms = chatService.listRoomsForUser(userId);
        return Map.of("Data", rooms);
    }

    @GetMapping("/rooms/{roomId}/messages")
    public Map<String, Object> messages(@PathVariable("roomId") String roomId, Principal principal) {
        List<ChatMessageEntity> messages = chatService.loadRecentMessages(roomId);
        String actor = principal == null ? "" : principal.getName();
        auditLogService.log(actor, "CHAT_MESSAGES_READ", "ChatRoom", roomId, Map.of("count", messages.size()));
        return Map.of("Data", messages);
    }

    @PostMapping("/rooms/direct")
    public Map<String, Object> ensureDirectRoom(@RequestBody Map<String, Object> payload, Principal principal) {
        String userId = principal == null ? "" : principal.getName();
        String otherUserId = String.valueOf(payload.getOrDefault("otherUserId", "")).trim();
        ChatRoomEntity room = chatService.ensureDirectRoom(userId, otherUserId);
        return Map.of("Data", room);
    }
}

