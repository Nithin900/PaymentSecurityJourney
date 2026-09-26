# Epics 2–4: Service B, Service A, token relay — requirements

Service B and Service A become **OAuth2 Resource Servers**: they validate tokens, they never issue them.
Dependency (Boot 3.5): `spring-boot-starter-oauth2-resource-server`.

> Heads-up: adding the dependency locks every endpoint immediately. The existing A → B flow returns 401 until token relay (Epic 4) is in place.

---

## Service B (:8081)

### RS-1: Trust the Authorization Server
| ID | Requirement |
|---|---|
| FR-B1.1 | Service B **shall** include the OAuth2 **Resource Server** starter (Boot 3.5 name). |
| FR-B1.2 | Service B **shall** trust exactly one issuer, `http://localhost:9000`, set in configuration properties, not in Java code. |
| FR-B1.3 | Service B **shall** get the public key from the issuer's metadata and JWK set, never from a hard-coded key. |
| FR-B1.4 | Service B **shall not** contain any user passwords, client secrets, or private keys. |
| FR-B1.5 | Service B **shall** cache public keys and **shall not** call the Authorization Server on every request. |

### RS-2: Authenticate every request (validate the JWT)
| ID | Requirement |
|---|---|
| FR-B2.1 | Service B **shall** read the token only from the `Authorization: Bearer <token>` header. |
| FR-B2.2 | A request to a protected endpoint without a token **shall** get **401**. |
| FR-B2.3 | A token whose signature doesn't verify **shall** get **401**. |
| FR-B2.4 | A token whose `iss` isn't exactly `http://localhost:9000` **shall** get **401**. |
| FR-B2.5 | An expired token **shall** get **401**. |
| FR-B2.6 | Every 401 response **shall** include a `WWW-Authenticate: Bearer` header. |
| FR-B2.7 | A rejected request **shall not** reach the controller, service, or database. |

### RS-3: Authorize by scope
| ID | Requirement |
|---|---|
| FR-B3.1 | `POST /payments` **shall** require the scope `payment.write`. |
| FR-B3.2 | `GET /payments/**` **shall** require the scope `payment.read`. |
| FR-B3.3 | A valid token without the required scope **shall** get **403**. |
| FR-B3.4 | Scope rules **shall** live in one place (the security configuration), not in controllers. |

### RS-4: Open endpoints and deny by default
| ID | Requirement |
|---|---|
| FR-B4.1 | `/actuator/health` **shall** be reachable without a token (if Actuator is present). |
| FR-B4.2 | `/h2-console/**` **shall** be reachable without a token **in local development only**, and the console **shall** render in the browser. |
| FR-B4.3 | `/error` **shall** be reachable without a token, so real errors (400, 404, 409) aren't shown as 401. |
| FR-B4.4 | Every other endpoint **shall** require an authenticated request. |

### RS-5: Stateless API
| ID | Requirement |
|---|---|
| FR-B5.1 | Service B **shall not** create an HTTP session. |
| FR-B5.2 | Service B **shall not** show a login page or redirect (302); failures **shall** be 401 or 403 only. |
| FR-B5.3 | CSRF protection **shall** be disabled, with a code comment saying why (stateless, bearer tokens, no cookies). |

### RS-6 (stretch): Know who made the payment
| ID | Requirement |
|---|---|
| FR-B6.1 | The service layer **shall** read the user's name (`sub`) from the security context, not from the request body. |
| FR-B6.2 | Each saved payment **shall** record that name in a `createdBy` field. |

### Request flow inside B

```text
Request: POST /payments   Authorization: Bearer eyJ...
   ▼
FilterChainProxy → B's only SecurityFilterChain
   ▼
BearerTokenAuthenticationFilter
   │  header present? ── NO ──► anonymous ───────────────────────┐
   ▼                                                             │
JwtAuthenticationProvider                                        │
   │  JwtDecoder: signature ✓ (cached public key), iss ✓, exp ✓  │
   │  any ✗ ─────────────────────────────────────────► 401       │
   │  JwtAuthenticationConverter: scope → SCOPE_payment.write    │
   ▼                                                             │
SecurityContextHolder ← Authentication(nithin, [SCOPE_...])      │
   ▼                                                             │
AuthorizationFilter: POST needs SCOPE_payment.write              │
   │  anonymous? ────────────────────────────────────► 401 ◄─────┘
   │  scope missing? ────────────────────────────────► 403
   ▼
PaymentController → PaymentService → Repository → H2 → 201
```

---

## Service A (:8080)

A has the **same** RS-1, RS-2, RS-3 and RS-5 as B. Differences:

### RS-A4: Open endpoints
| ID | Requirement |
|---|---|
| FR-A4.1 | `/actuator/health` **shall** be reachable without a token (if Actuator is present). |
| FR-A4.2 | `/error` **shall** be reachable without a token. |
| FR-A4.3 | Service A **shall not** permit `/h2-console/**` (A has no database). |
| FR-A4.4 | Every other endpoint **shall** require an authenticated request. |

### RS-A7: Forward the token to B (token relay)
| ID | Requirement |
|---|---|
| FR-A7.1 | Every call from A to B **shall** carry the **same** JWT that A received, as `Authorization: Bearer <token>`. |
| FR-A7.2 | A **shall** read that token from the security context, not pass it by hand through controller and service methods. |
| FR-A7.3 | A **shall not** request a new token from the Authorization Server to call B. |
| FR-A7.4 | A **shall not** store tokens in a database, file, or log. |
| FR-A7.5 | The relay mechanism **shall** match A's web stack (servlet `ServletBearerExchangeFilterFunction` vs reactive `ServerBearerExchangeFilterFunction`). |

### RS-A8: Pass B's rejections back cleanly (Q18)
| ID | Requirement |
|---|---|
| FR-A8.1 | If B returns **401**, A **shall** return **401** to the client, not 500. |
| FR-A8.2 | If B returns **403**, A **shall** return **403** to the client, not 500. |
| FR-A8.3 | These responses **shall** carry a JSON body with `status`, `error` and a short `message`. |
| FR-A8.4 | These responses **shall not** reveal B's URL, port, class names, or stack traces. |
| FR-A8.5 | Existing error handling for other B responses (e.g. duplicate payment) **shall** keep working. |

---

## Acceptance criteria

| # | Service | Given / When | Expect |
|---|---|---|---|
| AC-1 | A and B | No token, `POST /payments` | 401 + `WWW-Authenticate: Bearer` |
| AC-2 | A and B | Valid token, both scopes, `POST` | Payment saved |
| AC-3 | A and B | Token with one character changed | 401 |
| AC-4 | A and B | Read-only token, `POST` | 403 |
| AC-5 | A and B | Read-only token, `GET` | 200 |
| AC-6 | A and B | Wait 6 minutes (5 min + 60 s clock skew) | 401 |
| AC-7 | A and B | Restart the Auth Server, reuse the token | 401 |
| AC-8 | A and B | Valid token + malformed body | 400, not 401 |
| AC-9 | A and B | `/actuator/health`, no token | 200 (or 404 without Actuator) |
| AC-10 | B | `/h2-console`, no token | Console loads |
| AC-11 | A | Valid token → A → B | B's log shows the same user and scopes |
| AC-12 | A | B requires a scope nobody has, call A | A returns 403, not 500 |
| AC-13 | A and B | Two requests | Public key fetched from :9000 only once |

**Why 6 minutes, not 5?** Spring allows 60 seconds of clock skew by default.

**Out of scope for now:** audience (`aud`) validation, method security (`@PreAuthorize`), custom JSON bodies for A's and B's own 401/403, refresh tokens.
