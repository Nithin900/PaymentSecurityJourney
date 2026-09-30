package com.example.NotificationService.Service;

import com.example.NotificationService.DTO.NotificationRequest;
import com.example.NotificationService.DTO.NotificationResponse;
import com.example.NotificationService.Exceptions.NotificationFailedException;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

import java.nio.charset.StandardCharsets;

@Service
public class EmailNotificationService implements NotificationService {

    private static final Logger log = LoggerFactory.getLogger(EmailNotificationService.class);

    private final JavaMailSender mailSender;
    private final TemplateEngine templateEngine;
    private final String from;
    private final String fixedRecipient;
    private final String recipientDomain;

    public EmailNotificationService(JavaMailSender mailSender,
                                    TemplateEngine templateEngine,
                                    @Value("${notification.from}") String from,
                                    @Value("${notification.recipient:}") String fixedRecipient,
                                    @Value("${notification.recipient-domain}") String recipientDomain) {
        this.mailSender = mailSender;
        this.templateEngine = templateEngine;
        this.from = from;
        this.fixedRecipient = fixedRecipient;
        this.recipientDomain = recipientDomain;
    }

    @Override
    public NotificationResponse send(NotificationRequest request) {
        String to = recipientFor(request.getOwner());

        Context ctx = new Context();
        ctx.setVariable("paymentId", request.getPaymentId());
        ctx.setVariable("owner", request.getOwner());
        ctx.setVariable("amount", request.getAmount());
        ctx.setVariable("status", request.getStatus());
        String html = templateEngine.process("payment-notification", ctx);

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, StandardCharsets.UTF_8.name());
            helper.setFrom(from);
            helper.setTo(to);
            helper.setSubject("Payment " + request.getPaymentId() + ": " + request.getStatus());
            helper.setText(html, true);
            mailSender.send(message);
        } catch (MailException | MessagingException e) {
            log.error("Could not send notification for payment {} to {}", request.getPaymentId(), to, e);
            throw new NotificationFailedException("Could not send email for payment " + request.getPaymentId(), e);
        }

        log.info("Notification sent for payment {} to {}", request.getPaymentId(), to);
        return new NotificationResponse(request.getPaymentId(), "SENT", "Notification sent to " + to);
    }

    private String recipientFor(String owner) {
        if (!fixedRecipient.isBlank()) {
            return fixedRecipient;                       // dev: anni mails ee address ki
        }
        return owner.contains("@") ? owner : owner + "@" + recipientDomain;
    }
}