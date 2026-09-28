# Authorization Server: every method explained

For Spring Boot 3.5 / Spring Authorization Server 1.5. The fully commented code is in
`code/auth-server/SecurityConfig-annotated.java`.

```text
SecurityConfig
├── ① authorizationServerSecurityFilterChain   (@Order 1)   → OAuth endpoints
├── ② defaultSecurityFilterChain               (@Order 2)   → login page
├── ③ userDetailsService                                    → the PEOPLE (nithin, alice)
├── ④ registeredClientRepository                            → the APPLICATION
├── ⑤ signing key: ONE of two beans, chosen by profile      → signing keys
│      ├── devJwkSource  (+ generateRsaKey helper)  @Profile("dev")   in-memory key
│      └── jwkSource                                @Profile("!dev")  keystore file
├── ⑥ jwtDecoder                                            → server reads its own tokens
└── ⑦ authorizationServerSettings                           → issuer
```

## What changed on 28 Sep (old → new)

| Area | Before | Now | Why |
|---|---|---|---|
| Users (③) | `nithin` only | `nithin` **and `alice`** in `InMemoryUserDetailsManager(nithin, alice)` | Ownership tests need two different `sub` values |
| Signing key (⑤) | One bean `jwkSource()` that always generated an RSA key in memory | **Two beans, one per profile:** `devJwkSource()` (`@Profile("dev")`, same generated key) and `jwkSource(@Value KEYSTORE_PATH, @Value KEYSTORE_PASSWORD)` (`@Profile("!dev")`, key read from a PKCS12 file) | Tokens survive restarts outside dev, and the private key stays out of the repo |
| New imports | – | `@Value`, `@Profile`, `org.springframework.core.io.Resource`, `java.io.InputStream`, `java.security.KeyStore` | Needed by the keystore bean |
| Unchanged | – | `jwtDecoder(JWKSource)`, `authorizationServerSettings`, both filter chains, `registeredClientRepository` (still 5-minute tokens) | `jwtDecoder` takes the `JWKSource` **by type**, so it works with either signing bean |

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

## FAQ: `.anyRequest().authenticated()` looks contradictory — how can it work on a request that *isn't* authenticated yet?

`authorizeHttpRequests(a -> a.anyRequest().authenticated())` doesn't run at request time — it runs **once at startup**, while the chain is being built. All it does is register a rule: *"before `AuthorizationFilter` lets any request through this chain, it must find an authenticated principal in `SecurityContextHolder`. If it doesn't, don't let it through."* The rule and its enforcement happen at two different times:

```text
GET /oauth2/authorize (first time, nobody logged in)
   → OAuth2AuthorizationEndpointFilter (client_id / scopes valid?)
   → AuthorizationFilter: any Authentication in SecurityContext?  NO
   → ExceptionTranslationFilter catches it
   → wants text/html? → LoginUrlAuthenticationEntryPoint → 302 /login
   → (chain ② logs the user in, session now holds an Authentication)
   → browser redirected back to the original /oauth2/authorize URL
   → AuthorizationFilter: any Authentication now?  YES → request proceeds
```

So it's not "declaring authenticated() on an unauthenticated request" — it's declaring a *requirement*, and the framework decides what to do (redirect to `/login`) when that requirement isn't met yet.

**Related confusion: this is the "Authorization Server," so why does it do login at all?** In OAuth2/OIDC there's no separate "Authentication Server" — authenticating the caller (the user via `/login`, or the client via its secret) is just step one of the Authorization Server's job, because it can't decide what to authorize until it knows *who* it's authorizing. OIDC (`authorizationServer.oidc(...)`) exists specifically to standardize how that user-authentication step is exposed (ID tokens, `/userinfo`) — reinforcing that authentication is part of an Authorization Server's responsibility, not a contradiction of the name.

## ③ userDetailsService — "the person"

- `User.withUsername("nithin")` → Spring's built-in `User` builder.
- `.password("{noop}password")` → `{noop}` = plain text (learning only); `{bcrypt}` in real systems. `DelegatingPasswordEncoder` reads the prefix.
- `.roles("USER")` → authority `ROLE_USER` (required, unused; our permissions are scopes).
- `new InMemoryUserDetailsManager(nithin)` → user store in memory. `DaoAuthenticationProvider` calls it during login, via `loadUserByUsername("nithin")` then a password comparison.
- Videos use `User.withDefaultPasswordEncoder()` — deprecated (bcrypt-hashes at bean creation and warns on startup), fine for learning.
- Don't confuse this with ④: `userDetailsService` stores **people** who log in through the browser; `registeredClientRepository` stores **applications** that ask for tokens on a person's behalf (or, for client credentials, on their own behalf). `nithin` and `payment-client` are never the same kind of thing.
- **Two users now:** `nithin` and `alice` (both `password`, role `USER`), passed to `new InMemoryUserDetailsManager(nithin, alice)`. `alice` exists only so the ownership tests have a second person: a payment created with nithin's token has `sub = nithin`, and alice's token (`sub = alice`) must get a 404 for it. The JWT `sub` claim is the username, which is what service B stores as the payment's `owner`.
- In memory, rebuilt identically on every restart — no persistence, no self-registration, no password reset. A real deployment swaps this for a JPA-backed `UserDetailsService` reading from a database.

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

**Current gap:** only `payment-client` is registered in the *live* `SecurityConfig.java`. `reporting-client` and `settlement-job` exist only in the reference file `code/auth-server/SecurityConfig-with-client-credentials.java`. Until they're added to the real repository, `settlement-job`'s `client_credentials` request to `/oauth2/token` fails with `invalid_client` — see `11-client-credentials-and-settlement.md`.

## ⑤ The signing key: two beans, one active per profile

Both beans return a `JWKSource<SecurityContext>` — the thing Spring Authorization Server signs tokens with and publishes at `/oauth2/jwks`. Only one of them exists at runtime:

```text
run with profile "dev"          → devJwkSource()   (in-memory key, no files, no env vars)
run with any other / no profile → jwkSource(...)   (key read from a PKCS12 keystore file)
```

### 5a. `devJwkSource()` — `@Profile("dev")`

```text
generateRsaKey()  → KeyPairGenerator.getInstance("RSA"), initialize(2048), generateKeyPair()
   ▼
new RSAKey.Builder(publicKey).privateKey(privateKey).keyID(UUID).build()   (Nimbus JWK format)
   ▼
new JWKSet(rsaKey)        → list of keys (several during rotation)
   ▼
new ImmutableJWKSet<>(…)  → read-only JWKSource
```

- Same code as the old `jwkSource()`; only the bean name (`devJwkSource`) and `@Profile("dev")` are new.
- **`@Profile("dev")`**: "register this bean only when the `dev` profile is active." Activate with `-Dspring-boot.run.profiles=dev` or `SPRING_PROFILES_ACTIVE=dev`.
- **Why a new name:** two `@Bean` methods with the same name would collide (`BeanDefinitionOverrideException`; Spring Boot forbids overriding). Different names are safe because the profiles are mutually exclusive and everything else injects by **type**.

### 5b. `jwkSource(...)` — `@Profile("!dev")`

```text
@Value("${KEYSTORE_PATH}")     Resource file   → e.g. file:C:/keys/securepay.p12
@Value("${KEYSTORE_PASSWORD}") String pw
   ▼
KeyStore.getInstance("PKCS12")                 → an empty keystore object
   ▼
try (InputStream in = file.getInputStream()) { ks.load(in, pw.toCharArray()); }   → read the file, unlock it
   ▼
RSAKey.load(ks, "securepay", pw.toCharArray()) → pull out the key pair stored under the alias "securepay"
   ▼
new RSAKey.Builder(thatKey).keyID("securepay-1").build()   → copy it, with a FIXED kid
   ▼
new ImmutableJWKSet<>(new JWKSet(key))
```

- **`@Profile("!dev")`**: "register this bean whenever `dev` is **not** active."
- **`@Value("${KEYSTORE_PATH}") Resource file`**: Spring reads the property (an environment variable works) and converts the string to a `Resource`. The `file:` prefix is required — a bare `C:\...` path is not read as a file. **No default is given, so the app refuses to start** without it: `Could not resolve placeholder 'KEYSTORE_PATH'`.
- **`@Value("${KEYSTORE_PASSWORD}") String pw`**: unlocks the store and the key (this setup uses the same password for both).
- **`KeyStore.getInstance("PKCS12")`**: the standard password-protected key container (`.p12`).
- **try-with-resources**: opens the file as an `InputStream`, loads it, and closes it automatically.
- **`RSAKey.load(ks, "securepay", pw)`**: reads the entry stored under that **alias**. If the keystore has a different alias the load fails.
- **`.keyID("securepay-1")`**: a **stable** `kid`. The dev bean uses a random UUID, so its `kid` changes every start; here it never changes.
- **`throws Exception`**: `load` throws checked exceptions (`IOException`, `KeyStoreException`, `NoSuchAlgorithmException`, `CertificateException`, `JOSEException`).
- Create a local keystore with: `keytool -genkeypair -alias securepay -keyalg RSA -keysize 2048 -storetype PKCS12 -keystore securepay.p12 -storepass changeit -keypass changeit -dname "CN=securepay" -validity 365`

### What both do the same

- Private key → signs every JWT at `/oauth2/token`, `kid` in the header.
- Public key only → published at `/oauth2/jwks` (the private half is stripped automatically during JWK serialization — it never leaves the server). Service A/B fetch this at their own startup, keyed by `kid`, to verify signatures.
- **Gotcha:** `SecurityContext` here is `com.nimbusds.jose.proc.SecurityContext`, not Spring's.

### Gotchas that bite during testing

- **`dev`: tokens die on restart.** The key pair is generated fresh on every app start and lives only in memory. Restart the auth server → new key pair → every JWT issued before the restart becomes unverifiable (signature won't match), even though nothing about the token's claims changed. Get a fresh token after every auth-server restart (the automated Postman collections do this by script).
- **Keystore profile: tokens survive restarts**, because the same key is loaded each time. That is the reason for the second bean. Production would still rotate deliberately (keeping the old public key around briefly) or use a KMS-backed key.
- **Wrong profile = startup failure.** Starting **without** `dev` and without the two environment variables fails with the `KEYSTORE_PATH` placeholder error. That's the usual first-run mistake; use the `dev` profile locally.
- **`jwtDecoder` needs no change:** it receives whichever `JWKSource` exists, by type.

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
| `KeyPairGenerator` + `RSAKey` + `kid` | the signing stamp (dev: made in memory) | AS-6 |
| `@Profile("dev")` / `@Profile("!dev")` | pick which signing-key bean exists | AS-6 |
| `KeyStore` + `RSAKey.load(ks, "securepay", pw)` | read the signing key from a `.p12` file | AS-6 |
| `@Value("${KEYSTORE_PATH}")` | inject the keystore location from the environment | AS-6 |
| `InMemoryUserDetailsManager(nithin, alice)` | two people, so ownership can be tested | FR-3.1 |
| `.issuer(...)` | the name A/B trust | FR-2.1 |
