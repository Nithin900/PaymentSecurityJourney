package com.example.NotificationService.DTO;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;

public class NotificationRequest {

    @NotBlank
    private String paymentId;

    @NotBlank
    private String owner;

    @NotNull
    @Positive
    private BigDecimal amount;

    @NotBlank
    private String status;

    public NotificationRequest() {
    }

    public NotificationRequest(String paymentId, String owner, BigDecimal amount, String status) {
        this.paymentId = paymentId;
        this.owner = owner;
        this.amount = amount;
        this.status = status;
    }

    public String getPaymentId() { return paymentId; }
    public void setPaymentId(String paymentId) { this.paymentId = paymentId; }

    public String getOwner() { return owner; }
    public void setOwner(String owner) { this.owner = owner; }

    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
}