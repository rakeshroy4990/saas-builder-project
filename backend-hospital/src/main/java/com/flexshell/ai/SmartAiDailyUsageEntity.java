package com.flexshell.ai;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.Instant;

@Document(collection = "smart_ai_daily_usage")
public class SmartAiDailyUsageEntity {
    @Id
    private String id;

    @Field("requestCount")
    private int requestCount;

    @Field("userId")
    private String userId;

    @Field("utcDay")
    private String utcDay;

    @Field("updatedAt")
    private Instant updatedAt;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public int getRequestCount() {
        return requestCount;
    }

    public void setRequestCount(int requestCount) {
        this.requestCount = requestCount;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getUtcDay() {
        return utcDay;
    }

    public void setUtcDay(String utcDay) {
        this.utcDay = utcDay;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
