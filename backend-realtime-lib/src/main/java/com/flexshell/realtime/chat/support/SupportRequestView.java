package com.flexshell.realtime.chat.support;

public record SupportRequestView(
        String requestId,
        String requesterUserId,
        String requesterDisplayName
) {
}

