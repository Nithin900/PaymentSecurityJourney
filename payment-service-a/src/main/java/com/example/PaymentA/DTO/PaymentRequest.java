package com.example.PaymentA.DTO;

import java.math.BigDecimal;

public class PaymentRequest {

    private String paymentId;
    private String accountNumber;
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
