package org.example.DTO;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;

public class PaymentRequest {

    @NotBlank
    private String paymentId;
    public String getPaymentId() {
        return paymentId;
    }
    public void setPaymentId(String paymentId) {
        this.paymentId = paymentId;
    }
    @NotBlank
    private String accountNumber;
    public String getAccountNumber() {
        return accountNumber;
    }
    public void setAccountNumber(String accountNumber) {
        this.accountNumber = accountNumber;
    }
    @NotNull
    @Positive
    private BigDecimal amount;
    public BigDecimal getAmount() {
        return amount;
    }
    public void setAmount(BigDecimal amount) {
        this.amount = amount;
    }
    public PaymentRequest() {
    }

    public PaymentRequest(String paymentId, String accountNumber, BigDecimal amount) {
        this.paymentId = paymentId;
        this.accountNumber = accountNumber;
        this.amount = amount;
    }


}

