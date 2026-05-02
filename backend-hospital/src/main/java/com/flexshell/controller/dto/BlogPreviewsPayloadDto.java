package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

/**
 * Blog list API envelope: items plus provenance for UI attribution.
 */
public class BlogPreviewsPayloadDto {
    @JsonProperty("Items")
    private List<BlogPreviewDto> items;
    /** "llm" or "static_fallback" */
    @JsonProperty("ContentSource")
    private String contentSource;
    @JsonProperty("ServedFromCache")
    private boolean servedFromCache;
    /** Human-readable attribution for the site */
    @JsonProperty("ContentSourceDetail")
    private String contentSourceDetail;

    public BlogPreviewsPayloadDto() {
    }

    public BlogPreviewsPayloadDto(
            List<BlogPreviewDto> items,
            String contentSource,
            boolean servedFromCache,
            String contentSourceDetail
    ) {
        this.items = items;
        this.contentSource = contentSource;
        this.servedFromCache = servedFromCache;
        this.contentSourceDetail = contentSourceDetail;
    }

    public List<BlogPreviewDto> getItems() {
        return items;
    }

    public void setItems(List<BlogPreviewDto> items) {
        this.items = items;
    }

    public String getContentSource() {
        return contentSource;
    }

    public void setContentSource(String contentSource) {
        this.contentSource = contentSource;
    }

    public boolean isServedFromCache() {
        return servedFromCache;
    }

    public void setServedFromCache(boolean servedFromCache) {
        this.servedFromCache = servedFromCache;
    }

    public String getContentSourceDetail() {
        return contentSourceDetail;
    }

    public void setContentSourceDetail(String contentSourceDetail) {
        this.contentSourceDetail = contentSourceDetail;
    }
}
