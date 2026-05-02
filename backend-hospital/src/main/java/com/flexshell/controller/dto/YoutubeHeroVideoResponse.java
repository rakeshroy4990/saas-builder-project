package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Hero embed: YouTube video id from channel search (or null when none / disabled).
 * Optional {@code viewCount} / {@code likeCount} when statistics were loaded (empty-query hero ranking).
 */
public class YoutubeHeroVideoResponse {
    @JsonProperty("videoId")
    private String videoId;
    @JsonProperty("videoTitle")
    private String videoTitle;
    @JsonProperty("viewCount")
    private long viewCount;
    @JsonProperty("likeCount")
    private long likeCount;

    public YoutubeHeroVideoResponse() {
    }

    public YoutubeHeroVideoResponse(String videoId, String videoTitle) {
        this(videoId, videoTitle, 0L, 0L);
    }

    public YoutubeHeroVideoResponse(String videoId, String videoTitle, long viewCount, long likeCount) {
        this.videoId = videoId;
        this.videoTitle = videoTitle;
        this.viewCount = viewCount;
        this.likeCount = likeCount;
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

    public long getViewCount() {
        return viewCount;
    }

    public void setViewCount(long viewCount) {
        this.viewCount = viewCount;
    }

    public long getLikeCount() {
        return likeCount;
    }

    public void setLikeCount(long likeCount) {
        this.likeCount = likeCount;
    }
}
