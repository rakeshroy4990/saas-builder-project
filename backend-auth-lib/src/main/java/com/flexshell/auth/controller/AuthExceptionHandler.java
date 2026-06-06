package com.flexshell.auth.controller;

import com.flexshell.auth.api.ApiResponse;
import com.flexshell.auth.api.AuthApiException;
import com.flexshell.auth.i18n.ApiMessageResolver;
import com.flexshell.auth.i18n.RequestLocaleAttributes;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.stream.Collectors;

@RestControllerAdvice(assignableTypes = AuthController.class)
public class AuthExceptionHandler {

    private final ApiMessageResolver messages;

    public AuthExceptionHandler(ApiMessageResolver messages) {
        this.messages = messages;
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidation(
            MethodArgumentNotValidException exception,
            HttpServletRequest request
    ) {
        String locale = RequestLocaleAttributes.readResolvedLocale(request);
        String message = exception.getBindingResult().getFieldErrors().stream()
                .map(error -> toMessage(error, locale))
                .collect(Collectors.joining("; "));
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error(message, "AUTH_VALIDATION_FAILED"));
    }

    @ExceptionHandler(AuthApiException.class)
    public ResponseEntity<ApiResponse<Void>> handleAuthApiException(
            AuthApiException exception,
            HttpServletRequest request
    ) {
        String locale = RequestLocaleAttributes.readResolvedLocale(request);
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(ApiResponse.error(messages.forErrorCode(exception.getErrorCode(), locale), exception.getErrorCode()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleGeneric(Exception exception, HttpServletRequest request) {
        String locale = RequestLocaleAttributes.readResolvedLocale(request);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error(messages.get("error.auth.internal", locale), "AUTH_INTERNAL_ERROR"));
    }

    private String toMessage(FieldError error, String locale) {
        String invalid = messages.get("error.auth.validation_field_invalid", locale);
        return error.getField() + ": " + (error.getDefaultMessage() == null ? invalid : error.getDefaultMessage());
    }
}
