package com.example.PaymentA.Exceptions;


import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

public class ErrorResponse {

    @Schema(example = "2026-10-09T12:16:35")
    private LocalDateTime timestamp;
    @Schema(description = "HTTP status code", example = "404")
    private int status;
    @Schema(description = "Stable error code to match on", example = "PAYMENT_NOT_FOUND")
    private String error;
    @Schema(description = "Human-readable explanation", example = "Payment PS-1001 not found")
    private String message;
    @Schema(description = "Request path", example = "/payments/PS-1001")
    private String path;

    public ErrorResponse() {
    }

    public ErrorResponse(
            LocalDateTime timestamp,
            int status,
            String error,
            String message,
            String path) {

        this.timestamp = timestamp;
        this.status = status;
        this.error = error;
        this.message = message;
        this.path = path;
    }

    public LocalDateTime getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(LocalDateTime timestamp) {
        this.timestamp = timestamp;
    }

    public int getStatus() {
        return status;
    }

    public void setStatus(int status) {
        this.status = status;
    }

    public String getError() {
        return error;
    }

    public void setError(String error) {
        this.error = error;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public String getPath() {
        return path;
    }

    public void setPath(String path) {
        this.path = path;
    }
}