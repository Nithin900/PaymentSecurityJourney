package org.example.Service;

import org.example.DTO.PaymentRequest;
import org.example.DTO.PaymentResponse;
import org.example.Entity.Payment;
import org.example.Exceptions.DuplicatePaymentException;
import org.example.Exceptions.InvalidPaymentException;
import org.example.Exceptions.PaymentNotFoundException;
import org.example.Notification.PaymentCreatedEvent;
import org.example.Repository.PaymentRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PaymentServiceImplTest {

    @Mock
    PaymentRepository repository;
    @Mock
    ApplicationEventPublisher events;

    PaymentServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new PaymentServiceImpl(repository, events);
        loginAs("nithin");
    }

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    private static void loginAs(String user) {
        SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken(user, "n/a"));
    }

    private static Payment payment(String id, String owner) {
        Payment p = new Payment();
        p.setId(id);
        p.setOwner(owner);
        p.setAccountNumber("acc-1");
        p.setAmount(new BigDecimal("10.00"));
        return p;
    }

    // ---------- create ----------

    @Test
    void create_savesPaymentOwnedByCaller() {
        when(repository.existsById("P1")).thenReturn(false);

        PaymentResponse response = service.create(new PaymentRequest("P1", "acc-1", new BigDecimal("25.50")));

        ArgumentCaptor<Payment> saved = ArgumentCaptor.forClass(Payment.class);
        verify(repository).save(saved.capture());
        assertThat(saved.getValue().getId()).isEqualTo("P1");
        assertThat(saved.getValue().getAccountNumber()).isEqualTo("acc-1");
        assertThat(saved.getValue().getAmount()).isEqualByComparingTo("25.50");
        assertThat(saved.getValue().getOwner()).isEqualTo("nithin");
        assertThat(response.getPaymentId()).isEqualTo("P1");
        assertThat(response.getStatus()).isEqualTo("SUCCESS");
    }

    @Test
    void create_publishesPaymentCreatedEvent() {
        service.create(new PaymentRequest("P1", "acc-1", new BigDecimal("25.50")));

        ArgumentCaptor<Object> event = ArgumentCaptor.forClass(Object.class);
        verify(events).publishEvent(event.capture());
        assertThat(event.getValue()).isEqualTo(new PaymentCreatedEvent("P1", "nithin", new BigDecimal("25.50")));
    }

    @Test
    void create_blankPaymentId_isRejected() {
        assertThatThrownBy(() -> service.create(new PaymentRequest("  ", "acc-1", BigDecimal.TEN)))
                .isInstanceOf(InvalidPaymentException.class)
                .hasMessage("Payment ID is required");
        verifyNoInteractions(repository, events);
    }

    @Test
    void create_nullPaymentId_isRejected() {
        assertThatThrownBy(() -> service.create(new PaymentRequest(null, "acc-1", BigDecimal.TEN)))
                .isInstanceOf(InvalidPaymentException.class);
    }

    @Test
    void create_blankAccountNumber_isRejected() {
        assertThatThrownBy(() -> service.create(new PaymentRequest("P1", "", BigDecimal.TEN)))
                .isInstanceOf(InvalidPaymentException.class)
                .hasMessage("Account number is required");
    }

    @Test
    void create_nullAmount_isRejected() {
        assertThatThrownBy(() -> service.create(new PaymentRequest("P1", "acc-1", null)))
                .isInstanceOf(InvalidPaymentException.class)
                .hasMessage("Payment amount must be greater than zero");
    }

    @Test
    void create_zeroAmount_isRejected() {
        assertThatThrownBy(() -> service.create(new PaymentRequest("P1", "acc-1", BigDecimal.ZERO)))
                .isInstanceOf(InvalidPaymentException.class);
    }

    @Test
    void create_negativeAmount_isRejected() {
        assertThatThrownBy(() -> service.create(new PaymentRequest("P1", "acc-1", new BigDecimal("-0.01"))))
                .isInstanceOf(InvalidPaymentException.class);
        verify(repository, never()).save(any());
    }

    @Test
    void create_duplicateId_isRejectedAndNothingIsSavedOrPublished() {
        when(repository.existsById("P1")).thenReturn(true);

        assertThatThrownBy(() -> service.create(new PaymentRequest("P1", "acc-1", BigDecimal.TEN)))
                .isInstanceOf(DuplicatePaymentException.class)
                .hasMessage("Payment ID already exists: P1");
        verify(repository, never()).save(any());
        verifyNoInteractions(events);
    }

    // ---------- getPaymentById ----------

    @Test
    void getPaymentById_returnsOwnPayment() {
        when(repository.findById("P1")).thenReturn(Optional.of(payment("P1", "nithin")));

        PaymentResponse response = service.getPaymentById("P1");

        assertThat(response.getPaymentId()).isEqualTo("P1");
        assertThat(response.getStatus()).isEqualTo("SUCCESS");
    }

    @Test
    void getPaymentById_otherUsersPayment_looksLikeNotFound() {
        when(repository.findById("P1")).thenReturn(Optional.of(payment("P1", "nithin")));
        loginAs("alice");

        assertThatThrownBy(() -> service.getPaymentById("P1"))
                .isInstanceOf(PaymentNotFoundException.class);
    }

    @Test
    void getPaymentById_missing_throwsNotFound() {
        when(repository.findById("nope")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getPaymentById("nope"))
                .isInstanceOf(PaymentNotFoundException.class)
                .hasMessage("Payment not found: nope");
    }

    // ---------- getAllPayments ----------

    @Test
    void getAllPayments_queriesOnlyCallersPayments() {
        when(repository.findByOwner("nithin")).thenReturn(List.of(payment("P1", "nithin"), payment("P2", "nithin")));

        List<PaymentResponse> responses = service.getAllPayments();

        assertThat(responses).extracting(PaymentResponse::getPaymentId).containsExactly("P1", "P2");
        verify(repository).findByOwner("nithin");
    }

    @Test
    void getAllPayments_none_returnsEmptyList() {
        when(repository.findByOwner("nithin")).thenReturn(List.of());

        assertThat(service.getAllPayments()).isEmpty();
    }
}
