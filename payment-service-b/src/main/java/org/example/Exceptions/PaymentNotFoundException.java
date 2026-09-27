package org.example.Exceptions;


    public class PaymentNotFoundException extends RuntimeException {

        public PaymentNotFoundException(String message) {
            super(message);
        }
    }

