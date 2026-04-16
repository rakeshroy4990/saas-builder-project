package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;

public class StandardApiResponse<T> {
    @JsonProperty("Success")
    private boolean success;
    @JsonProperty("Message")
    private String message;
    @JsonProperty("ErrorCode")
    private String errorCode;
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
