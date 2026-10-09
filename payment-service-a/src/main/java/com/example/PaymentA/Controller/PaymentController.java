package com.example.PaymentA.Controller;

import com.example.PaymentA.DTO.PaymentRequest;
import com.example.PaymentA.DTO.PaymentResponse;
import com.example.PaymentA.Service.PaymentService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/payments")
@Tag(name = "Payments", description = "Create and read payments (forwarded to Service B)")
public class PaymentController {

    private final PaymentService paymentService;

    public PaymentController(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    @Operation(summary = "Create a payment", description = "Needs scope payment.write. The payment is owned by the user in the token.")
    @ApiResponse(responseCode = "200", description = "Created")
    @ApiResponse(responseCode = "400", description = "Invalid body or amount")
    @ApiResponse(responseCode = "401", description = "Missing, invalid or expired token")
    @ApiResponse(responseCode = "403", description = "Token lacks payment.write")
    @ApiResponse(responseCode = "409", description = "paymentId already exists")
    @PostMapping
    public ResponseEntity<PaymentResponse> createPayment(
            @RequestBody PaymentRequest request) {

        PaymentResponse response =
                paymentService.createPayment(request);

        return ResponseEntity.ok(response);
    }

    @Operation(summary = "Get one of your payments", description = "Needs scope payment.read. Another user's payment returns 404.")
    @ApiResponse(responseCode = "404", description = "Not found, or owned by someone else")
    @GetMapping("/{paymentId}")
    public ResponseEntity<PaymentResponse> getPayment(
            @PathVariable String paymentId) {

        PaymentResponse response =
                paymentService.getPayment(paymentId);

        return ResponseEntity.ok(response);
    }

    @Operation(summary = "List your payments", description = "Needs scope payment.read. Only the payments of the user in the token.")
    @GetMapping
    public ResponseEntity<List<PaymentResponse>> getAllPayments() {

        List<PaymentResponse> responses =
                paymentService.getAllPayments();

        return ResponseEntity.ok(responses);
    }
}
