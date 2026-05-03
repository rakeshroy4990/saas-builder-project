package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.Collections;
import java.util.List;

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
    /** One-line card copy for the blog grid; full article stays in {@link #teaser}. */
    @JsonProperty("Hook")
    private String hook;
    @JsonProperty("CuriosityQuestions")
    private List<String> curiosityQuestions = List.of();

    public BlogPreviewDto() {
    }

    public BlogPreviewDto(String title, String slug, String teaser, String category, int readTimeMinutes) {
        this(title, slug, teaser, category, readTimeMinutes, null, null);
    }

    public BlogPreviewDto(
            String title,
            String slug,
            String teaser,
            String category,
            int readTimeMinutes,
            String hook,
            List<String> curiosityQuestions
    ) {
        this.title = title;
        this.slug = slug;
        this.teaser = teaser;
        this.category = category;
        this.readTimeMinutes = readTimeMinutes;
        this.hook = hook;
        this.curiosityQuestions =
                curiosityQuestions == null || curiosityQuestions.isEmpty() ? List.of() : List.copyOf(curiosityQuestions);
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

    public String getHook() {
        return hook == null ? "" : hook;
    }

    public void setHook(String hook) {
        this.hook = hook;
    }

    public List<String> getCuriosityQuestions() {
        return curiosityQuestions == null ? List.of() : Collections.unmodifiableList(curiosityQuestions);
    }

    public void setCuriosityQuestions(List<String> curiosityQuestions) {
        this.curiosityQuestions =
                curiosityQuestions == null || curiosityQuestions.isEmpty() ? List.of() : List.copyOf(curiosityQuestions);
    }
}
