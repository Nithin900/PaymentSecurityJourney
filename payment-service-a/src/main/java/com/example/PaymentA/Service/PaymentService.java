package com.example.PaymentA.Service;



import com.example.PaymentA.DTO.PaymentRequest;
import com.example.PaymentA.DTO.PaymentResponse;

import java.util.List;

public interface PaymentService {

    PaymentResponse createPayment(PaymentRequest request);

    PaymentResponse getPayment(String paymentId);

    List<PaymentResponse> getAllPayments();
}
