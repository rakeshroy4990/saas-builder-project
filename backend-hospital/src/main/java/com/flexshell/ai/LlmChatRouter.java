package com.flexshell.ai;

import com.flexshell.controller.dto.AiChatMessageDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Locale;

@Component
public class LlmChatRouter implements LlmChatPort {
    private static final Logger LOG = LoggerFactory.getLogger(LlmChatRouter.class);
    private final String provider;
    private final OpenAiChatAdapter openAiChatAdapter;
    private final GeminiChatAdapter geminiChatAdapter;
    private final ClaudeChatAdapter claudeChatAdapter;

    public LlmChatRouter(
            @Value("${app.ai.provider:openai}") String provider,
            OpenAiChatAdapter openAiChatAdapter,
            GeminiChatAdapter geminiChatAdapter,
            ClaudeChatAdapter claudeChatAdapter
    ) {
        this.provider = String.valueOf(provider == null ? "openai" : provider).trim().toLowerCase(Locale.ROOT);
        this.openAiChatAdapter = openAiChatAdapter;
        this.geminiChatAdapter = geminiChatAdapter;
        this.claudeChatAdapter = claudeChatAdapter;
    }

    @Override
    public String complete(List<AiChatMessageDto> history, String message) {
        LOG.debug("llmRouter dispatch provider={} historyCount={} messageLength={}",
                provider, history == null ? 0 : history.size(), message == null ? 0 : message.length());
        return switch (provider) {
            case "gemini" -> geminiChatAdapter.complete(history, message);
            case "claude" -> claudeChatAdapter.complete(history, message);
            case "openai" -> openAiChatAdapter.complete(history, message);
            default -> throw new AiProviderException(
                    AiProviderException.Kind.CONFIG_MISSING,
                    "Unsupported AI provider configured: " + provider
            );
        };
    }
}
