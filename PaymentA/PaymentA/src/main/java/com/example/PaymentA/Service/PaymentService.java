package com.example.PaymentA.service;

import com.example.PaymentA.dto.PaymentRequest;
import com.example.PaymentA.dto.PaymentResponse;

import java.util.List;

public interface PaymentService {

    PaymentResponse createPayment(PaymentRequest request);

    PaymentResponse getPayment(String paymentId);

    List<PaymentResponse> getAllPayments();
}
