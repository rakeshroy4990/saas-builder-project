package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

public class PagedNotificationRuleListDto {
    @JsonProperty("Content")
    private List<NotificationEventRuleResponse> content;
    @JsonProperty("TotalElements")
    private long totalElements;
    @JsonProperty("TotalPages")
    private int totalPages;
    @JsonProperty("Number")
    private int number;
    @JsonProperty("Size")
    private int size;

    public PagedNotificationRuleListDto() {
    }

    public PagedNotificationRuleListDto(
            List<NotificationEventRuleResponse> content,
            long totalElements,
            int totalPages,
            int number,
            int size
    ) {
        this.content = content;
        this.totalElements = totalElements;
        this.totalPages = totalPages;
        this.number = number;
        this.size = size;
    }

    public List<NotificationEventRuleResponse> getContent() {
        return content;
    }

    public void setContent(List<NotificationEventRuleResponse> content) {
        this.content = content;
    }

    public long getTotalElements() {
        return totalElements;
    }

    public void setTotalElements(long totalElements) {
        this.totalElements = totalElements;
    }

    public int getTotalPages() {
        return totalPages;
    }

    public void setTotalPages(int totalPages) {
        this.totalPages = totalPages;
    }

    public int getNumber() {
        return number;
    }

    public void setNumber(int number) {
        this.number = number;
    }

    public int getSize() {
        return size;
    }

    public void setSize(int size) {
        this.size = size;
    }
}
