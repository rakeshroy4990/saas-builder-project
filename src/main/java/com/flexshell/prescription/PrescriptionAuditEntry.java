package com.flexshell.prescription;

import org.springframework.data.mongodb.core.mapping.Field;

import java.time.Instant;

public class PrescriptionAuditEntry {
    @Field("At")
    private Instant at;
    @Field("UserId")
    private String userId;
    @Field("Action")
    private String action;
    @Field("Detail")
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
