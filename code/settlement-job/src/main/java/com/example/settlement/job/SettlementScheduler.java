package com.example.settlement.job;

import com.example.settlement.client.PaymentDto;
import com.example.settlement.client.PaymentServiceBClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;

import java.util.List;

@Component
public class SettlementScheduler {

    private static final Logger log = LoggerFactory.getLogger(SettlementScheduler.class);

    private final PaymentServiceBClient paymentClient;

    public SettlementScheduler(PaymentServiceBClient paymentClient) {
        this.paymentClient = paymentClient;
    }

    // Runs every minute (settlement.fixed-delay-ms), first run 10 s after startup.
    @Scheduled(fixedDelayString = "${settlement.fixed-delay-ms}", initialDelay = 10_000)
    public void settleSuccessfulPayments() {
        List<PaymentDto> toSettle;
        try {
            toSettle = paymentClient.getPaymentsByStatus("SUCCESS");
        } catch (HttpClientErrorException.Forbidden e) {
            // Valid token but missing scope: a configuration problem, retrying won't help.
            log.error("Service B refused the job (403). Check the settlement-job scopes on the Auth Server.");
            return;
        } catch (RuntimeException e) {
            // Auth Server down, Service B down, 401, network error: try again next run.
            log.warn("Could not load payments, will retry next run: {}", e.getMessage());
            return;
        }

        int settled = 0;
        int failed = 0;
        for (PaymentDto payment : toSettle) {
            try {
                paymentClient.settle(payment.paymentId());
                settled++;
            } catch (RuntimeException e) {
                // One bad payment (404, 409, timeout) must not stop the others.
                failed++;
                log.warn("Could not settle {}: {}", payment.paymentId(), e.getMessage());
            }
        }
        log.info("Settlement run finished: {} found, {} settled, {} failed", toSettle.size(), settled, failed);
    }
}
