package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.ArrayList;
import java.util.List;

public class PagedTriageResultListDto {

    @JsonProperty("Content")
    private List<TriageResultResponse> content = new ArrayList<>();

    @JsonProperty("Number")
    private int number;

    @JsonProperty("Size")
    private int size;

    @JsonProperty("TotalElements")
    private long totalElements;

    public PagedTriageResultListDto() {
    }

    public PagedTriageResultListDto(List<TriageResultResponse> content, int number, int size, long totalElements) {
        this.content = content == null ? new ArrayList<>() : content;
        this.number = number;
        this.size = size;
        this.totalElements = totalElements;
    }

    public List<TriageResultResponse> getContent() {
        return content;
    }

    public int getNumber() {
        return number;
    }

    public int getSize() {
        return size;
    }

    public long getTotalElements() {
        return totalElements;
    }
}
