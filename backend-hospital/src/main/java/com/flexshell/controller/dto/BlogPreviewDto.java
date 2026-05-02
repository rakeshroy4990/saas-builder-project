package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public class BlogPreviewDto {
    @JsonProperty("Title")
    private String title;
    @JsonProperty("Slug")
    private String slug;
    @JsonProperty("Teaser")
    private String teaser;
    @JsonProperty("Category")
    private String category;
    @JsonProperty("ReadTimeMinutes")
    private int readTimeMinutes;

    public BlogPreviewDto() {
    }

    public BlogPreviewDto(String title, String slug, String teaser, String category, int readTimeMinutes) {
        this.title = title;
        this.slug = slug;
        this.teaser = teaser;
        this.category = category;
        this.readTimeMinutes = readTimeMinutes;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getSlug() {
        return slug;
    }

    public void setSlug(String slug) {
        this.slug = slug;
    }

    public String getTeaser() {
        return teaser;
    }

    public void setTeaser(String teaser) {
        this.teaser = teaser;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public int getReadTimeMinutes() {
        return readTimeMinutes;
    }

    public void setReadTimeMinutes(int readTimeMinutes) {
        this.readTimeMinutes = readTimeMinutes;
    }
}
