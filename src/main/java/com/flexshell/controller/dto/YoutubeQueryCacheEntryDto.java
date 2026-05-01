package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public class YoutubeQueryCacheEntryDto {
    @JsonProperty("logged_in_user_id")
    private String loggedInUserId;

    @JsonProperty("query")
    private String query;

    @JsonProperty("video_id")
    private String videoId;

    @JsonProperty("video_title")
    private String videoTitle;

    @JsonProperty("updated_at")
    private String updatedAt;

    public YoutubeQueryCacheEntryDto() {
    }

    public YoutubeQueryCacheEntryDto(
            String loggedInUserId,
            String query,
            String videoId,
            String videoTitle,
            String updatedAt
    ) {
        this.loggedInUserId = loggedInUserId;
        this.query = query;
        this.videoId = videoId;
        this.videoTitle = videoTitle;
        this.updatedAt = updatedAt;
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

    public String getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(String updatedAt) {
        this.updatedAt = updatedAt;
    }
}
