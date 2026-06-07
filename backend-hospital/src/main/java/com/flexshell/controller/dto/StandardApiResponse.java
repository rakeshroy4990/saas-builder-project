package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;

public class StandardApiResponse<T> {
    @JsonProperty("Success")
    private boolean success;
    @JsonProperty("Message")
    private String message;
    @JsonProperty("ErrorCode")
    private String errorCode;
    @JsonProperty("Page")
    @JsonInclude(JsonInclude.Include.NON_NULL)
    private Integer page;
    @JsonProperty("Size")
    @JsonInclude(JsonInclude.Include.NON_NULL)
    private Integer size;
    @JsonProperty("TotalCount")
    @JsonInclude(JsonInclude.Include.NON_NULL)
    private Long totalCount;
    @JsonProperty("Data")
    private T data;
    @JsonProperty("Timestamp")
    private String timestamp = Instant.now().toString();

    public static <T> StandardApiResponse<T> success(String message, T data) {
        StandardApiResponse<T> response = new StandardApiResponse<>();
        response.setSuccess(true);
        response.setMessage(message);
        response.setData(data);
        return response;
    }

    public static <T> StandardApiResponse<T> successPagedList(
            String message,
            T data,
            int page,
            int size,
            long totalCount
    ) {
        StandardApiResponse<T> response = success(message, data);
        response.setPage(page);
        response.setSize(size);
        response.setTotalCount(totalCount);
        return response;
    }

    public static <T> StandardApiResponse<T> error(String message, String errorCode) {
        StandardApiResponse<T> response = new StandardApiResponse<>();
        response.setSuccess(false);
        response.setMessage(message);
        response.setErrorCode(errorCode);
        return response;
    }

    public boolean isSuccess() {
        return success;
    }

    public void setSuccess(boolean success) {
        this.success = success;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public String getErrorCode() {
        return errorCode;
    }

    public void setErrorCode(String errorCode) {
        this.errorCode = errorCode;
    }

    public Integer getPage() {
        return page;
    }

    public void setPage(Integer page) {
        this.page = page;
    }

    public Integer getSize() {
        return size;
    }

    public void setSize(Integer size) {
        this.size = size;
    }

    public Long getTotalCount() {
        return totalCount;
    }

    public void setTotalCount(Long totalCount) {
        this.totalCount = totalCount;
    }

    public T getData() {
        return data;
    }

    public void setData(T data) {
        this.data = data;
    }

    public String getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(String timestamp) {
        this.timestamp = timestamp;
    }
}
