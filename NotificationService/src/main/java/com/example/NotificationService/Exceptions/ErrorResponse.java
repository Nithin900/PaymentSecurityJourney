package com.example.NotificationService.Exceptions;

import java.time.LocalDateTime;

public class ErrorResponse {
    private String message;
    private int status;
    private String error;
    private String path;
    private LocalDateTime timestamp;

    public ErrorResponse(LocalDateTime timestamp, int status, String error, String message, String path) {
        this.timestamp = timestamp;
        this.status = status;
        this.error = error;
        this.message = message;
        this.path = path;
    }

    public String getMessage() { return message; }
    public int getStatus() { return status; }
    public String getError() { return error; }
    public String getPath() { return path; }
    public LocalDateTime getTimestamp() { return timestamp; }
}