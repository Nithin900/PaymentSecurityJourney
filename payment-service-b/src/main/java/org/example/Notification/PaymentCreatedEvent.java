package org.example.Notification;

import java.math.BigDecimal;

public record PaymentCreatedEvent(String paymentId, String owner, BigDecimal amount) {
}