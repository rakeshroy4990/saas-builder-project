package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record MedicalDepartmentResponse(
        @JsonProperty("Id")
        String id,
        @JsonProperty("Name")
        String name,
        @JsonProperty("Code")
        String code,
        @JsonProperty("Description")
        String description,
        @JsonProperty("Active")
        boolean active,
        @JsonProperty("CreatedTimestamp")
        String createdTimestamp,
        @JsonProperty("UpdatedTimestamp")
        String updatedTimestamp
) {
}
