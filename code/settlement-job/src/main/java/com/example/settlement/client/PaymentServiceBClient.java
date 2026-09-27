package com.example.settlement.client;

import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.List;

@Component
public class PaymentServiceBClient {

    private final RestClient serviceBRestClient;

    public PaymentServiceBClient(RestClient serviceBRestClient) {
        this.serviceBRestClient = serviceBRestClient;
    }

    // GET /payments?status=SUCCESS   → needs SCOPE_payment.read in Service B
    public List<PaymentDto> getPaymentsByStatus(String status) {
        List<PaymentDto> payments = serviceBRestClient.get()
                .uri(uri -> uri.path("/payments").queryParam("status", status).build())
                .retrieve()
                .body(new ParameterizedTypeReference<List<PaymentDto>>() {});
        return payments == null ? List.of() : payments;
    }

    // PATCH /payments/{id}/settle     → needs SCOPE_payment.settle in Service B
    public void settle(String paymentId) {
        serviceBRestClient.patch()
                .uri("/payments/{paymentId}/settle", paymentId)
                .retrieve()
                .toBodilessEntity();
    }
}
