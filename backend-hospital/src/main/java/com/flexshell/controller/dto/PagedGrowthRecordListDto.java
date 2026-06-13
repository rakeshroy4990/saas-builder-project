package com.flexshell.controller.dto;

import java.util.List;

public class PagedGrowthRecordListDto {

    private final List<GrowthRecordResponse> content;
    private final int number;
    private final int size;
    private final long totalElements;

    public PagedGrowthRecordListDto(List<GrowthRecordResponse> content, int number, int size, long totalElements) {
        this.content = content;
        this.number = number;
        this.size = size;
        this.totalElements = totalElements;
    }

    public List<GrowthRecordResponse> getContent() {
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
