package org.example.Notification;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.Map;

/**
 * Tells the notification service about a new payment, but only after the payment is committed,
 * and never lets a notification failure affect the payment itself.
 */
@Component
public class NotificationListener {

    private static final Logger log = LoggerFactory.getLogger(NotificationListener.class);

    private final WebClient notificationWebClient;

    public NotificationListener(WebClient notificationWebClient) {
        this.notificationWebClient = notificationWebClient;
    }

    // @Async: the email (SMTP) is slow; the caller must not wait for it or A times out with 503
    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onPaymentCreated(PaymentCreatedEvent event) {
        try {
            notificationWebClient.post()
                    .uri("/notifications")
                    .bodyValue(Map.of(
                            "paymentId", event.paymentId(),
                            "owner", event.owner(),
                            "amount", event.amount(),
                            "status", "SUCCESS"))
                    .retrieve()
                    .toBodilessEntity()
                    .block();
            log.info("Notification requested for payment {}", event.paymentId());
        } catch (Exception e) {
            log.warn("Payment {} saved, but the notification could not be sent: {}", event.paymentId(), e.getMessage());
        }
    }
}
