package org.example.Notification;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.reactive.function.client.ClientResponse;
import org.springframework.web.reactive.function.client.ExchangeFunction;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.math.BigDecimal;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

class NotificationListenerTest {

    private static final PaymentCreatedEvent EVENT = new PaymentCreatedEvent("P1", "nithin", new BigDecimal("25.50"));

    @Test
    void postsPaymentDetailsToNotificationsEndpoint() {
        AtomicReference<String> method = new AtomicReference<>();
        AtomicReference<String> path = new AtomicReference<>();
        ExchangeFunction ok = request -> {
            method.set(request.method().name());
            path.set(request.url().getPath());
            return Mono.just(ClientResponse.create(HttpStatus.OK).build());
        };

        new NotificationListener(WebClient.builder().baseUrl("http://notify").exchangeFunction(ok).build())
                .onPaymentCreated(EVENT);

        assertThat(method.get()).isEqualTo("POST");
        assertThat(path.get()).isEqualTo("/notifications");
    }

    @Test
    void downstreamError_isSwallowed() {
        ExchangeFunction serverError = request ->
                Mono.just(ClientResponse.create(HttpStatus.BAD_GATEWAY).build());

        NotificationListener listener =
                new NotificationListener(WebClient.builder().baseUrl("http://notify").exchangeFunction(serverError).build());

        assertThatCode(() -> listener.onPaymentCreated(EVENT)).doesNotThrowAnyException();
    }

    @Test
    void connectionFailure_isSwallowed() {
        ExchangeFunction down = request -> Mono.error(new IllegalStateException("connection refused"));

        NotificationListener listener =
                new NotificationListener(WebClient.builder().baseUrl("http://notify").exchangeFunction(down).build());

        assertThatCode(() -> listener.onPaymentCreated(EVENT)).doesNotThrowAnyException();
    }
}
