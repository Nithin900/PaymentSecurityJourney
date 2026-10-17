package com.example.PaymentA.Controller;

import com.example.PaymentA.DTO.PaymentResponse;
import com.example.PaymentA.Exceptions.GlobalExceptionHandler;
import com.example.PaymentA.Security.SecurityConfig;
import com.example.PaymentA.Service.PaymentService;
import org.example.Exceptions.PaymentNotFoundException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.web.reactive.function.client.WebClientRequestException;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.net.URI;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Service A's HTTP surface: scope rules from SecurityConfig and error mapping from GlobalExceptionHandler. */
@WebMvcTest(PaymentController.class)
@Import({SecurityConfig.class, GlobalExceptionHandler.class})
class PaymentControllerWebTest {

    private static final String BODY = """
            {"paymentId":"P1","accountNumber":"acc-1","amount":25.50}""";

    @Autowired
    MockMvc mvc;

    @MockitoBean
    PaymentService paymentService;
    @MockitoBean
    JwtDecoder jwtDecoder;

    private static RequestPostProcessor scope(String scope) {
        return jwt().authorities(new SimpleGrantedAuthority("SCOPE_" + scope));
    }

    // ---------- happy paths ----------

    @Test
    void create_withWriteScope_returnsServiceResponse() throws Exception {
        when(paymentService.createPayment(any()))
                .thenReturn(new PaymentResponse("P1", "SUCCESS", "Payment created Successfully"));

        mvc.perform(post("/payments").with(scope("payment.write"))
                        .contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.paymentId").value("P1"))
                .andExpect(jsonPath("$.status").value("SUCCESS"));
    }

    @Test
    void get_withReadScope_returnsServiceResponse() throws Exception {
        when(paymentService.getPayment("P1")).thenReturn(new PaymentResponse("P1", "SUCCESS", "ok"));

        mvc.perform(get("/payments/P1").with(scope("payment.read")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.paymentId").value("P1"));
    }

    @Test
    void list_withReadScope_returnsArray() throws Exception {
        when(paymentService.getAllPayments()).thenReturn(List.of(new PaymentResponse("P1", "SUCCESS", "ok")));

        mvc.perform(get("/payments").with(scope("payment.read")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].paymentId").value("P1"));
    }

    // ---------- security ----------

    @Test
    void noToken_is401_andServiceIsNeverCalled() throws Exception {
        mvc.perform(post("/payments").contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/payments")).andExpect(status().isUnauthorized());
        mvc.perform(get("/payments/P1")).andExpect(status().isUnauthorized());

        verifyNoInteractions(paymentService);
    }

    @Test
    void readScope_cannotCreate_is403() throws Exception {
        mvc.perform(post("/payments").with(scope("payment.read"))
                        .contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isForbidden());

        verifyNoInteractions(paymentService);
    }

    @Test
    void writeScope_cannotRead_is403() throws Exception {
        mvc.perform(get("/payments").with(scope("payment.write"))).andExpect(status().isForbidden());
    }

    @Test
    void swaggerDocs_arePublic() throws Exception {
        // not 401/403: the springdoc controller is not part of this slice, so the answer is 404
        mvc.perform(get("/v3/api-docs")).andExpect(status().isNotFound());
    }

    // ---------- error mapping ----------

    @Test
    void malformedJson_is400() throws Exception {
        mvc.perform(post("/payments").with(scope("payment.write"))
                        .contentType(MediaType.APPLICATION_JSON).content("{oops"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("MALFORMED_REQUEST_BODY"));
    }

    @Test
    void paymentNotFound_is404() throws Exception {
        when(paymentService.getPayment("P9")).thenThrow(new PaymentNotFoundException("Payment not found: P9"));

        mvc.perform(get("/payments/P9").with(scope("payment.read")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("PAYMENT_NOT_FOUND"))
                .andExpect(jsonPath("$.message").value("Payment not found: P9"))
                .andExpect(jsonPath("$.path").value("/payments/P9"));
    }

    @Test
    void bUnreachable_is503() throws Exception {
        when(paymentService.getAllPayments()).thenThrow(new WebClientRequestException(
                new java.net.ConnectException("refused"), HttpMethod.GET, URI.create("http://b/payments"),
                org.springframework.http.HttpHeaders.EMPTY));

        mvc.perform(get("/payments").with(scope("payment.read")))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.error").value("PAYMENT_SERVICE_UNAVAILABLE"));
    }

    @Test
    void bRejectsWithConflict_isPassedThroughWithBsBody() throws Exception {
        String bBody = "{\"error\":\"DUPLICATE_PAYMENT\",\"status\":409}";
        when(paymentService.createPayment(any())).thenThrow(WebClientResponseException.create(
                HttpStatus.CONFLICT.value(), "Conflict", org.springframework.http.HttpHeaders.EMPTY,
                bBody.getBytes(), null));

        mvc.perform(post("/payments").with(scope("payment.write"))
                        .contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isConflict())
                .andExpect(content().json(bBody));
    }

    @Test
    void bAnswers401_isReportedAsInvalidToken() throws Exception {
        when(paymentService.getAllPayments()).thenThrow(WebClientResponseException.create(
                401, "Unauthorized", org.springframework.http.HttpHeaders.EMPTY, new byte[0], null));

        mvc.perform(get("/payments").with(scope("payment.read")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Access token is invalid or expired"));
    }

    @Test
    void bAnswers403_isReportedAsForbidden() throws Exception {
        when(paymentService.getAllPayments()).thenThrow(WebClientResponseException.create(
                403, "Forbidden", org.springframework.http.HttpHeaders.EMPTY, new byte[0], null));

        mvc.perform(get("/payments").with(scope("payment.read")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("Forbidden"));
    }

    @Test
    void unexpectedException_is500WithoutLeakingDetails() throws Exception {
        when(paymentService.getAllPayments()).thenThrow(new IllegalStateException("secret internals"));

        mvc.perform(get("/payments").with(scope("payment.read")))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.error").value("INTERNAL_SERVER_ERROR"))
                .andExpect(jsonPath("$.message").value("An unexpected error occurred"));
    }

    @Test
    void unmappedRoute_is404NotFound() throws Exception {
        mvc.perform(get("/nothing-here").with(scope("payment.read")))
                .andExpect(status().isNotFound());
    }
}
