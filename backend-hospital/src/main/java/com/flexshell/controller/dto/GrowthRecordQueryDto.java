package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.UUID;

public class GrowthRecordQueryDto {

    @JsonProperty("ChildProfileExternalId")
    private UUID childProfileExternalId;

    public UUID getChildProfileExternalId() {
        return childProfileExternalId;
    }

    public void setChildProfileExternalId(UUID childProfileExternalId) {
        this.childProfileExternalId = childProfileExternalId;
    }
}
