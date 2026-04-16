package com.flexshell.auth.api;

public class AuthApiException extends RuntimeException {
    private final String errorCode;

    public AuthApiException(String message, String errorCode) {
        super(message);
        this.errorCode = errorCode;
    }

    public String getErrorCode() {
        return errorCode;
    }
}
