package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

public class PagedAppointmentListDto {
    @JsonProperty("content")
    private List<AppointmentResponse> content;
    @JsonProperty("totalElements")
    private long totalElements;
    @JsonProperty("totalPages")
    private int totalPages;
    @JsonProperty("number")
    private int number;
    @JsonProperty("size")
    private int size;

    public PagedAppointmentListDto() {
    }

    public PagedAppointmentListDto(
            List<AppointmentResponse> content,
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

    public List<AppointmentResponse> getContent() {
        return content;
    }

    public void setContent(List<AppointmentResponse> content) {
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
