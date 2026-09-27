package com.example.settlement.client;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

// Only the fields the job needs. Adjust names if Service B's response uses different ones.
@JsonIgnoreProperties(ignoreUnknown = true)
public record PaymentDto(String paymentId, String status) {
}
