# How the project actually works

Every statement here was checked against the code and the running system on 2026-10-18. File names are given so you can verify any line yourself. Where something is **not** built, it says so.

## 1. What this project is, and what it is not

**It is** a small payment API whose main purpose is to practise layered security: OAuth2 login, signed JWT tokens that each service verifies, scopes, per-user ownership, service-to-service tokens, account lockout and an admin-only registration endpoint.

**It is not** a banking system. Nothing moves money:

- A payment has no receiver, no receiving account and no currency.
- There are no balances, no debit and no credit. The only payment table is `payments` (`payment_id`, `account_number`, `amount`, `owner`).
- The email does not go to a receiver. In dev every notification goes to one fixed address (`NOTIFICATION_RECIPIENT`).

A payment is simply a **record**: "user X created payment P for account A with amount N".

## 2. The four services

| Service | Port | Role | Data store |
|---|---|---|---|
| `payment-authorization-server` | 9000 | Logs users in, issues JWTs, registers users | MySQL `authdb` (table `users`) |
| `payment-service-a` | 8080 | Gateway: checks the token and forwards to B | none |
| `payment-service-b` | 8081 | Stores and reads payments, owns the ownership rule | MySQL `paymentdb` (table `payments`) |
| `NotificationService` | 8082 | Sends the "payment created" email over Gmail SMTP | none |

All four are Spring Boot 3.5.5, Java 17, one Maven parent (`pom.xml` lists the four modules).
Service A has a Maven dependency on Service B, only to reuse B's `PaymentNotFoundException` class (`payment-service-a/pom.xml`). It does not run B's code.

## 3. The big picture

```
 User / Postman
   |  1. log in (authorization code flow, with consent)
   v
 Auth server :9000  --- 2. access token (JWT, 5 min, scopes payment.read / payment.write)
   |
   |  3. POST /payments   Authorization: Bearer <token>
   v
 Service A :8080  -- checks the JWT, needs scope payment.write
   |  4. forwards the SAME token
   v
 Service B :8081  -- checks the JWT again; owner = token "sub"; saves a row in MySQL
   |  5. after the commit, in the background:
   |     asks the auth server for ITS OWN token (client_credentials, scope notification.send)
   v
 NotificationService :8082 -- checks that token, sends the email through Gmail
```

Every service checks the token itself. Service B never trusts that A already checked it.

## 4. Step by step

### 4.1 Log in and get a token
1. The user opens `/oauth2/authorize?...client_id=payment-client...` on the auth server (`SecurityConfig`).
2. Not logged in, so the browser is redirected to `/login`, a page written by `LoginPageController`.
3. The user submits the form. Spring checks the username and password against MySQL (`CustomUserDetailsService`, passwords stored as `{bcrypt}` hashes through `PasswordEncoderFactories.createDelegatingPasswordEncoder()`).
4. A consent page asks the user to approve the scopes (`requireAuthorizationConsent(true)`).
5. The browser is sent to `https://oauth.pstmn.io/v1/callback?code=...` (the only registered redirect URI).
6. The client exchanges the code at `POST /oauth2/token` for a JWT. The access token lives **5 minutes**.

The token is signed RS256. Services download the public keys from the auth server (`issuer-uri: http://localhost:9000`) and verify the signature themselves. The token's `sub` is the username.

### 4.2 Create a payment (`POST /payments` on A)
1. **Service A** (`SecurityConfig`): the token must be valid and carry scope `payment.write`, otherwise 401 (bad or missing token) or 403 (missing scope).
2. A forwards the request to B at `http://localhost:8081/payments` with the **same bearer token** (`ServletBearerExchangeFilterFunction`). Timeouts: 2 s to connect, 3 s for the answer. If B is down, A answers 503 `PAYMENT_SERVICE_UNAVAILABLE`.
3. **Service B** checks the token again (same scope rule).
4. B validates the body (`@NotBlank` payment id and account number, `@Positive` amount): invalid gives 400 `VALIDATION_ERROR`; broken JSON gives 400 `MALFORMED_REQUEST_BODY`.
5. If the payment id already exists B answers 409 `DUPLICATE_PAYMENT`. The id is the table's primary key, so it is unique across **all** users, not per user.
6. B saves the row with `owner` = the token's `sub` and publishes a `PaymentCreatedEvent`, all inside one transaction (`PaymentServiceImpl.create`).
7. B returns 200 with the payment id, a status (`SUCCESS`) and a message. The response does not echo the amount or the account.

### 4.3 Read payments (`GET /payments/{id}`, `GET /payments`)
- Needs scope `payment.read`.
- B looks the payment up and keeps it only if its owner equals the token's `sub`.
- Someone else's payment gives **404, never 403**, so a stranger cannot tell whether an id exists.
- The list endpoint returns only the caller's payments, or an empty list.
- Reads return the id, status and message, not the amount.
- `GET /payments/{id}` on B is **cached in Redis** (section 4.5).

### 4.4 The email
1. The `NotificationListener` in B waits for the **commit** (`AFTER_COMMIT`) and then runs **asynchronously** (`@Async`, enabled in `PaymentServiceAppliaction`). The caller never waits for the email.
2. B gets its own token from the auth server: grant `client_credentials`, client `payment-service-b`, scope `notification.send` (`NotificationClientConfig`). This token has no user in it.
3. B calls `POST /notifications` on the Notification Service with the payment id, owner, amount and status. B waits up to 45 s because Gmail can take 10 to 30 s.
4. The Notification Service accepts only scope `notification.send` and sends an HTML email (subject `Payment <id>: SUCCESS`).
5. **A failed email never fails the payment.** B logs a warning (`Payment <id> saved, but the notification could not be sent`), and the payment stays saved.

Recipient: if `NOTIFICATION_RECIPIENT` is set, every email goes there. If it is blank, the address is `<owner>@example.local`, which is not deliverable.

### 4.5 The payment cache (Redis)
Service B caches single-payment reads so repeat reads skip MySQL. Redis is a copy only; MySQL stays the source of truth.

- **What is cached:** the result of `PaymentServiceImpl.getPaymentById` (`@Cacheable`, cache name `payments`). Only successful reads are cached. A 404 throws, so it is never stored. The list endpoint `GET /payments` is **not** cached.
- **Key:** `payments-v1:payments::<owner>:<paymentId>`, for example `payments-v1:payments::tester1:PS-1792421899957`. The owner comes from the token's `sub` (read from `SecurityContextHolder` in the key expression), so one user can never be served another user's cached payment. Do not drop the owner from the key.
- **Value:** the `PaymentResponse` DTO as JSON (not the JPA entity). `PaymentResponse` needs its no-arg constructor so the JSON can be read back.
- **Expiry:** 10 minutes (`CacheConfig`, `spring.cache.redis.time-to-live`). The `-v1` prefix is there so a changed DTO can move to `-v2` without reading old JSON.
- **Redis down:** `CacheConfig` has a `CacheErrorHandler` that logs `Cache GET failed ...` and carries on, so the call goes to MySQL instead of returning 500. Connect and read timeouts are 500 ms (`spring.data.redis.*`), so a dead Redis costs about half a second per request.
- **Where:** `Config/CacheConfig.java`, the `@Cacheable` line in `PaymentServiceImpl`, the `spring.cache.*` and `spring.data.redis.*` properties in `application.properties`. Redis on Windows is Memurai (service `Memurai`, port 6379).
- **No eviction yet.** Service B has no update or delete endpoint, so nothing changes a stored payment. The day one is added it must get `@CacheEvict` with the same key, otherwise users read stale data for up to 10 minutes.
- **Calls inside the class skip the cache.** `@Cacheable` works through a Spring proxy, so calling `getPaymentById` from another method of `PaymentServiceImpl` bypasses it.

How to see it work: GET the same payment twice. The second call is much faster (measured 538 ms then 30 ms) and the log shows one `select`. `memurai-cli KEYS *` lists the key.

## 5. The auth server in detail

- **Two security filter chains** (`SecurityConfig`): chain 1 handles the OAuth2 endpoints; chain 2 handles everything else (login page, `/register`, actuator).
- **Registered clients** (held in memory):
  - `payment-client`: authorization code and refresh token grants, scopes `payment.read` and `payment.write`, consent required.
  - `payment-service-b`: client credentials grant, scope `notification.send`.
  - Both client secrets are stored as BCrypt hashes. The plain values come from `PAYMENT_CLIENT_SECRET` and `SERVICE_B_CLIENT_SECRET`.
- **Users** live in MySQL `authdb.users`: username (3 to 50 characters), email, BCrypt password hash, roles, enabled, `failed_attempts`, `locked_until`.
- **Registration** `POST /register` is **admin-only**:
  - No login: 401. A normal user: 403. An admin: 201.
  - Scripts call it with HTTP Basic auth as the admin. The body needs a username (3 to 50 characters), a password (8 to 72 characters) and a valid email.
  - New users always get role `USER`. A duplicate username gives 409.
  - `AdminSeeder` creates the first admin at startup from `ADMIN_USERNAME` (default `admin`), `ADMIN_PASSWORD` and `ADMIN_EMAIL`. It does nothing if `ADMIN_PASSWORD` is not set, and it never changes an existing user.
- **Lockout** (`LoginAttemptListener`): 5 wrong passwords in a row lock the account for **15 minutes** (stored in `locked_until`). A successful login resets the counter. A locked account is refused even with the right password. `LockoutAwareFailureHandler` swaps the generic message for "Try again in N seconds". This applies to the admin too, so anyone can lock the admin with 5 wrong passwords.
- **CSRF** stays on for the login form. Only `/register` is excluded, because scripts have no CSRF token.
- **Signing key**: with the `dev` profile (what `start-all.ps1` uses) a new RSA key is created on every start, so old tokens stop working after a restart. Without `dev`, the key comes from a keystore (`KEYSTORE_PATH`, `KEYSTORE_PASSWORD`).

## 6. Who may call what

| Call | Needs |
|---|---|
| `POST /payments` on A or B | valid token, scope `payment.write` |
| `GET /payments`, `GET /payments/{id}` on A or B | valid token, scope `payment.read`; only your own payments |
| `POST /notifications` | valid token, scope `notification.send` |
| `GET /actuator/health` on A and B | public; with a token it shows details such as the database |
| `GET /actuator/metrics`, `/actuator/mappings` | valid token (auth server: a login, admin Basic works) |
| `POST /register` | admin |
| Swagger UI on A | public page; its API calls still need a token |

## 7. Data

- **`authdb.users`** (MySQL): the users described above.
- **`paymentdb.payments`** (MySQL): `payment_id` (primary key), `account_number`, `amount`, `owner`. Created by Hibernate (`ddl-auto=update`). Service B moved here from an H2 file on 2026-10-18; old H2 rows were not copied.
- **Redis** (Memurai, `localhost:6379`): the payment-read cache described in section 4.5. Safe to wipe at any time (`FLUSHALL`); the next read refills it from MySQL.
- Service A and the Notification Service store nothing.
- The MySQL root password comes from `DB_PASSWORD` (user `DB_USER`, default `root`).

## 8. Observability

- **Trace id**: every log line carries `[traceId]`, the same across A, B and the Notification Service for one payment. Sampling is 100%.
- **`request.flow` lines** (an AOP aspect in each service) log entry, exit and timing of controllers and services, for example `createPayment (14 ms)`.
- **Hikari pools** (`auth-pool`, `payments-pool`): a connection held longer than 20 s is logged with a stack trace.
- **Slow SQL** (over 100 ms) goes to the `org.hibernate.SQL_SLOW` logger.
- **Actuator**: `health` and `metrics` (for example `hikaricp.connections.active`, `http.server.requests`).

## 9. Secrets and scripts

Secrets live in Windows user environment variables, never in git: `PAYMENT_CLIENT_SECRET`, `SERVICE_B_CLIENT_SECRET`, `ADMIN_PASSWORD`, `DB_PASSWORD`, and `H2_PASSWORD` (a leftover; Service B no longer uses H2). The Gmail sender and app password are typed at the `start-all.ps1` prompt, or kept in the git-ignored `NotificationService/.../application-local.yaml`.

| Script | Purpose |
|---|---|
| `scripts\start-all.ps1` / `stop-all.ps1` | Start or stop the four services |
| `scripts\test-all.ps1` | 27 end-to-end checks (login, security rules, ownership, errors, email) |
| `scripts\test-register.ps1` | Checks `/register` as admin; stops after one refused admin login |
| `scripts\trace-token.ps1` | Logs in, decodes the token, sends a payment, prints the cross-service timeline |
| `scripts\show-http.ps1`, `show-internals.ps1` | Raw HTTP and Spring Security internals for a request |
| `scripts\secrets.ps1` | Creates random secrets (dot-source it: `. .\scripts\secrets.ps1`) |

## 10. Tests (all green on 2026-10-18)

| Module | Tests | Notes |
|---|---|---|
| Auth server | 31 | users and BCrypt (10), `/register` rules (10), lockout (6), context (1), debug exercise C (4) |
| Service B | 30 | `PaymentApiIntegrationTest` (13) uses an in-memory H2 database |
| Service A | 23 | `PaymentControllerWebTest` (15) covers 401, 403, 200 and 404 |

Live: `test-all.ps1` gives 27 of 27 when Gmail accepts the app password.

## 11. What is not built, and known quirks

- No money movement, receiver, balances or transfers (see section 1).
- Redis is used only for the payment-read cache in B. Shared login sessions in Redis are not built. The cache has no eviction because nothing updates payments yet (section 4.5).
- Not yet proven: the Redis-down fallback (written to log and fall through to MySQL, but Memurai has not been stopped during a test) and the two-user isolation (the key contains the owner, but a different user has not yet been shown getting 404). There is no automated test for either.
- No audience check: a service accepts any valid token from this auth server that has the right scope.
- Registered clients are in memory, so they reset on every restart.
- Everything runs over plain HTTP on localhost, with no TLS.
- `payment-client` sets its token settings twice; the second call replaces the first, so the `reuseRefreshTokens(false)` setting is lost (only the 5-minute access token is kept; refresh tokens use Spring's defaults).
- Service B's `dev` profile still opens an H2 console chain, although B no longer uses H2.
- Old hard-coded secrets (`secret`, `b-secret`, `password`, `root`) remain in git history; treat them as exposed.
