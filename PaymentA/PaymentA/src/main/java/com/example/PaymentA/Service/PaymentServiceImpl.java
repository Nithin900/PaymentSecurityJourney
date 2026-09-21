package com.example.PaymentA.service;

import com.example.PaymentA.dto.PaymentRequest;
import com.example.PaymentA.dto.PaymentResponse;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.List;

@Service
public class PaymentServiceImpl implements PaymentService {

    private final WebClient webClient;

    public PaymentServiceImpl(WebClient webClient) {
        this.webClient = webClient;
    }

    @Override
    public PaymentResponse createPayment(PaymentRequest request) {

        return webClient.post()
                .uri("/payments")
                .bodyValue(request)
                .retrieve()
                .bodyToMono(PaymentResponse.class)
                .block();
    }

    @Override
    public PaymentResponse getPayment(String paymentId) {

        return webClient.get()
                .uri("/payments/{paymentId}", paymentId)
                .retrieve()
                .bodyToMono(PaymentResponse.class)
                .block();
    }

    @Override
    public List<PaymentResponse> getAllPayments() {

        return webClient.get()
                .uri("/payments")
                .retrieve()
                .bodyToFlux(PaymentResponse.class)
                .collectList()
                .block();
    }
}
