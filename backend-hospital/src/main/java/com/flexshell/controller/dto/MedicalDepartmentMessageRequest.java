package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;

public class MedicalDepartmentMessageRequest {
    @JsonAlias({"Locale"})
    @JsonProperty("Locale")
    private String locale;

    @JsonAlias({"Name"})
    @JsonProperty("Name")
    private String name;

    @JsonAlias({"Description"})
    @JsonProperty("Description")
    private String description;

    public String getLocale() {
        return locale;
    }

    public void setLocale(String locale) {
        this.locale = locale;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }
}
