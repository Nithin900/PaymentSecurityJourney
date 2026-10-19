package org.example.DTO;

public class PaymentResponse {
    private String paymentId;
    private String status;
    private String message;
    public String getPaymentId() {
        return paymentId;
    }
    // needed so the JSON copy in Redis can be read back into a PaymentResponse
    public PaymentResponse() {
    }

    public PaymentResponse(String paymentId, String status, String message) {
        this.paymentId = paymentId;
        this.status = status;
        this.message = message;
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

