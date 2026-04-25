package com.flexshell.controller;

import com.flexshell.ai.AiProviderException;
import com.flexshell.controller.dto.AiChatRequest;
import com.flexshell.controller.dto.AiChatResponse;
import com.flexshell.controller.dto.StandardApiResponse;
import com.flexshell.service.AiChatService;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Objects;

@RestController
@RequestMapping("/api/hospital/ai")
public class AiChatController {
    private static final Logger LOG = LoggerFactory.getLogger(AiChatController.class);
    private final AiChatService aiChatService;

    public AiChatController(AiChatService aiChatService) {
        this.aiChatService = aiChatService;
    }

    @PostMapping(value = "/chat", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<AiChatResponse>> chat(
            @Valid @RequestBody AiChatRequest request,
            Authentication authentication
    ) {
        try {
            String userId = authentication == null ? "" : Objects.toString(authentication.getName(), "").trim();
            AiChatResponse data = aiChatService.reply(userId, request);
            return ResponseEntity.ok(StandardApiResponse.success("AI response", data));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(ex.getMessage(), "AI_CHAT_INVALID"));
        } catch (SecurityException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(StandardApiResponse.error(ex.getMessage(), "AI_CHAT_FORBIDDEN"));
        } catch (AiProviderException ex) {
            String baseCode = ex.kind() == AiProviderException.Kind.CONFIG_MISSING
                    ? "AI_CONFIG_MISSING"
                    : "AI_PROVIDER_FAILED";
            Integer providerHttpStatus = ex.providerHttpStatus();
            String code = providerHttpStatus == null ? baseCode : baseCode + "_HTTP_" + providerHttpStatus;
            HttpStatus status = (providerHttpStatus != null && providerHttpStatus == 429)
                    ? HttpStatus.TOO_MANY_REQUESTS
                    : HttpStatus.SERVICE_UNAVAILABLE;
            LOG.warn("aiChat provider failure provider={} httpStatus={} providerStatus={} message={}",
                    ex.provider(), providerHttpStatus, ex.providerStatus(), ex.getMessage());
            return ResponseEntity.status(status)
                    .body(StandardApiResponse.error(ex.getMessage(), code));
        } catch (IllegalStateException ex) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(StandardApiResponse.error(ex.getMessage(), "AI_CHAT_UNAVAILABLE"));
        }
    }
}
