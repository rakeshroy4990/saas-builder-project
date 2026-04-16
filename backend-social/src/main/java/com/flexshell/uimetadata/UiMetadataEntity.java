package com.flexshell.uimetadata;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * Persists UI override payloads in MongoDB collection {@code uiMetdata} (wire name spelling).
 */
@Document(collection = "uiMetdata")
public class UiMetadataEntity {

    public static final String SINGLETON_ID = "default";

    @Id
    private String id = SINGLETON_ID;

    /** Full JSON document as stored string (Atlas-safe, simple to version/migrate). */
    private String bodyJson;

    private Instant updatedAt;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getBodyJson() {
        return bodyJson;
    }

    public void setBodyJson(String bodyJson) {
        this.bodyJson = bodyJson;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
