package com.flexshell.youtube;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.Instant;

/**
 * Persists YouTube hero search queries per logged-in user for reuse and listing.
 * Collection name matches legacy naming: {@code query_cache}.
 */
@Document(collection = "query_cache")
public class QueryCacheEntity {
    @Id
    private String id;

    @Indexed
    @Field("UserId")
    private String userId;

    /**
     * Same principal as {@link #userId}; stored explicitly for Smart AI / hero YouTube cache rows
     * so exports and BI queries can filter on "logged-in user" without ambiguity.
     */
    @Indexed
    @Field("LoggedInUserId")
    private String loggedInUserId;

    @Field("Query")
    private String query;

    @Field("VideoId")
    private String videoId;

    @Field("VideoTitle")
    private String videoTitle;

    @Indexed
    @Field("UpdatedAt")
    private Instant updatedAt;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getLoggedInUserId() {
        return loggedInUserId;
    }

    public void setLoggedInUserId(String loggedInUserId) {
        this.loggedInUserId = loggedInUserId;
    }

    public String getQuery() {
        return query;
    }

    public void setQuery(String query) {
        this.query = query;
    }

    public String getVideoId() {
        return videoId;
    }

    public void setVideoId(String videoId) {
        this.videoId = videoId;
    }

    public String getVideoTitle() {
        return videoTitle;
    }

    public void setVideoTitle(String videoTitle) {
        this.videoTitle = videoTitle;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
