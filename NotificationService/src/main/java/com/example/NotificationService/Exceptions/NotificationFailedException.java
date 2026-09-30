package com.example.NotificationService.Exceptions;

public class NotificationFailedException extends RuntimeException {

    public NotificationFailedException(String message, Throwable cause) {
        super(message, cause);
    }
}