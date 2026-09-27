package org.example.Service;

import org.example.DTO.PaymentRequest;
import org.example.DTO.PaymentResponse;
import org.example.Entity.Payment;
import org.example.Exceptions.DuplicatePaymentException;
import org.example.Exceptions.InvalidPaymentException;
import org.example.Exceptions.PaymentNotFoundException;
import org.example.Repository.PaymentRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
public class PaymentServiceImpl implements PaymentService {

    private final PaymentRepository paymentRepository;

    public PaymentServiceImpl(PaymentRepository paymentRepository) {
        this.paymentRepository = paymentRepository;
    }

    @Override
    public PaymentResponse create(PaymentRequest request) {

        // 1. Validate Payment ID
        if (request.getPaymentId() == null ||
                request.getPaymentId().isBlank()) {

            throw new InvalidPaymentException(
                    "Payment ID is required"
            );
        }

        // 2. Validate Account Number
        if (request.getAccountNumber() == null ||
                request.getAccountNumber().isBlank()) {

            throw new InvalidPaymentException(
                    "Account number is required"
            );
        }

        // 3. Validate Amount
        if (request.getAmount() == null ||
                request.getAmount().compareTo(BigDecimal.ZERO) <= 0) {

            throw new InvalidPaymentException(
                    "Payment amount must be greater than zero"
            );
        }

        // 4. Check Duplicate Payment ID
        if (paymentRepository.existsById(request.getPaymentId())) {

            throw new DuplicatePaymentException(
                    "Payment ID already exists: "
                            + request.getPaymentId()
            );
        }

        // 5. Create Payment Entity
        Payment paymentEntity = new Payment();

        paymentEntity.setId(request.getPaymentId());
        paymentEntity.setAccountNumber(request.getAccountNumber());
        paymentEntity.setAmount(request.getAmount());

        // 6. Save Payment
        paymentRepository.save(paymentEntity);

        // 7. Return Success Response
        return new PaymentResponse(
                paymentEntity.getId(),
                "SUCCESS",
                "Payment created Successfully"
        );
    }


    @Override
    public PaymentResponse getPaymentById(String paymentId) {

        // 1. Find payment
        Optional<Payment> paymentEntity =
                paymentRepository.findById(paymentId);

        // 2. Payment not found
        if (paymentEntity.isEmpty()) {

            throw new PaymentNotFoundException(
                    "Payment not found: " + paymentId
            );
        }

        // 3. Get entity
        Payment savedPayment = paymentEntity.get();

        // 4. Return response
        return new PaymentResponse(
                savedPayment.getId(),
                "SUCCESS",
                "Payment retrieved successfully"
        );
    }


    @Override
    public List<PaymentResponse> getAllPayments() {

        // 1. Get all payments
        List<Payment> payments =
                paymentRepository.findAll();

        // 2. Create response list
        List<PaymentResponse> responses =
                new ArrayList<>();

        // 3. Convert Entity → Response
        for (Payment payment : payments) {

            PaymentResponse response =
                    new PaymentResponse(
                            payment.getId(),
                            "SUCCESS",
                            "Payment retrieved successfully"
                    );

            responses.add(response);
        }

        // 4. Return responses
        return responses;
    }
}