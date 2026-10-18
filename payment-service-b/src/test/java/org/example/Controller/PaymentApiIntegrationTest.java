package org.example.Controller;

import org.example.Notification.NotificationListener;
import org.example.Repository.PaymentRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.util.Arrays;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Service B end to end: real security chain, controller, service, exception handler and an
 * in-memory H2 database. Only the JWT decoder and the notification listener are replaced.
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:payments-test;DB_CLOSE_DELAY=-1",
        "spring.datasource.password=test",
        "spring.security.oauth2.client.registration.notification.client-secret=test-b-secret",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@AutoConfigureMockMvc
class PaymentApiIntegrationTest {

    private static final String BODY = """
            {"paymentId":"P1","accountNumber":"acc-1","amount":25.50}""";

    @Autowired
    MockMvc mvc;
    @Autowired
    PaymentRepository repository;

    @MockitoBean
    JwtDecoder jwtDecoder;
    @MockitoBean
    NotificationListener notificationListener;

    @BeforeEach
    void cleanDb() {
        repository.deleteAll();
    }

    private static RequestPostProcessor token(String user, String... scopes) {
        return jwt().jwt(j -> j.subject(user))
                .authorities(Arrays.stream(scopes)
                        .map(s -> new SimpleGrantedAuthority("SCOPE_" + s))
                        .toArray(SimpleGrantedAuthority[]::new));
    }

    private void create(String user, String body) throws Exception {
        mvc.perform(post("/payments").with(token(user, "payment.write"))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk());
    }

    // ---------- happy path and ownership ----------

    @Test
    void create_thenGet_returnsPaymentAndStoresOwner() throws Exception {
        mvc.perform(post("/payments").with(token("nithin", "payment.write"))
                        .contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.paymentId").value("P1"))
                .andExpect(jsonPath("$.status").value("SUCCESS"));

        assertThat(repository.findById("P1")).get().extracting("owner").isEqualTo("nithin");

        mvc.perform(get("/payments/P1").with(token("nithin", "payment.read")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.paymentId").value("P1"));
    }

    @Test
    void get_otherUsersPayment_is404NotForbidden() throws Exception {
        create("nithin", BODY);

        mvc.perform(get("/payments/P1").with(token("alice", "payment.read")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("PAYMENT_NOT_FOUND"));
    }

    @Test
    void list_returnsOnlyCallersPayments() throws Exception {
        create("nithin", BODY);
        create("alice", """
                {"paymentId":"P2","accountNumber":"acc-2","amount":5}""");

        mvc.perform(get("/payments").with(token("nithin", "payment.read")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].paymentId").value("P1"));
    }

    @Test
    void list_whenNone_returnsEmptyArray() throws Exception {
        mvc.perform(get("/payments").with(token("nithin", "payment.read")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    // ---------- error handling ----------

    @Test
    void create_duplicateId_is409() throws Exception {
        create("nithin", BODY);

        mvc.perform(post("/payments").with(token("alice", "payment.write"))
                        .contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("DUPLICATE_PAYMENT"));
    }

    @Test
    void create_negativeAmount_is400ValidationError() throws Exception {
        mvc.perform(post("/payments").with(token("nithin", "payment.write"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"paymentId":"P1","accountNumber":"acc-1","amount":-5}"""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("VALIDATION_ERROR"));
        assertThat(repository.count()).isZero();
    }

    @Test
    void create_missingFields_is400() throws Exception {
        mvc.perform(post("/payments").with(token("nithin", "payment.write"))
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("VALIDATION_ERROR"));
    }

    @Test
    void create_malformedJson_is400MalformedBody() throws Exception {
        mvc.perform(post("/payments").with(token("nithin", "payment.write"))
                        .contentType(MediaType.APPLICATION_JSON).content("{not json"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("MALFORMED_REQUEST_BODY"));
    }

    @Test
    void unmappedRoute_is404NotFound() throws Exception {
        mvc.perform(get("/nothing-here").with(token("nithin", "payment.read")))
                .andExpect(status().isNotFound());
    }

    // ---------- security ----------

    @Test
    void noToken_is401() throws Exception {
        mvc.perform(post("/payments").contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/payments")).andExpect(status().isUnauthorized());
    }

    @Test
    void readOnlyToken_cannotCreate_is403() throws Exception {
        mvc.perform(post("/payments").with(token("nithin", "payment.read"))
                        .contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isForbidden());
        assertThat(repository.count()).isZero();
    }

    @Test
    void writeOnlyToken_cannotRead_is403() throws Exception {
        mvc.perform(get("/payments").with(token("nithin", "payment.write")))
                .andExpect(status().isForbidden());
    }

    @Test
    void health_isPublic() throws Exception {
        mvc.perform(get("/actuator/health")).andExpect(status().isOk());
    }
}
