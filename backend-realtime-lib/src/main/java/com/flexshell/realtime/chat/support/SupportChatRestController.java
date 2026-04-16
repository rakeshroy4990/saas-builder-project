package com.flexshell.realtime.chat.support;

import com.flexshell.realtime.chat.ChatRoomEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;
import java.util.Map;

@RestController
@RequestMapping("/api/chat/support")
public class SupportChatRestController {
    private final SupportChatService supportChatService;

    public SupportChatRestController(SupportChatService supportChatService) {
        this.supportChatService = supportChatService;
    }

    @PostMapping("/request")
    public Map<String, Object> create(@RequestBody(required = false) Map<String, Object> payload, Principal principal) {
        String userId = principal == null ? "" : principal.getName();
        SupportRequestEntity req = supportChatService.createRequest(userId);
        return Map.of("Data", req);
    }

    @GetMapping("/open")
    public Map<String, Object> openRequests() {
        return Map.of("Data", supportChatService.listOpenRequests());
    }

    @PostMapping("/accept")
    public Map<String, Object> accept(@RequestBody Map<String, Object> payload, Principal principal) {
        String userId = principal == null ? "" : principal.getName();
        String requestId = String.valueOf(payload.getOrDefault("requestId", "")).trim();
        ChatRoomEntity room = supportChatService.acceptRequest(requestId, userId);
        return Map.of("Data", room);
    }

    @PostMapping("/reject")
    public Map<String, Object> reject(@RequestBody Map<String, Object> payload, Principal principal) {
        String userId = principal == null ? "" : principal.getName();
        String requestId = String.valueOf(payload.getOrDefault("requestId", "")).trim();
        supportChatService.rejectRequest(requestId, userId);
        return Map.of("Data", Map.of("requestId", requestId));
    }
}

