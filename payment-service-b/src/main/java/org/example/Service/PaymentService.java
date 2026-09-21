package org.example.Service;

import org.example.DTO.PaymentRequest;
import org.example.DTO.PaymentResponse;

import java.util.List;

public interface PaymentService {
    PaymentResponse create(PaymentRequest request);

    PaymentResponse getPaymentById(String paymentId);

    List<PaymentResponse> getAllPayments();
}

