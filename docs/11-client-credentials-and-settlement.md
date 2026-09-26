# Client credentials + settlement job (26 Sep)

## Two designs discussed this week — know both

| Date / chat | Recommendation | Why |
|---|---|---|
| 25 Sep ("JWT validation and internal working") | A → B uses **client credentials** (`payment-service-a`, scopes `ledger.read`/`ledger.write`) instead of relay | B (ledger) should only accept writes from Service A, not from any user token |
| 26 Sep (this project) | **Keep token relay** for user actions; add client credentials for a **machine caller** (reporting-client, then settlement-job) | Keeps "which user paid" at B; learn client credentials without breaking the working flow |

Both are valid industry patterns. Interview line:
> "Use the user's token when a user is acting. Use client credentials when the application acts by itself."

## Step 1: minimal — reporting-client (no new feature)

| # | Decision |
|---|---|
| Q21 | Client `reporting-client` / `reporting-secret` |
| Q22 | `client_credentials` only |
| Q23 | Scope `payment.read` only |
| Q24 | Code change: one more `RegisteredClient` on the Auth Server; nothing else |

| ID | Requirement |
|---|---|
| FR-CC.1 | Auth Server **shall** register `reporting-client` alongside `payment-client`. |
| FR-CC.2 | It **shall** allow only the `client_credentials` grant. |
| FR-CC.3 | It **shall** authenticate with `client_secret_basic`. |
| FR-CC.4 | It **shall** allow only the scope `payment.read`. |
| FR-CC.5 | No redirect URI, no consent. |
| FR-CC.6 | Tokens expire after 5 minutes. |
| FR-CC.7 | `payment-client` keeps working. |

| # | Do | Expect | Learn |
|---|---|---|---|
| AC-1 | `POST :9000/oauth2/token`, Basic `reporting-client:reporting-secret`, body `grant_type=client_credentials&scope=payment.read` | 200 + access_token | Token without login |
| AC-2 | Decode | `sub = reporting-client` | Machine identity |
| AC-3 | `GET :8081/payments` with it | 200 | B doesn't care user vs machine |
| AC-4 | `POST :8081/payments` with it | 403 | Scope protection |
| AC-5 | Wrong secret | 401 `invalid_client` | App authentication |
| AC-6 | `scope=payment.write` | 400 `invalid_scope` | Only allowed scopes |
| AC-7 | `refresh_token` in response? | No | Machine just asks again |

**Always send `scope`:** in Spring Authorization Server, omitting it issues a token with no scopes → 403 everywhere.

| | Authorization Code | Client Credentials |
|---|---|---|
| Who acts | Person | Application |
| Login / consent | Yes | No |
| Calls | authorize + token | token only |
| `sub` | `nithin` | `reporting-client` |
| Refresh token | Possible | No (RFC 6749 §4.4.3: SHOULD NOT) |
| Use | User actions | Jobs, service-to-service |

### Inside the Auth Server for a client-credentials request
1. Chain ① matches `/oauth2/token`.
2. `OAuth2ClientAuthenticationFilter` reads the Basic header, finds the client, checks secret and auth method → else `401 invalid_client`.
3. `OAuth2TokenEndpointFilter` → `OAuth2ClientCredentialsAuthenticationProvider`: grant allowed? (`unauthorized_client`) scopes allowed? (`invalid_scope`)
4. `JwtGenerator` builds claims, signs with the RSA key, `kid` in header.
5. JSON response: no refresh token, no ID token.
`UserDetailsService`, `/login`, chain ② and `.oidc()` are never touched.

## Step 2: settlement job (realistic feature)

**Settlement** = at night, a program moves the money for the day's approved (SUCCESS) payments and marks them SETTLED. Nobody is logged in → client credentials.

### Changes
```text
① Auth Server        → register settlement-job (client_credentials, payment.read + payment.settle)
② Service B          → SETTLED status, settledAt/settledBy, GET ?status=, PATCH /payments/{id}/settle
③ settlement-job     → new small Spring Boot app (port 8082, all inbound denied)
```

### Service B
| Layer | Change |
|---|---|
| `PaymentStatus` | add `SETTLED` |
| `Payment` | add `settledAt`, `settledBy` |
| `PaymentRepository` | `findByStatus(status)` |
| `PaymentService` | `findByStatus`, `settle(paymentId, actor)` |
| `PaymentController` | `GET /payments?status=SUCCESS`, `PATCH /payments/{id}/settle` (actor = `jwt.getSubject()`) |
| `SecurityConfig` | `PATCH /payments/*/settle` → `SCOPE_payment.settle`, placed above other rules |

`settle()` rules: not found → 404 · SUCCESS → SETTLED (200) · already SETTLED → 200 no change (**idempotent**) · other → 409.

### settlement-job
| Class | Job |
|---|---|
| `application.yml` | registration `settlement-job`: client id/secret, `client_credentials`, scopes, `token-uri` |
| `OAuth2ClientConfig` | `AuthorizedClientServiceOAuth2AuthorizedClientManager` (no HTTP request in a scheduler) + `RestClient` with `OAuth2ClientHttpRequestInterceptor` |
| `SecurityConfig` | deny all inbound |
| `PaymentServiceBClient` | `getPaymentsByStatus`, `settle` |
| `SettlementScheduler` | `@Scheduled` every minute |

```text
Scheduler → RestClient+Manager → token cached? no → POST /oauth2/token → JWT (sub=settlement-job)
          → GET /payments?status=SUCCESS (payment.read ✓) → [p1, p2]
          → PATCH /payments/p1/settle (payment.settle ✓) → SETTLED, settledBy=settlement-job
```

| Failure | Job does |
|---|---|
| Auth Server down | log, retry next run |
| 401 | new token next run |
| 403 | config error, log ERROR, stop |
| one payment 404/409 | log, continue others |

| # | Check | Expect |
|---|---|---|
| AC-1 | After a run | SUCCESS → SETTLED, `settledBy = settlement-job` |
| AC-2 | Second run | no changes, no errors |
| AC-3 | nithin's token on `PATCH .../settle` | 403 |
| AC-4 | settlement-job token on `POST /payments` | 403 |
| AC-5 | Two runs within 5 min | one token call |
| AC-6 | Auth Server stopped | job logs error, doesn't crash |

Code: `code/auth-server/SecurityConfig-with-client-credentials.java`, `code/service-b/settlement-changes.md`, `code/settlement-job/` (not compiled here; expect small fixes).

## General client-credentials facts (RFC-based)

- Client must be **confidential**; only the **token endpoint** is used.
- Request: `POST`, form-encoded, `grant_type=client_credentials`, optional `scope`, client authentication (Basic recommended).
- Errors: `invalid_client` (401 with Basic), `unauthorized_client`, `invalid_scope`, `unsupported_grant_type`, `invalid_request` (400).
- Response: `access_token`, `token_type`, `expires_in`, `scope`; `Cache-Control: no-store`; no refresh token.
- API call: `Authorization: Bearer ...`; 401 `invalid_token`, 403 `insufficient_scope`.
- Client auth methods: `client_secret_basic`, `client_secret_post`, `client_secret_jwt`, `private_key_jwt`, mTLS (`tls_client_auth`). With `private_key_jwt` and mTLS the private key never leaves the client.

### Design questions for service-to-service OAuth
Direction · operations → scopes · sync vs async · network location · which IdP · HA of the auth server · client auth method · secret storage and rotation · one client per service per environment · JWT vs opaque · token TTL (5–15 min) · claims (`aud` = target service) · scope granularity · token caching and early refresh · concurrent refresh · retry once on 401 · local validation vs introspection · JWKS caching · compromise response · sender-constrained tokens (mTLS, DPoP) · logging (never the token) · audit · PCI DSS · naming scheme `<service>.<resource>.<action>`.

## Claude Code mentor prompt
See `15-claude-code-mentor-prompt.md`.
