package com.example.PaymentA.Exceptions;

public class PaymentServiceUnavailableException extends RuntimeException {
    public PaymentServiceUnavailableException(String message) {
        super(message);
    }
    public PaymentServiceUnavailableException(
            String message,
            Throwable cause) {

        super(message, cause);
    }
}
