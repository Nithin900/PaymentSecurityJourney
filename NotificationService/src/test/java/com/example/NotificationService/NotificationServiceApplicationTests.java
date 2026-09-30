package com.example.NotificationService;

import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.http.MediaType;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Properties;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class NotificationServiceApplicationTests {

	private static final String BODY =
			"{\"paymentId\":\"PAY-1\",\"owner\":\"nithin\",\"amount\":100.50,\"status\":\"SUCCESS\"}";

	@Autowired
	MockMvc mvc;

	@MockitoBean
	JavaMailSender mailSender;

	@MockitoBean
	JwtDecoder jwtDecoder;   // so the test never connects to the auth server

	private void stubMimeMessage() {
		when(mailSender.createMimeMessage()).thenReturn(new MimeMessage(Session.getInstance(new Properties())));
	}

	@Test
	void withoutToken_returns401() throws Exception {
		mvc.perform(post("/notifications").contentType(MediaType.APPLICATION_JSON).content(BODY))
				.andExpect(status().isUnauthorized());
	}

	@Test
	void withoutSendScope_returns403() throws Exception {
		mvc.perform(post("/notifications")
						.with(jwt().authorities(() -> "SCOPE_payment.read"))
						.contentType(MediaType.APPLICATION_JSON).content(BODY))
				.andExpect(status().isForbidden());
	}

	@Test
	void validRequest_sendsMailAndReturnsSent() throws Exception {
		stubMimeMessage();

		mvc.perform(post("/notifications")
						.with(jwt().authorities(() -> "SCOPE_notification.send"))
						.contentType(MediaType.APPLICATION_JSON).content(BODY))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.paymentId").value("PAY-1"))
				.andExpect(jsonPath("$.status").value("SENT"));

		verify(mailSender).send(any(MimeMessage.class));
	}

	@Test
	void invalidBody_returns400() throws Exception {
		mvc.perform(post("/notifications")
						.with(jwt().authorities(() -> "SCOPE_notification.send"))
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"paymentId\":\"\",\"owner\":\"nithin\",\"amount\":-5,\"status\":\"SUCCESS\"}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.error").value("VALIDATION_ERROR"));
	}

	@Test
	void mailFailure_returns502() throws Exception {
		stubMimeMessage();
		doThrow(new MailSendException("smtp down")).when(mailSender).send(any(MimeMessage.class));

		mvc.perform(post("/notifications")
						.with(jwt().authorities(() -> "SCOPE_notification.send"))
						.contentType(MediaType.APPLICATION_JSON).content(BODY))
				.andExpect(status().isBadGateway())
				.andExpect(jsonPath("$.error").value("NOTIFICATION_FAILED"));
	}
}