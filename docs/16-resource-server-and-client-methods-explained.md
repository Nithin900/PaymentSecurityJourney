# Resource servers + settlement client: every method explained

Same treatment as `05-auth-server-methods-explained.md`, applied to the pieces that *consume* the JWT instead of issuing it: `payment-service-a`, `payment-service-b`, and the `settlement-job` client (`code/settlement-job/`).

```text
payment-service-a / SecurityConfig
payment-service-b / SecurityConfig
settlement-job     / SecurityConfig      → deny all inbound
settlement-job     / OAuth2ClientConfig  → gets its own token, attaches it outbound
```

## What changed on 28 Sep (old → new)

| Where | Before | Now |
|---|---|---|
| **B** `SecurityConfig` | `/h2-console/**` `permitAll` + `frameOptions(sameOrigin)` on the **main** chain, always | Removed from the main chain. A second chain `h2ConsoleSecurityFilterChain`, `@Profile("dev")` + `@Order(1)`, opens the console and allows framing **only in `dev`** |
| **B** `application.properties` | `spring.h2.console.enabled=true` | `enabled=false`; `application-dev.properties` turns it on |
| **B** `Payment` entity | `id`, `accountNumber`, `amount` | + `owner` (the JWT `sub` of the creator) |
| **B** `PaymentRepository` | `JpaRepository` only | + `findByOwner(String owner)` |
| **B** `PaymentServiceImpl` | `create` stored the payment; `getPaymentById` / `getAllPayments` returned anything | + `currentUser()`; `create` sets the owner and is `@Transactional`; reads are **filtered to the caller** |
| **B** `GlobalExceptionHandler` | no handler for a database duplicate-key error; not-found code was `PAYMENT_NOT_FOUND0` (typo) | + `DataIntegrityViolationException` → **409**; code fixed to `PAYMENT_NOT_FOUND` |
| **A** `WebClientConfig` | plain `WebClient.builder()` with no timeouts | Reactor Netty client: **2 s connect, 3 s response timeout**, wired in via `ReactorClientHttpConnector` |
| **A** `GlobalExceptionHandler` | 401/403 mapping + a catch-all that turned everything else into 500 | + pass-through of B's errors (`WebClientResponseException`), **503** when B is unreachable, and a handler that turns B's "not found" into **404** (it used to become a 500) |

## payment-service-a — `SecurityConfig.securityFilterChain`

```java
http
    .authorizeHttpRequests(auth -> auth
            .requestMatchers("/actuator/health").permitAll()
            .requestMatchers("/error").permitAll()
            .requestMatchers(HttpMethod.POST, "/payments/**").hasAuthority("SCOPE_payment.write")
            .requestMatchers(HttpMethod.GET, "/payments/**").hasAuthority("SCOPE_payment.read")
            .anyRequest().authenticated())
    .oauth2ResourceServer(oauth2 -> oauth2.jwt(Customizer.withDefaults()))
    .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
    .csrf(csrf -> csrf.disable());
```

- **`permitAll()` on `/actuator/health` and `/error`**: health checks and error pages must work even when the caller has no token — otherwise a load balancer probing `/actuator/health` would get 401 and mark the instance down.
- **`requestMatchers(HttpMethod.POST, "/payments/**").hasAuthority("SCOPE_payment.write")`**: rule order matters here — Spring Security evaluates `authorizeHttpRequests` rules top-to-bottom, first match wins. This specific POST rule must come *before* the catch-all `anyRequest().authenticated()`, or the generic rule would swallow it and any authenticated token (regardless of scope) would be allowed to POST.
- **`hasAuthority("SCOPE_payment.write")`**, not `hasAuthority("payment.write")`: when Spring's resource-server support converts a JWT into an `Authentication`, it prefixes each value in the `scope`/`scp` claim with `SCOPE_` by default (via `JwtGrantedAuthoritiesConverter`). Forgetting the prefix is the single most common reason a valid token still gets `403`.
- **`.oauth2ResourceServer(oauth2 -> oauth2.jwt(Customizer.withDefaults()))`**: this is the line that turns this app into a resource server. `withDefaults()` tells Spring Boot to build a `JwtDecoder` from `spring.security.oauth2.resourceserver.jwt.issuer-uri` (in `application.properties`) automatically — fetch `/oauth2/jwks` from that issuer at startup, cache the public key(s), verify signature + `exp` + `iss` on every incoming token. No code here does that fetching explicitly; it's all auto-configuration triggered by this one call plus the property.
- **`.sessionManagement(STATELESS)`**: tells Spring Security never to create or read an `HttpSession`. Every request must carry its own proof of identity (the JWT) — nothing is remembered between requests. This matters because without it, Spring Security's defaults still *permit* session use, which is wasteful and wrong for a token-based API.
- **`.csrf(csrf -> csrf.disable())`**: CSRF tokens protect session-cookie-authenticated browser forms from being submitted by a malicious third-party page. There's no session and no cookie carrying identity here — the attack CSRF defends against doesn't apply to a Bearer-token API — so leaving CSRF enabled would only block legitimate `POST`/`PATCH` calls for no security benefit.

**Runtime path for `POST /payments`**:
```text
Authorization: Bearer <jwt>
   → BearerTokenAuthenticationFilter extracts the token
   → JwtDecoder verifies signature (against cached JWKS) + exp + iss
   → JwtAuthenticationConverter builds Authentication with authorities like SCOPE_payment.write
   → AuthorizationFilter checks the POST /payments/** rule → has SCOPE_payment.write? → proceed
   → PaymentController
```

## payment-service-a — `WebClientConfig.webClient`

A never touches the database; it calls B. This bean builds the HTTP client for that call.

```java
HttpClient http = HttpClient.create()                              // reactor.netty.http.client
        .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, 2000)
        .responseTimeout(Duration.ofSeconds(3));
return builder()
        .baseUrl("http://localhost:8081")
        .clientConnector(new ReactorClientHttpConnector(http))
        .filter(new ServletBearerExchangeFilterFunction())
        .build();
```

- **`HttpClient.create()`** (Reactor Netty): the low-level client that does the real network work. It must be `reactor.netty.http.client.HttpClient`, **not** `java.net.http.HttpClient` — the JDK class has no `.create()`, `.option()` or `.responseTimeout()`.
- **`CONNECT_TIMEOUT_MILLIS = 2000`**: give up if the TCP connection to B isn't open within 2 s.
- **`responseTimeout(3 s)`**: give up if B doesn't answer within 3 s after the request is sent.
- **`.clientConnector(new ReactorClientHttpConnector(http))`**: this is what **plugs the configured client in**. Without this line the timeouts are built and thrown away: `HttpClient http` would just be an unused variable and `WebClient` would use Reactor Netty's defaults (no timeouts, so a hung B blocks A's request thread).
- **`.filter(new ServletBearerExchangeFilterFunction())`**: the token relay. On every outgoing call it reads the **current inbound request's** JWT from `SecurityContextHolder` and adds `Authorization: Bearer <same jwt>`. That's how B sees the real caller (`sub = nithin`) and can apply ownership. It works because A calls B with `.block()` on the same request thread.
- **`.baseUrl("http://localhost:8081")`**: so `PaymentServiceImpl` only writes `.uri("/payments")`.

**Watch out:** the method takes `WebClient.Builder builder` (the Spring Boot–provided builder, which carries Boot's instrumentation such as tracing), but the body calls **`builder()`**, which — with `import static ...WebClient.builder` — is the *static* `WebClient.builder()` that makes a **new** builder. The injected parameter is never used. It compiles and works, but to actually use the injected builder, write `return builder.baseUrl(...)...` (no parentheses) and drop the static import.

## payment-service-a — `GlobalExceptionHandler`

`@RestControllerAdvice` catches exceptions thrown anywhere in a controller call and turns them into JSON. When several handlers could match, Spring picks the **most specific exception type**, so the catch-all `Exception` handler only gets what nothing else claims.

| Situation | Exception A sees | Handler | A returns |
|---|---|---|---|
| B says the payment is missing or not yours | `PaymentServiceImpl.getPayment` catches `WebClientResponseException.NotFound` and throws B's `org.example.Exceptions.PaymentNotFoundException` | `notFound` | **404** `PAYMENT_NOT_FOUND` |
| B rejects the token | `WebClientResponseException.Unauthorized` | `handleDownstream401` | **401** "Access token is invalid or expired" |
| B says the scope is wrong | `WebClientResponseException.Forbidden` | `handleDownstream403` | **403** |
| B returns any other error (400 validation, 409 duplicate, …) | `WebClientResponseException` | `fromB` | **B's own status and JSON body**, passed through |
| B is down, refuses the connection, or hits a timeout | `WebClientRequestException` | `bDown` | **503** `PAYMENT_SERVICE_UNAVAILABLE` |
| Malformed JSON body in A | `HttpMessageNotReadableException` | `handleMalformedBody` | **400** `MALFORMED_REQUEST_BODY` |
| No such route | `NoResourceFoundException` | `handleNoResourceFound` | **404** `NOT_FOUND` |
| Anything unexpected | `Exception` | `handleGenericException` | **500** |

- **The bug that was fixed:** the `notFound` handler existed but was commented out. `PaymentNotFoundException` is a plain `RuntimeException` from B's module, so with no specific handler it fell into `handleGenericException` and came back as **500**. Alice asking for nithin's payment through A therefore returned 500 instead of 404. Re-enabling the handler fixed it.
- **Why a different class works:** A depends on B's module and reuses `org.example.Exceptions.PaymentNotFoundException`; the handler names it with its full package.
- **`WebClientRequestException` vs `WebClientResponseException`:** *Request* = the request never got a response (connection refused, connect or read timeout). *Response* = B answered with a 4xx/5xx. The first means "B unavailable" (503); the second means "B said no", so A passes B's answer on.

## payment-service-b — `SecurityConfig.securityFilterChain`

The **main chain** is now identical to service-a's (health/error open, scope rules, `oauth2ResourceServer`, `STATELESS`, `csrf().disable()`). The H2 console rules moved out of it into a **second, dev-only chain**:

```java
@Bean
@Profile("dev")
@Order(1)
public SecurityFilterChain h2ConsoleSecurityFilterChain(HttpSecurity http) throws Exception {
    http
        .securityMatcher(PathRequest.toH2Console())
        .authorizeHttpRequests(auth -> auth.anyRequest().permitAll())
        .csrf(csrf -> csrf.disable())
        .headers(h -> h.frameOptions(f -> f.sameOrigin()));
    return http.build();
}
```

- **`@Profile("dev")`**: the bean exists only when the `dev` profile is active. In any other profile the chain isn't registered, so `/h2-console` is protected by the main chain (401) and the console is switched off anyway.
- **`@Order(1)`**: this chain is asked first. `securityMatcher(...)` means it handles **only** the console's URLs, and everything else falls through to the main chain.
- **`PathRequest.toH2Console()`**: Spring Boot's matcher for the console's path (from `spring.h2.console.path`, default `/h2-console`). Safer than a hand-typed `"/h2-console/**"` string, which Spring Security 6 can reject as ambiguous when the console is a separate servlet.
- **`permitAll()`**: the H2 web console is a dev tool with its own login (JDBC URL, user `sa`, password) and no idea what an OAuth2 bearer token is, so it can't sit behind the JWT requirement.
- **`frameOptions(sameOrigin())`**: Spring Security's default `X-Frame-Options: DENY` stops a page being shown inside an `<iframe>`, which is exactly how the console draws its query page. `sameOrigin()` relaxes it to "same app only". The relaxation now applies only to the console chain, not to the whole API, which is stricter than before.
- The switch itself is in the properties: `spring.h2.console.enabled=false` in `application.properties`, `true` in `application-dev.properties`. (Before, both values sat in one file and the last one won, so the console was always on.)

### B — ownership (`PaymentServiceImpl`, `Payment`, `PaymentRepository`)

The scope rules decide **whether you may call** an endpoint. Ownership decides **which payments you may see**. It lives in B because B holds the data.

```java
private String currentUser() {
    return SecurityContextHolder.getContext().getAuthentication().getName();   // JWT "sub"
}
```

- **`currentUser()`**: reads the authenticated caller from the security context that the JWT filter filled in. For a JWT authentication, `getName()` is the token's `sub` claim — the username (`nithin`, `alice`). B trusts its own validation of the token, not anything A tells it.

| Method | Now |
|---|---|
| `create` (`@Transactional`) | validates, checks duplicates, then `paymentEntity.setOwner(currentUser())` before `save` |
| `getPaymentById` | `findById(id).filter(x -> currentUser().equals(x.getOwner())).orElseThrow(PaymentNotFoundException)` |
| `getAllPayments` | `paymentRepository.findByOwner(currentUser())` instead of `findAll()` |

- **`.filter(...).orElseThrow(...)`**: a payment that exists but belongs to someone else is treated exactly like a missing one — **404, not 403**. A 403 would confirm the ID exists, which leaks information.
- **`findByOwner(String owner)`**: Spring Data derives `WHERE owner = ?` from the method name; no query is written.
- **`@Transactional` on `create`**: the duplicate check and the save now run in one transaction.
- **Existing rows** saved before this change have `owner = NULL`; they match nobody, so nobody can read them (see README "Known limits").
- **Client-credentials tokens** have `sub = <client id>`, so a payment created by `settlement-job` would be owned by that client, not by a person.

### B — new error handler (`GlobalExceptionHandler`)

- **`@ExceptionHandler(DataIntegrityViolationException.class)` → 409 `DUPLICATE_PAYMENT`**: if two requests create the same ID at once, both pass the `existsById` check and the database rejects the second on its primary key. Without this handler that becomes a 500.
- **Typo fix:** the not-found error code was `PAYMENT_NOT_FOUND0`; it is now `PAYMENT_NOT_FOUND`.

**Known gap** (tracked in `11-client-credentials-and-settlement.md`): there's no `requestMatchers(HttpMethod.PATCH, "/payments/*/settle").hasAuthority("SCOPE_payment.settle")` rule yet — the settle endpoint and its scope check are still to be added alongside the `settlement-job` client registration.

## settlement-job — `SecurityConfig.securityFilterChain`

```java
http
    .authorizeHttpRequests(auth -> auth.anyRequest().denyAll())
    .csrf(csrf -> csrf.disable());
```

- This app never receives inbound HTTP requests on purpose — it's a `@Scheduled` job that only calls *out* to Service B. `denyAll()` on every path means even if something did reach it (a stray health check, a misdirected request), it gets rejected rather than silently 200'ing through Spring Security's permissive defaults.
- The comment in the file explains the other reason this bean exists: declaring your own `SecurityFilterChain` stops Spring Boot's auto-configuration from adding a default `oauth2Login` chain (which Boot would otherwise add because an OAuth2 *client* registration — see below — is on the classpath, and Boot assumes a client registration might mean "log a browser user in with this provider"). Without this bean, hitting `/` in a browser could unexpectedly try to start a login redirect.

## settlement-job — `OAuth2ClientConfig`

This is the piece that makes settlement-job an OAuth2 **client** (not a resource server) — it *asks for* tokens rather than validating ones it receives.

```java
@Bean
public OAuth2AuthorizedClientService authorizedClientService(ClientRegistrationRepository registrations) {
    return new InMemoryOAuth2AuthorizedClientService(registrations);
}

@Bean
public OAuth2AuthorizedClientManager authorizedClientManager(ClientRegistrationRepository registrations,
                                                             OAuth2AuthorizedClientService clientService) {
    OAuth2AuthorizedClientProvider provider = OAuth2AuthorizedClientProviderBuilder.builder()
            .clientCredentials()
            .build();
    AuthorizedClientServiceOAuth2AuthorizedClientManager manager =
            new AuthorizedClientServiceOAuth2AuthorizedClientManager(registrations, clientService);
    manager.setAuthorizedClientProvider(provider);
    return manager;
}

@Bean
public RestClient serviceBRestClient(RestClient.Builder builder,
                                     OAuth2AuthorizedClientManager authorizedClientManager,
                                     @Value("${settlement.service-b-url}") String serviceBUrl) {
    OAuth2ClientHttpRequestInterceptor oauth2 = new OAuth2ClientHttpRequestInterceptor(authorizedClientManager);
    oauth2.setClientRegistrationIdResolver(request -> REGISTRATION_ID);
    return builder.baseUrl(serviceBUrl).requestInterceptor(oauth2).build();
}
```

- **`ClientRegistrationRepository`**: not defined here — Spring Boot builds it automatically from `application.yml`'s `spring.security.oauth2.client.registration.settlement-job` block (client id/secret, grant type, scopes, token-uri). This bean file only *uses* that repository; it doesn't define the credentials.
- **`OAuth2AuthorizedClientService`**: caches the token this app has already obtained, keyed by registration id + principal, so it isn't re-fetched on every call. `InMemoryOAuth2AuthorizedClientService` — fine here since there's only one logical "user" (the app itself) and losing the cache on restart just means one extra token call.
- **Why `AuthorizedClientServiceOAuth2AuthorizedClientManager` and not the more commonly-shown `DefaultOAuth2AuthorizedClientManager`**: the default manager is designed to hang the authorized client off an incoming `HttpServletRequest`/`HttpServletResponse` (e.g. to save it back into a session after a redirect). A `@Scheduled` job has no incoming request at all — there's nothing to hang it off — so it needs the request-independent variant instead. Using the wrong manager here is a common Boot 3.5 pitfall (it either fails to compile against the expected method signature, or throws at runtime because it expects a request context that doesn't exist).
- **`.clientCredentials()` on the provider builder**: restricts this manager to only ever perform the client-credentials flow — no authorization-code, no refresh-token dance, because this app never has a logged-in user to redirect.
- **`OAuth2ClientHttpRequestInterceptor` + `setClientRegistrationIdResolver`**: this is what actually attaches `Authorization: Bearer <jwt>` to every outgoing request made through `serviceBRestClient`. The resolver just says "always use the `settlement-job` registration for this client" (there's only one, so it's a constant lambda, not a per-request lookup).

**Runtime path for a scheduled run**:
```text
SettlementScheduler (@Scheduled) → serviceBRestClient.get()/patch()
   → OAuth2ClientHttpRequestInterceptor: "which registration?" → settlement-job
   → AuthorizedClientManager: cached token, not expired? → reuse
                               expired / none?          → POST :9000/oauth2/token
                                                            (Basic settlement-job:settlement-secret,
                                                             grant_type=client_credentials)
   → Authorization: Bearer <jwt> attached
   → request sent to Service B
```

Note this flow depends on `settlement-job` actually being registered as a client on the authorization server (see the gap noted in `05-auth-server-methods-explained.md` ④ and in `11-client-credentials-and-settlement.md`) — right now this config is correct but will get `invalid_client` back from `/oauth2/token` until that registration exists.

## Cheat sheet

| Method / bean | One-line meaning | Where |
|---|---|---|
| `permitAll()` on health/error | probes work without a token | A, B |
| rule order top-to-bottom, first match wins | specific scope rules before the generic `authenticated()` catch-all | A, B |
| `SCOPE_` prefix on authorities | `JwtGrantedAuthoritiesConverter` default; most common cause of an unexpected 403 | A, B |
| `oauth2ResourceServer(...).jwt(...)` | builds a `JwtDecoder` from `issuer-uri`, fetches JWKS, verifies sig/exp/iss | A, B |
| `sessionManagement(STATELESS)` | no session; every request re-proves identity via the JWT | A, B |
| `csrf().disable()` | CSRF defends session-cookie auth; irrelevant to a Bearer-token API | A, B |
| `@Profile("dev")` + `@Order(1)` chain with `PathRequest.toH2Console()` | let the dev-only DB console load and render in an iframe; absent in other profiles | B only |
| `currentUser()` (`SecurityContextHolder…getName()`) | the JWT `sub`, i.e. who is calling | B |
| `.filter(x -> currentUser().equals(x.getOwner()))` | someone else's payment is a 404, not a 403 | B |
| `findByOwner(currentUser())` | list only the caller's own payments | B |
| `DataIntegrityViolationException` → 409 | two simultaneous creates of one ID → duplicate, not a 500 | B |
| `HttpClient.create()` + `ReactorClientHttpConnector` | the 2 s / 3 s timeouts; without the connector they're ignored | A |
| `ServletBearerExchangeFilterFunction` | copy the caller's bearer token onto the call to B | A |
| `notFound` / `fromB` / `bDown` handlers | 404, B's status passed through, 503 when B is unreachable | A |
| `anyRequest().denyAll()` | this app takes no inbound traffic by design | settlement-job |
| `AuthorizedClientServiceOAuth2AuthorizedClientManager` | client-credentials manager usable with no HTTP request (a `@Scheduled` job) | settlement-job |
| `OAuth2ClientHttpRequestInterceptor` | attaches `Authorization: Bearer` to every outgoing `RestClient` call | settlement-job |
