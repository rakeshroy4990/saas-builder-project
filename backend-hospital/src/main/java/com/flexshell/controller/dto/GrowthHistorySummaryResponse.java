package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public class GrowthHistorySummaryResponse {

    @JsonProperty("Summary")
    private String summary;

    @JsonProperty("ModelUsed")
    private String modelUsed;

    @JsonProperty("ReplyLocale")
    private String replyLocale;

    @JsonProperty("Characteristics")
    private GrowthCharacteristicsDto characteristics;

    public String getSummary() {
        return summary;
    }

    public void setSummary(String summary) {
        this.summary = summary;
    }

    public String getModelUsed() {
        return modelUsed;
    }

    public void setModelUsed(String modelUsed) {
        this.modelUsed = modelUsed;
    }

    public String getReplyLocale() {
        return replyLocale;
    }

    public void setReplyLocale(String replyLocale) {
        this.replyLocale = replyLocale;
    }

    public GrowthCharacteristicsDto getCharacteristics() {
        return characteristics;
    }

    public void setCharacteristics(GrowthCharacteristicsDto characteristics) {
        this.characteristics = characteristics;
    }
}
