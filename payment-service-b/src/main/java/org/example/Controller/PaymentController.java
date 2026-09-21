package org.example.Controller;

import org.example.DTO.PaymentRequest;
import org.example.DTO.PaymentResponse;
import org.example.Service.PaymentService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
@RestController
@RequestMapping("/")
public class PaymentController {

   private final PaymentService paymentService;

   public PaymentController(PaymentService paymentService) {
      this.paymentService = paymentService;
   }

   @PostMapping("/payments")
    public ResponseEntity<PaymentResponse> createPayment(@Valid @RequestBody PaymentRequest paymentRequest) {
       PaymentResponse reponse= paymentService.create(paymentRequest);
       return ResponseEntity.ok(reponse);
   }

   @GetMapping("/payments/{paymentId}")
   public ResponseEntity<PaymentResponse> getPayment(@PathVariable("paymentId") String paymentId) {
       PaymentResponse reponse= paymentService.getPaymentById(paymentId);
       return ResponseEntity.ok(reponse);
   }
    @GetMapping("/payments")
    public ResponseEntity<List<PaymentResponse>> getAllPayments() {

        List<PaymentResponse> responses = paymentService.getAllPayments();

        return ResponseEntity.ok(responses);
    }


}

