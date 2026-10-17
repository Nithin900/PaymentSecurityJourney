package com.example.PaymentA.Service;

import com.example.PaymentA.DTO.PaymentRequest;
import com.example.PaymentA.DTO.PaymentResponse;
import org.example.Exceptions.PaymentNotFoundException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.reactive.function.client.ClientRequest;
import org.springframework.web.reactive.function.client.ClientResponse;
import org.springframework.web.reactive.function.client.ExchangeFunction;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Mono;

import java.math.BigDecimal;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Service A only forwards to B, so B is replaced by a canned ExchangeFunction. */
class PaymentServiceImplTest {

    private final AtomicReference<ClientRequest> lastRequest = new AtomicReference<>();

    private PaymentServiceImpl serviceReplying(HttpStatus status, String json) {
        ExchangeFunction b = request -> {
            lastRequest.set(request);
            return Mono.just(ClientResponse.create(status)
                    .header("Content-Type", MediaType.APPLICATION_JSON_VALUE)
                    .body(json)
                    .build());
        };
        return new PaymentServiceImpl(WebClient.builder().baseUrl("http://b").exchangeFunction(b).build());
    }

    @Test
    void createPayment_postsToBAndReturnsItsResponse() {
        PaymentServiceImpl service = serviceReplying(HttpStatus.OK,
                "{\"paymentId\":\"P1\",\"status\":\"SUCCESS\",\"message\":\"Payment created Successfully\"}");

        PaymentResponse response = service.createPayment(new PaymentRequest("P1", "acc-1", new BigDecimal("25.50")));

        assertThat(lastRequest.get().method().name()).isEqualTo("POST");
        assertThat(lastRequest.get().url().getPath()).isEqualTo("/payments");
        assertThat(response.getPaymentId()).isEqualTo("P1");
        assertThat(response.getStatus()).isEqualTo("SUCCESS");
    }

    @Test
    void createPayment_whenBRejects_propagatesTheWebClientError() {
        PaymentServiceImpl service = serviceReplying(HttpStatus.CONFLICT, "{\"error\":\"DUPLICATE_PAYMENT\"}");

        assertThatThrownBy(() -> service.createPayment(new PaymentRequest("P1", "acc-1", BigDecimal.TEN)))
                .isInstanceOf(WebClientResponseException.Conflict.class);
    }

    @Test
    void getPayment_returnsBsResponse() {
        PaymentServiceImpl service = serviceReplying(HttpStatus.OK,
                "{\"paymentId\":\"P1\",\"status\":\"SUCCESS\",\"message\":\"Payment retrieved successfully\"}");

        PaymentResponse response = service.getPayment("P1");

        assertThat(lastRequest.get().url().getPath()).isEqualTo("/payments/P1");
        assertThat(response.getMessage()).isEqualTo("Payment retrieved successfully");
    }

    @Test
    void getPayment_whenB404_becomesPaymentNotFoundException() {
        PaymentServiceImpl service = serviceReplying(HttpStatus.NOT_FOUND, "{}");

        assertThatThrownBy(() -> service.getPayment("P9"))
                .isInstanceOf(PaymentNotFoundException.class)
                .hasMessage("Payment not found: P9");
    }

    @Test
    void getPayment_whenBFailsOtherwise_isNotMaskedAsNotFound() {
        PaymentServiceImpl service = serviceReplying(HttpStatus.INTERNAL_SERVER_ERROR, "{}");

        assertThatThrownBy(() -> service.getPayment("P1"))
                .isInstanceOf(WebClientResponseException.InternalServerError.class);
    }

    @Test
    void getAllPayments_collectsTheArrayFromB() {
        PaymentServiceImpl service = serviceReplying(HttpStatus.OK,
                "[{\"paymentId\":\"P1\",\"status\":\"SUCCESS\"},{\"paymentId\":\"P2\",\"status\":\"SUCCESS\"}]");

        List<PaymentResponse> all = service.getAllPayments();

        assertThat(lastRequest.get().url().getPath()).isEqualTo("/payments");
        assertThat(all).extracting(PaymentResponse::getPaymentId).containsExactly("P1", "P2");
    }

    @Test
    void getAllPayments_emptyArray_isEmptyList() {
        assertThat(serviceReplying(HttpStatus.OK, "[]").getAllPayments()).isEmpty();
    }
}
