package com.flexshell.prescription;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.Instant;

public class PrescriptionAuditEntry {
    @Field("At")
    @JsonProperty("At")
    @JsonAlias({"at"})
    private Instant at;
    @Field("UserId")
    @JsonProperty("UserId")
    @JsonAlias({"userId"})
    private String userId;
    @Field("Action")
    @JsonProperty("Action")
    @JsonAlias({"action"})
    private String action;
    @Field("Detail")
    @JsonProperty("Detail")
    @JsonAlias({"detail"})
    private String detail;

    public Instant getAt() {
        return at;
    }

    public void setAt(Instant at) {
        this.at = at;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getAction() {
        return action;
    }

    public void setAction(String action) {
        this.action = action;
    }

    public String getDetail() {
        return detail;
    }

    public void setDetail(String detail) {
        this.detail = detail;
    }
}
