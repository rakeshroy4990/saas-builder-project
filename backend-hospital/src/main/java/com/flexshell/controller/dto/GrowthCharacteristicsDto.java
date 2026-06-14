package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.ArrayList;
import java.util.List;

public class GrowthCharacteristicsDto {

    @JsonProperty("Phrase")
    private String phrase;

    @JsonProperty("Labels")
    private List<String> labels = new ArrayList<>();

    @JsonProperty("TraitCodes")
    private List<String> traitCodes = new ArrayList<>();

    public String getPhrase() {
        return phrase;
    }

    public void setPhrase(String phrase) {
        this.phrase = phrase;
    }

    public List<String> getLabels() {
        return labels;
    }

    public void setLabels(List<String> labels) {
        this.labels = labels == null ? new ArrayList<>() : labels;
    }

    public List<String> getTraitCodes() {
        return traitCodes;
    }

    public void setTraitCodes(List<String> traitCodes) {
        this.traitCodes = traitCodes == null ? new ArrayList<>() : traitCodes;
    }
}
