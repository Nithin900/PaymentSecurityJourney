# Service B (:8081) — changes for settlement

I don't have your Service B source, so these are written against what I've seen in your Postman
requests (`paymentId`, `accountNumber`, `amount`, `status`). Match the names to your real classes.
Anything marked **ASSUMPTION** is a guess to check.

Order: 1 → 7. Service A needs **no changes**.

---

## 1. `PaymentStatus` enum — add `SETTLED`

**ASSUMPTION:** status is an enum. If your `status` is a `String`, skip this file and use the
text `"SUCCESS"` / `"SETTLED"` in steps 3–5 instead.

```java
public enum PaymentStatus {
    SUCCESS,
    // ... your other values (FAILED, PENDING ...) stay as they are
    SETTLED
}
```

---

## 2. `Payment` entity — add two fields

Add inside the class, next to your existing fields:

```java
import java.time.LocalDateTime;

// Who settled it: the token "sub" (e.g. "settlement-job"). Null until settled.
private String settledBy;

// When it was settled. Null until settled.
private LocalDateTime settledAt;

public String getSettledBy() { return settledBy; }
public void setSettledBy(String settledBy) { this.settledBy = settledBy; }

public LocalDateTime getSettledAt() { return settledAt; }
public void setSettledAt(LocalDateTime settledAt) { this.settledAt = settledAt; }
```

If you use Lombok `@Data` / `@Getter @Setter`, just add the two fields.
With H2 and `ddl-auto=update` (or `create`), the columns are created for you.

---

## 3. `PaymentRepository` — find by status

```java
import java.util.List;

List<Payment> findByStatus(PaymentStatus status);
```

**ASSUMPTION:** your entity's id is `paymentId` (a `String`), so the repository is
`JpaRepository<Payment, String>` and `findById(paymentId)` works. If the id is a `Long` and
`paymentId` is a separate column, add `Optional<Payment> findByPaymentId(String paymentId);`
and use it in step 4.

---

## 4. `PaymentService` / `PaymentServiceImpl` — two new methods

Interface:

```java
List<PaymentResponse> findByStatus(PaymentStatus status);

PaymentResponse settle(String paymentId, String settledBy);
```

Implementation:

```java
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.transaction.annotation.Transactional;

@Override
public List<PaymentResponse> findByStatus(PaymentStatus status) {
    return paymentRepository.findByStatus(status).stream()
            .map(this::toResponse)          // ASSUMPTION: use your existing entity → response mapping
            .toList();
}

/*
 * Rules:
 *   not found           → 404  (PaymentNotFoundException, you probably have one already)
 *   SUCCESS             → SETTLED, settledAt = now, settledBy = caller     → 200
 *   already SETTLED     → no change                                        → 200  (idempotent: safe to retry)
 *   any other status    → 409  (InvalidPaymentStateException, step 6)
 */
@Override
@Transactional
public PaymentResponse settle(String paymentId, String settledBy) {
    Payment payment = paymentRepository.findById(paymentId)
            .orElseThrow(() -> new PaymentNotFoundException(paymentId));

    if (payment.getStatus() == PaymentStatus.SETTLED) {
        return toResponse(payment);                       // idempotent
    }
    if (payment.getStatus() != PaymentStatus.SUCCESS) {
        throw new InvalidPaymentStateException(
                "Payment " + paymentId + " cannot be settled from status " + payment.getStatus());
    }

    payment.setStatus(PaymentStatus.SETTLED);
    payment.setSettledAt(LocalDateTime.now());
    payment.setSettledBy(settledBy);
    return toResponse(paymentRepository.save(payment));
}
```

---

## 5. `PaymentController` — status filter + settle endpoint

```java
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

// CHANGE your existing "get all" method so it accepts an optional filter:
//   GET /payments                 → all (as before)
//   GET /payments?status=SUCCESS  → only SUCCESS
@GetMapping
public List<PaymentResponse> getPayments(@RequestParam(required = false) PaymentStatus status) {
    return status == null
            ? paymentService.findAll()                 // ASSUMPTION: your existing method name
            : paymentService.findByStatus(status);
}

// NEW:  PATCH /payments/{paymentId}/settle
// Who called comes from the TOKEN (jwt "sub"), never from the request body.
//   settlement-job token → sub = "settlement-job"
@PatchMapping("/{paymentId}/settle")
public PaymentResponse settle(@PathVariable String paymentId,
                              @AuthenticationPrincipal Jwt jwt) {
    return paymentService.settle(paymentId, jwt.getSubject());
}
```

---

## 6. Exceptions — 409 for an invalid state

New class:

```java
public class InvalidPaymentStateException extends RuntimeException {
    public InvalidPaymentStateException(String message) {
        super(message);
    }
}
```

In your existing `@RestControllerAdvice`:

```java
@ExceptionHandler(InvalidPaymentStateException.class)
public ResponseEntity<Map<String, Object>> handleInvalidState(InvalidPaymentStateException ex) {
    return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
            "status", 409,
            "error", "Conflict",
            "message", ex.getMessage()));
}
```

---

## 7. `SecurityConfig` (Service B) — one new rule

Add the PATCH rule **above** your existing payment rules (first match wins):

```java
.authorizeHttpRequests(auth -> auth
        .requestMatchers("/actuator/health", "/error").permitAll()
        .requestMatchers("/h2-console/**").permitAll()                                     // local only
        .requestMatchers(HttpMethod.PATCH, "/payments/*/settle").hasAuthority("SCOPE_payment.settle")   // NEW
        .requestMatchers(HttpMethod.POST, "/payments/**").hasAuthority("SCOPE_payment.write")
        .requestMatchers(HttpMethod.GET,  "/payments/**").hasAuthority("SCOPE_payment.read")
        .anyRequest().authenticated())
```

`/payments/**` also matches plain `/payments`, so `GET /payments?status=SUCCESS` is covered by the
existing read rule. Everything else in your B `SecurityConfig` stays as it is.

---

## Result

| Caller | Token scopes | `GET /payments?status=SUCCESS` | `PATCH /payments/{id}/settle` | `POST /payments` |
|---|---|---|---|---|
| nithin (via Postman) | read, write | 200 | **403** | 201 |
| reporting-client | read | 200 | **403** | **403** |
| settlement-job | read, settle | 200 | 200 | **403** |
