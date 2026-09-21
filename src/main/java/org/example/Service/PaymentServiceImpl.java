package org.example.Service;

import org.example.DTO.PaymentRequest;
import org.example.DTO.PaymentResponse;
import org.example.Entity.Payment;
import org.example.Repository.PaymentRepository;
import org.springframework.stereotype.Service;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
public class PaymentServiceImpl implements PaymentService {

      private final PaymentRepository paymentRepository;

      public PaymentServiceImpl(PaymentRepository paymentRepository) {
          this.paymentRepository = paymentRepository;
      }

      public PaymentResponse create(PaymentRequest paymentRequest) {
          if(paymentRepository.existsById(paymentRequest.getPaymentId()))
          {
              throw new IllegalArgumentException("Payment ID already exists!");
          }
          Payment paymentEntity = new Payment();
          paymentEntity.setId(paymentRequest.getPaymentId());
          paymentEntity.setAccountNumber(paymentRequest.getAccountNumber());
          paymentEntity.setAmount(paymentRequest.getAmount());

          paymentRepository.save(paymentEntity);

          return new PaymentResponse(paymentEntity.getId(),"SUCCESS","Payment created Successfully");
      }

      public PaymentResponse getPaymentById(String paymentId) {
          Optional<Payment> paymentEntity = paymentRepository.findById(paymentId);
          if(paymentEntity.isEmpty())
          {
              throw new IllegalArgumentException("Payment not found!");
          }
            Payment savedPayment  = paymentEntity.get();

          return new  PaymentResponse(savedPayment.getId(),"SUCCESS","Payment retrieved successfully");
      }

      public  List<PaymentResponse> getAllPayments() {
          List<Payment> payments = paymentRepository.findAll();

          List<PaymentResponse> responses = new ArrayList<>();

          for (Payment payment : payments) {
              PaymentResponse response = new PaymentResponse(
                      payment.getId(),
                      "SUCCESS",
                      "Payment retrieved successfully"
              );
              responses.add(response);
          }
         return responses;

      }

}

