package com.example.PaymentA.Controller;

import com.example.PaymentA.DTO.PaymentRequest;
import com.example.PaymentA.DTO.PaymentResponse;
import com.example.PaymentA.Exceptions.ErrorResponse;
import com.example.PaymentA.Service.PaymentService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/payments")
@Tag(name = "Payments", description = "Create and read payments (forwarded to Service B). Needs a Bearer token: click Authorize first.")
public class PaymentController {

    private final PaymentService paymentService;

    public PaymentController(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    @Operation(operationId = "createPayment",
            summary = "Create a payment",
            description = "Needs scope **payment.write**. The payment is owned by the user in the token, "
                    + "and the Notification Service sends an email after it is saved (a failed email never fails the payment).")
    @ApiResponse(responseCode = "200", description = "Payment created",
            content = @Content(schema = @Schema(implementation = PaymentResponse.class)))
    @ApiResponse(responseCode = "400", description = "Malformed JSON, missing field or amount not greater than 0",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class),
                    examples = @ExampleObject(name = "Amount not positive", value = """
                            {"timestamp":"2026-10-09T12:16:35","status":400,"error":"INVALID_PAYMENT","message":"Payment amount must be greater than zero","path":"/payments"}""")))
    @ApiResponse(responseCode = "401", description = "Missing, invalid or expired token (empty body, see the WWW-Authenticate header)", content = @Content)
    @ApiResponse(responseCode = "403", description = "Token is valid but lacks scope payment.write", content = @Content)
    @ApiResponse(responseCode = "409", description = "A payment with this paymentId already exists",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @ApiResponse(responseCode = "503", description = "Service B is not reachable or timed out",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class),
                    examples = @ExampleObject(name = "B down", value = """
                            {"timestamp":"2026-10-09T12:16:35","status":503,"error":"PAYMENT_SERVICE_UNAVAILABLE","message":"Service B is not reachable","path":"/payments"}""")))
    @PostMapping
    public ResponseEntity<PaymentResponse> createPayment(
            @RequestBody PaymentRequest request) {

        PaymentResponse response =
                paymentService.createPayment(request);

        return ResponseEntity.ok(response);
    }

    @Operation(operationId = "getPayment",
            summary = "Get one of your payments",
            description = "Needs scope **payment.read**. A payment owned by another user is reported as not found (404), never as forbidden.")
    @ApiResponse(responseCode = "200", description = "The payment",
            content = @Content(schema = @Schema(implementation = PaymentResponse.class)))
    @ApiResponse(responseCode = "401", description = "Missing, invalid or expired token", content = @Content)
    @ApiResponse(responseCode = "403", description = "Token lacks scope payment.read", content = @Content)
    @ApiResponse(responseCode = "404", description = "Not found, or owned by someone else",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class),
                    examples = @ExampleObject(name = "Not found", value = """
                            {"timestamp":"2026-10-09T12:16:35","status":404,"error":"PAYMENT_NOT_FOUND","message":"Payment PS-1001 not found","path":"/payments/PS-1001"}""")))
    @GetMapping("/{paymentId}")
    public ResponseEntity<PaymentResponse> getPayment(
            @Parameter(description = "The paymentId you used when creating it", example = "PS-1001")
            @PathVariable String paymentId) {

        PaymentResponse response =
                paymentService.getPayment(paymentId);

        return ResponseEntity.ok(response);
    }

    @Operation(operationId = "listPayments",
            summary = "List your payments",
            description = "Needs scope **payment.read**. Only the payments of the user in the token; an empty list if there are none.")
    @ApiResponse(responseCode = "200", description = "Your payments",
            content = @Content(array = @io.swagger.v3.oas.annotations.media.ArraySchema(schema = @Schema(implementation = PaymentResponse.class))))
    @ApiResponse(responseCode = "401", description = "Missing, invalid or expired token", content = @Content)
    @ApiResponse(responseCode = "403", description = "Token lacks scope payment.read", content = @Content)
    @GetMapping
    public ResponseEntity<List<PaymentResponse>> getAllPayments() {

        List<PaymentResponse> responses =
                paymentService.getAllPayments();

        return ResponseEntity.ok(responses);
    }
}
