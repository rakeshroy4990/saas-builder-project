package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record AppointmentFileResponse(
        @JsonProperty("FileId")
        String fileId,
        @JsonProperty("FileName")
        String fileName,
        @JsonProperty("ContentType")
        String contentType,
        @JsonProperty("Size")
        long size,
        @JsonProperty("ViewUrl")
        String viewUrl
) {
}
