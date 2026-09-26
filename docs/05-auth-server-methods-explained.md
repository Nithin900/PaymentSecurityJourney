# Authorization Server: every method explained

For Spring Boot 3.5 / Spring Authorization Server 1.5. The fully commented code is in
`code/auth-server/SecurityConfig-annotated.java`.

```text
SecurityConfig
├── ① authorizationServerSecurityFilterChain   (@Order 1)   → OAuth endpoints
├── ② defaultSecurityFilterChain               (@Order 2)   → login page
├── ③ userDetailsService                                    → the PERSON
├── ④ registeredClientRepository                            → the APPLICATION
├── ⑤ jwkSource  (+ generateRsaKey helper)                  → signing keys
├── ⑥ jwtDecoder                                            → server reads its own tokens
└── ⑦ authorizationServerSettings                           → issuer
```

## Class annotations

- **`@Configuration`**: "this class defines beans." Spring runs each `@Bean` method **once** at startup and keeps the result.
- **`@EnableWebSecurity`**: switches on Spring Security's web support and gives you the `HttpSecurity` builder.
- **`@Bean`**: "call this method at startup and register what it returns." You never call it yourself.

## ① authorizationServerSecurityFilterChain

- **`@Order(1)`**: "check this chain **first**." FilterChainProxy tries chains in order; first match wins.
- **`HttpSecurity http`**: a **builder**; nothing is active until `build()`.
- **(A) `OAuth2AuthorizationServerConfigurer.authorizationServer()`**: gets the configurer that adds the OAuth protocol **filters**. These filters answer the OAuth URLs themselves, no controllers:
  - `OAuth2AuthorizationEndpointFilter` → `/oauth2/authorize`
  - `OAuth2TokenEndpointFilter` → `/oauth2/token`
  - `NimbusJwkSetEndpointFilter` → `/oauth2/jwks`
  - metadata filter → `/.well-known/oauth-authorization-server`
- **(B) `getEndpointsMatcher()` + `http.securityMatcher(...)`**:
  - `getEndpointsMatcher()` asks the configurer: "which URLs do you own?"
  - `securityMatcher(...)` says: "this chain applies **only** to those URLs."
  - `/oauth2/jwks` → chain ①; `/login` → not matched → chain ②
- **(C) `http.with(configurer, c -> c.oidc(Customizer.withDefaults()))`**: plugs the configurer in and enables OpenID Connect (adds `/.well-known/openid-configuration`, `/userinfo`). `withDefaults()` = default settings.
- **(D) `authorizeHttpRequests(a -> a.anyRequest().authenticated())`**: every URL in this chain needs an authenticated caller — the **user** for `/oauth2/authorize`, the **client** (id + secret) for `/oauth2/token`.
- **(E) `exceptionHandling(... defaultAuthenticationEntryPointFor(new LoginUrlAuthenticationEntryPoint("/login"), new MediaTypeRequestMatcher(MediaType.TEXT_HTML)))`**: if not authenticated **and** the request wants HTML (a browser) → redirect to `/login`. API clients get 401.
- **(F) `http.build()`**: turns all of it into a real, ordered `SecurityFilterChain`: a chain that only handles the OAuth endpoints (B), uses OAuth protocol filters plus OIDC to answer them (A, C), lets through only authenticated callers (D), and redirects a not-yet-logged-in browser to `/login` (E).

**Old style you'll see in videos:** `OAuth2AuthorizationServerConfiguration.applyDefaultSecurity(http)` — deprecated since 1.4. **Boot 4 / Security 7 style:** `http.oauth2AuthorizationServer(...)` — doesn't exist in 1.5.

## ② defaultSecurityFilterChain

- **`@Order(2)`**: checked second, no `securityMatcher`, so it catches everything chain ① didn't.
- **`anyRequest().authenticated()`**: every other page needs login (`/login` itself stays open).
- **`formLogin(Customizer.withDefaults())`**: adds `UsernamePasswordAuthenticationFilter` + a generated login page. After login, sends the browser back to the page it wanted: `/oauth2/authorize?...`.

## ③ userDetailsService

- `User.withUsername("nithin")` → Spring's built-in `User` builder.
- `.password("{noop}password")` → `{noop}` = plain text (learning only); `{bcrypt}` in real systems. `DelegatingPasswordEncoder` reads the prefix.
- `.roles("USER")` → authority `ROLE_USER` (required, unused; our permissions are scopes).
- `new InMemoryUserDetailsManager(nithin)` → user store in memory. `DaoAuthenticationProvider` calls it during login.
- Videos use `User.withDefaultPasswordEncoder()` — deprecated, fine for learning.

## ④ registeredClientRepository

| Method | Meaning |
|---|---|
| `RegisteredClient.withId(UUID...)` | Internal record ID, **not** the client ID |
| `.clientId("payment-client")` / `.clientSecret("{noop}secret")` | The app's username and password |
| `.clientAuthenticationMethod(CLIENT_SECRET_BASIC)` | Client sends `Authorization: Basic base64(id:secret)` to `/oauth2/token` |
| `.authorizationGrantType(AUTHORIZATION_CODE)` | Only the login → code → token flow |
| `.redirectUri("https://oauth.pstmn.io/v1/callback")` | Code may only be sent here (exact match) |
| `.scope("payment.read")`, `.scope("payment.write")` | Permissions the client may ask for |
| `ClientSettings.requireAuthorizationConsent(true)` | Show the "Allow?" screen |
| `TokenSettings.accessTokenTimeToLive(Duration.ofMinutes(5))` | JWT lifetime → `exp = iat + 300` |
| `new InMemoryRegisteredClientRepository(client...)` | Client store in memory; can hold **several** clients |

Grant types: `AUTHORIZATION_CODE` (user apps), `REFRESH_TOKEN` (later), `CLIENT_CREDENTIALS` (machine-to-machine).
Client auth methods: `CLIENT_SECRET_BASIC`, `CLIENT_SECRET_POST`, `NONE` (public clients with PKCE).

## ⑤ jwkSource

```text
generateRsaKey()  → KeyPairGenerator.getInstance("RSA"), initialize(2048), generateKeyPair()
   ▼
new RSAKey.Builder(publicKey).privateKey(privateKey).keyID(UUID).build()   (Nimbus JWK format)
   ▼
new JWKSet(rsaKey)        → list of keys (several during rotation)
   ▼
new ImmutableJWKSet<>(…)  → read-only JWKSource
```

- Private key → signs every JWT at `/oauth2/token`, `kid` in the header.
- Public key only → published at `/oauth2/jwks`.
- **Gotcha:** `SecurityContext` here is `com.nimbusds.jose.proc.SecurityContext`, not Spring's.

## ⑥ jwtDecoder

`OAuth2AuthorizationServerConfiguration.jwtDecoder(jwkSource)` → reads JWTs sent **to** this server (OIDC `/userinfo`). Not what A/B use; they build their own from `issuer-uri`.

## ⑦ authorizationServerSettings

`AuthorizationServerSettings.builder().issuer("http://localhost:9000").build()` → written into every token's `iss` and the discovery document. Set explicitly so `localhost` vs `127.0.0.1` can't create two issuers.

## Cheat sheet

| Method / bean | One-line meaning | FR |
|---|---|---|
| `@Order(1)` + `getEndpointsMatcher` | this chain owns the OAuth URLs | AS-2, AS-5 |
| `.oidc(...)` | OpenID Connect + discovery | FR-2.2 |
| `LoginUrlAuthenticationEntryPoint` | browsers without login go to `/login` | FR-3.4 |
| `@Order(2)` + `.formLogin()` | the login page | FR-3.3, FR-3.5 |
| `InMemoryUserDetailsManager` | the person list | FR-3.1 |
| `RegisteredClient` | the application list entry | AS-4 |
| `CLIENT_SECRET_BASIC` | secret via Basic header | FR-4.3 |
| `AUTHORIZATION_CODE` | login + code flow | FR-4.4 |
| `redirectUri` | where the code goes | FR-4.5 |
| `requireAuthorizationConsent` | "Allow?" screen | FR-4.9 |
| `accessTokenTimeToLive` | JWT lifetime | FR-5.2 |
| `KeyPairGenerator` + `RSAKey` + `kid` | the signing stamp | AS-6 |
| `.issuer(...)` | the name A/B trust | FR-2.1 |
