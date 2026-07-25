package com.flexshell.controller.dto.audio;

import com.fasterxml.jackson.annotation.JsonProperty;

public record AudioSessionRequest(
        @JsonProperty("SessionId") String sessionId,
        @JsonProperty("SwapSpeakers") Boolean swapSpeakers
) {}
