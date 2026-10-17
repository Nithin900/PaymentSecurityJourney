package com.example.PaymentA.DTO;

@io.swagger.v3.oas.annotations.media.Schema(description = "A payment as stored by Service B")
public class PaymentResponse {

    @io.swagger.v3.oas.annotations.media.Schema(description = "The id you chose", example = "PS-1001")
    private String paymentId;
    @io.swagger.v3.oas.annotations.media.Schema(description = "Payment status", example = "SUCCESS")
    private String status;
    @io.swagger.v3.oas.annotations.media.Schema(description = "Details from Service B", example = "Payment created Successfully")
    private String message;

    public PaymentResponse() {
    }

    public PaymentResponse(String paymentId, String status, String message) {
        this.paymentId = paymentId;
        this.status = status;
        this.message = message;
    }

    public String getPaymentId() {
        return paymentId;
    }

    public void setPaymentId(String paymentId) {
        this.paymentId = paymentId;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }
}
