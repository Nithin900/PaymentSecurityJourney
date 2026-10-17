package com.example.NotificationService.Controller;

import com.example.NotificationService.Config.SecurityConfig;
import com.example.NotificationService.DTO.NotificationResponse;
import com.example.NotificationService.Exceptions.GlobalExceptionHandler;
import com.example.NotificationService.Exceptions.NotificationFailedException;
import com.example.NotificationService.Service.NotificationService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(NotificationController.class)
@Import({SecurityConfig.class, GlobalExceptionHandler.class})
class NotificationControllerWebTest {

    private static final String BODY = """
            {"paymentId":"P1","owner":"nithin","amount":25.50,"status":"SUCCESS"}""";

    @Autowired
    MockMvc mvc;

    @MockitoBean
    NotificationService notificationService;
    @MockitoBean
    JwtDecoder jwtDecoder;

    private static RequestPostProcessor scope(String scope) {
        return jwt().authorities(new SimpleGrantedAuthority("SCOPE_" + scope));
    }

    @Test
    void send_withScope_returnsSentResponse() throws Exception {
        when(notificationService.send(any()))
                .thenReturn(new NotificationResponse("P1", "SENT", "Notification sent to nithin@example.local"));

        mvc.perform(post("/notifications").with(scope("notification.send"))
                        .contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.paymentId").value("P1"))
                .andExpect(jsonPath("$.status").value("SENT"));
    }

    @Test
    void send_noToken_is401() throws Exception {
        mvc.perform(post("/notifications").contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isUnauthorized());
        verifyNoInteractions(notificationService);
    }

    @Test
    void send_wrongScope_is403() throws Exception {
        mvc.perform(post("/notifications").with(scope("payment.write"))
                        .contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isForbidden());
        verifyNoInteractions(notificationService);
    }

    @Test
    void send_invalidAmount_is400ValidationError() throws Exception {
        mvc.perform(post("/notifications").with(scope("notification.send"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"paymentId":"P1","owner":"nithin","amount":0,"status":"SUCCESS"}"""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.message").value("amount must be greater than 0"));
        verifyNoInteractions(notificationService);
    }

    @Test
    void send_blankOwner_is400ValidationError() throws Exception {
        mvc.perform(post("/notifications").with(scope("notification.send"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"paymentId":"P1","owner":" ","amount":5,"status":"SUCCESS"}"""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("VALIDATION_ERROR"));
    }

    @Test
    void send_malformedJson_is400() throws Exception {
        mvc.perform(post("/notifications").with(scope("notification.send"))
                        .contentType(MediaType.APPLICATION_JSON).content("{oops"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("MALFORMED_REQUEST_BODY"));
    }

    @Test
    void send_whenEmailFails_is502() throws Exception {
        when(notificationService.send(any()))
                .thenThrow(new NotificationFailedException("Could not send email for payment P1", new RuntimeException()));

        mvc.perform(post("/notifications").with(scope("notification.send"))
                        .contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.error").value("NOTIFICATION_FAILED"))
                .andExpect(jsonPath("$.status").value(502));
    }
}
