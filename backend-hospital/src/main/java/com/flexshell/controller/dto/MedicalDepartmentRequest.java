package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonAlias;

import java.util.ArrayList;
import java.util.List;

public class MedicalDepartmentRequest implements com.flexshell.medicaldepartment.MedicalDepartmentLocaleCatalog.MedicalDepartmentRequestLike {
    @JsonAlias({"Id"})
    private String id;
    @JsonAlias({"Name"})
    private String name;
    @JsonAlias({"Code"})
    private String code;
    @JsonAlias({"Description"})
    private String description;
    @JsonAlias({"Active"})
    private Boolean active;
    @JsonAlias({"Messages"})
    private List<MedicalDepartmentMessageRequest> messages = new ArrayList<>();

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    @Override
    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    @Override
    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public Boolean getActive() {
        return active;
    }

    public void setActive(Boolean active) {
        this.active = active;
    }

    @Override
    public List<MedicalDepartmentMessageRequest> getMessages() {
        return messages;
    }

    public void setMessages(List<MedicalDepartmentMessageRequest> messages) {
        this.messages = messages == null ? new ArrayList<>() : messages;
    }
}
