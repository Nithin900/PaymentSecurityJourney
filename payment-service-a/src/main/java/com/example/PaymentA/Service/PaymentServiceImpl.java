package com.example.PaymentA.Service;



import com.example.PaymentA.DTO.PaymentRequest;
import com.example.PaymentA.DTO.PaymentResponse;
import org.example.Exceptions.PaymentNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

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

        try {

            return webClient.get()
                    .uri("/payments/{paymentId}", paymentId)
                    .retrieve()
                    .bodyToMono(PaymentResponse.class)
                    .block();

        } catch (WebClientResponseException.NotFound ex) {

            throw new PaymentNotFoundException(
                    "Payment not found: " + paymentId
            );
        }
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
