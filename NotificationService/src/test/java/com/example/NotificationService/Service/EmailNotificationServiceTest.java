package com.example.NotificationService.Service;

import com.example.NotificationService.DTO.NotificationRequest;
import com.example.NotificationService.DTO.NotificationResponse;
import com.example.NotificationService.Exceptions.NotificationFailedException;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.Test;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSender;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.IContext;

import java.math.BigDecimal;
import java.util.Properties;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class EmailNotificationServiceTest {

    private final JavaMailSender mailSender = mock(JavaMailSender.class);
    private final TemplateEngine templateEngine = mock(TemplateEngine.class);
    private final MimeMessage message = new MimeMessage(Session.getInstance(new Properties()));

    private EmailNotificationService service(String fixedRecipient) {
        when(mailSender.createMimeMessage()).thenReturn(message);
        when(templateEngine.process(eq("payment-notification"), any(IContext.class))).thenReturn("<p>hi</p>");
        return new EmailNotificationService(mailSender, templateEngine,
                "payments@example.com", fixedRecipient, "example.local");
    }

    private static NotificationRequest request(String owner) {
        return new NotificationRequest("P1", owner, new BigDecimal("25.50"), "SUCCESS");
    }

    @Test
    void send_buildsAndSendsTheEmail() throws Exception {
        NotificationResponse response = service("").send(request("alice@mail.com"));

        verify(mailSender).send(message);
        assertThat(message.getFrom()[0].toString()).isEqualTo("payments@example.com");
        assertThat(message.getAllRecipients()[0].toString()).isEqualTo("alice@mail.com");
        assertThat(message.getSubject()).isEqualTo("Payment P1: SUCCESS");
        assertThat(response.getPaymentId()).isEqualTo("P1");
        assertThat(response.getStatus()).isEqualTo("SENT");
        assertThat(response.getMessage()).isEqualTo("Notification sent to alice@mail.com");
    }

    @Test
    void send_ownerWithoutAtSign_getsFallbackDomain() throws Exception {
        service("").send(request("nithin"));

        assertThat(message.getAllRecipients()[0].toString()).isEqualTo("nithin@example.local");
    }

    @Test
    void send_fixedRecipient_overridesTheOwner() throws Exception {
        NotificationResponse response = service("dev@team.com").send(request("alice@mail.com"));

        assertThat(message.getAllRecipients()[0].toString()).isEqualTo("dev@team.com");
        assertThat(response.getMessage()).contains("dev@team.com");
    }

    @Test
    void send_passesPaymentDetailsToTheTemplate() {
        service("").send(request("nithin"));

        org.mockito.ArgumentCaptor<org.thymeleaf.context.Context> ctx =
                org.mockito.ArgumentCaptor.forClass(org.thymeleaf.context.Context.class);
        verify(templateEngine).process(eq("payment-notification"), ctx.capture());
        assertThat(ctx.getValue().getVariable("paymentId")).isEqualTo("P1");
        assertThat(ctx.getValue().getVariable("owner")).isEqualTo("nithin");
        assertThat(ctx.getValue().getVariable("amount")).isEqualTo(new BigDecimal("25.50"));
        assertThat(ctx.getValue().getVariable("status")).isEqualTo("SUCCESS");
    }

    @Test
    void send_smtpFailure_throwsNotificationFailedException() {
        EmailNotificationService service = service("");
        doThrow(new MailSendException("smtp down")).when(mailSender).send(any(MimeMessage.class));

        assertThatThrownBy(() -> service.send(request("nithin")))
                .isInstanceOf(NotificationFailedException.class)
                .hasMessage("Could not send email for payment P1")
                .hasCauseInstanceOf(MailSendException.class);
    }

    @Test
    void send_invalidAddress_failsBeforeSending() {
        EmailNotificationService service = service("");

        // a recipient with a space is not a valid RFC 822 address
        assertThatThrownBy(() -> service.send(request("bad address@@")))
                .isInstanceOf(NotificationFailedException.class);
        verify(mailSender, never()).send(any(MimeMessage.class));
    }
}
