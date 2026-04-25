package com.flexshell.ai;

import com.flexshell.controller.dto.AiChatMessageDto;

import java.util.List;

public interface LlmChatPort {
    String complete(List<AiChatMessageDto> history, String message);
}
