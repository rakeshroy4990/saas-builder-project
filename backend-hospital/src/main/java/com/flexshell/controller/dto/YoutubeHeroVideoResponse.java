package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Hero embed: YouTube video id from channel search (or null when none / disabled).
 */
public class YoutubeHeroVideoResponse {
    @JsonProperty("videoId")
    private String videoId;
    @JsonProperty("videoTitle")
    private String videoTitle;

    public YoutubeHeroVideoResponse() {
    }

    public YoutubeHeroVideoResponse(String videoId, String videoTitle) {
        this.videoId = videoId;
        this.videoTitle = videoTitle;
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
}
