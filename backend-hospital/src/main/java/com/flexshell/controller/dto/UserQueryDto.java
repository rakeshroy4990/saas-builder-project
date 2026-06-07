package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public class UserQueryDto {
    @JsonProperty("Query")
    private String query;
    @JsonProperty("Role")
    private String role;
    @JsonProperty("Email")
    private String email;

    public String getQuery() {
        return query;
    }

    public void setQuery(String query) {
        this.query = query;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }
}
