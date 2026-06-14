package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

public record AiChatRequest(
        @NotBlank @Size(max = 16000) String message,
        @Size(max = 120) String conversationId,
        @Valid @Size(max = 12) List<AiChatMessageDto> history,
        /**
         * Optional pdf-rag corpus scope (matches pdf-rag {@code BookName}); forwarded to {@code /api/v1/query}.
         */
        @JsonProperty("BookName")
        @JsonAlias({"bookName", "book_name"})
        @Size(max = 512) String bookName,
        /**
         * When set, forwarded as pdf-rag {@code RetrievalQuestion} so retrieval matches a short clinical
         * query while {@link #message} carries full instructions (e.g. flashcard formatting).
         */
        @JsonProperty("RetrievalQuestion")
        @JsonAlias({"retrievalQuestion", "retrieval_question"})
        @Size(max = 8000) String retrievalQuestion,
        /**
         * Target reply locale ({@code en}, {@code hi}, {@code kn}); forwarded to pdf-rag {@code ReplyLocale}.
         */
        @JsonProperty("ReplyLocale")
        @JsonAlias({"replyLocale", "reply_locale"})
        @Size(max = 8) String replyLocale
) {
}
