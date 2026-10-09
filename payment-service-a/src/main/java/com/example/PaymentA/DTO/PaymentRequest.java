package com.example.PaymentA.DTO;

import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;

public class PaymentRequest {

    @Schema(description = "Your own unique id; reusing one returns 409", example = "PS-1001")
    private String paymentId;
    @Schema(description = "Account the payment is for", example = "acc-123")
    private String accountNumber;
    @Schema(description = "Must be greater than 0", example = "25.50")
    private BigDecimal amount;

    public PaymentRequest() {
    }

    public PaymentRequest(String paymentId, String accountNumber, BigDecimal amount) {
        this.paymentId = paymentId;
        this.accountNumber = accountNumber;
        this.amount = amount;
    }

    public String getPaymentId() {
        return paymentId;
    }

    public void setPaymentId(String paymentId) {
        this.paymentId = paymentId;
    }

    public String getAccountNumber() {
        return accountNumber;
    }

    public void setAccountNumber(String accountNumber) {
        this.accountNumber = accountNumber;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public void setAmount(BigDecimal amount) {
        this.amount = amount;
    }
}
