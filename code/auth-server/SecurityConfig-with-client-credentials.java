package com.example.paymentauthorizationserver.config;   // adjust to your package

import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.source.ImmutableJWKSet;
import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.proc.SecurityContext;          // Nimbus SecurityContext, NOT Spring's!
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.http.MediaType;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.server.authorization.client.InMemoryRegisteredClientRepository;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClientRepository;
import org.springframework.security.oauth2.server.authorization.config.annotation.web.configuration.OAuth2AuthorizationServerConfiguration;
import org.springframework.security.oauth2.server.authorization.config.annotation.web.configurers.OAuth2AuthorizationServerConfigurer;
import org.springframework.security.oauth2.server.authorization.settings.AuthorizationServerSettings;
import org.springframework.security.oauth2.server.authorization.settings.ClientSettings;
import org.springframework.security.oauth2.server.authorization.settings.TokenSettings;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.LoginUrlAuthenticationEntryPoint;
import org.springframework.security.web.util.matcher.MediaTypeRequestMatcher;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.time.Duration;
import java.util.UUID;

/*
 * ============================================================================================
 *  SecurityConfig: Authorization Server (:9000)
 *  Version: Spring Boot 3.5.x / Spring Authorization Server 1.5.x
 * ============================================================================================
 *
 *  WHAT THIS CLASS DOES
 *  --------------------
 *  It does NOT handle requests itself. At STARTUP, Spring calls every @Bean method once and
 *  keeps the returned objects. At RUNTIME, Spring's filters use those objects.
 *
 *     STARTUP (once)                                   RUNTIME (every request)
 *     ──────────────                                   ───────────────────────
 *     ① authorizationServerSecurityFilterChain ──────► handles /oauth2/**, /.well-known/**
 *     ② defaultSecurityFilterChain           ────────► handles /login and everything else
 *     ③ userDetailsService                   ────────► "does user nithin exist? password ok?"
 *     ④ registeredClientRepository           ────────► "does payment-client exist? secret ok?"
 *     ⑤ jwkSource                            ────────► private key signs JWT, public key published
 *     ⑥ jwtDecoder                           ────────► reads JWTs sent TO this server (/userinfo)
 *     ⑦ authorizationServerSettings          ────────► issuer name + endpoint paths
 *
 *
 *  HOW A REQUEST PICKS A CHAIN
 *  ---------------------------
 *
 *     HTTP request
 *          │
 *          ▼
 *     DelegatingFilterProxy  (Tomcat → Spring bridge)
 *          │
 *          ▼
 *     FilterChainProxy
 *          │
 *          ├── Chain ① (@Order 1): URL is an OAuth endpoint? ──YES──► run chain ① filters
 *          │                                                  NO
 *          │                                                   │
 *          └── Chain ② (@Order 2): matches anything ◄──────────┘ ──► run chain ② filters
 *
 *
 *  FULL AUTHORIZATION CODE FLOW (which bean is used at each step)
 *  --------------------------------------------------------------
 *
 *   Postman                         Auth Server :9000
 *     │
 *     │ 1. GET /oauth2/authorize?client_id=payment-client&scope=...&redirect_uri=...
 *     │─────────────────────────────► Chain ①
 *     │                                 ├─ OAuth2AuthorizationEndpointFilter
 *     │                                 │    ├─ ④ client exists? redirect_uri allowed? scopes allowed?
 *     │                                 │    └─ user logged in? ── NO ──► AccessDenied
 *     │                                 └─ ExceptionTranslationFilter
 *     │                                      └─ browser (text/html)? ── YES ──► 302 /login
 *     │
 *     │ 2. GET /login
 *     │─────────────────────────────► Chain ②  → login page (HTML)
 *     │
 *     │ 3. POST /login  (username=nithin, password=password)
 *     │─────────────────────────────► Chain ②
 *     │                                 └─ UsernamePasswordAuthenticationFilter
 *     │                                      └─ DaoAuthenticationProvider
 *     │                                           ├─ ③ load user "nithin"
 *     │                                           └─ compare password ({noop})
 *     │                                      ✓ → identity saved in HTTP SESSION
 *     │                                      → 302 back to /oauth2/authorize (step 1 URL)
 *     │
 *     │ 4. GET /oauth2/authorize  (again, now logged in)
 *     │─────────────────────────────► Chain ①
 *     │                                 └─ ④ requireAuthorizationConsent = true → consent page
 *     │
 *     │ 5. POST consent (user ticks payment.read, payment.write)
 *     │─────────────────────────────► Chain ①
 *     │                                 └─ create one-time CODE
 *     │ ◄──── 302 https://oauth.pstmn.io/v1/callback?code=XYZ
 *     │
 *     │ 6. POST /oauth2/token  (Authorization: Basic payment-client:secret, code=XYZ)
 *     │─────────────────────────────► Chain ①
 *     │                                 ├─ client authentication filter
 *     │                                 │    └─ ④ secret correct? auth method = BASIC?
 *     │                                 └─ OAuth2TokenEndpointFilter
 *     │                                      ├─ code valid + unused?
 *     │                                      ├─ build claims: sub, aud, scope, iat,
 *     │                                      │   exp (④ TTL 5 min), iss (⑦)
 *     │                                      └─ sign with ⑤ private key (kid in header)
 *     │ ◄──── { "access_token": "eyJ...", "token_type": "Bearer", "expires_in": 299 }
 *
 * ============================================================================================
 */
@Configuration      // "This class defines beans." Spring runs each @Bean method once at startup.
@EnableWebSecurity  // Turns on Spring Security for web requests and provides HttpSecurity.
public class SecurityConfig {

    /*
     * ────────────────────────────────────────────────────────────────────────────────────────
     *  ① authorizationServerSecurityFilterChain
     * ────────────────────────────────────────────────────────────────────────────────────────
     *  PURPOSE : Security for the OAuth protocol endpoints.
     *  INPUT   : HttpSecurity (an empty builder Spring hands us)
     *  PROCESS : add OAuth filters → restrict chain to OAuth URLs → require auth → set login redirect
     *  OUTPUT  : SecurityFilterChain (an ordered list of filters)
     *  CALLED  : once at startup, by Spring
     *  USED    : at runtime by FilterChainProxy, for every OAuth URL
     *  FR      : AS-2, AS-4, AS-5, FR-3.4
     *
     *  RUNTIME: what chain ① does with a request
     *
     *     request (e.g. GET /oauth2/authorize)
     *        │
     *        ▼
     *     OAuth protocol filters (added by the configurer)
     *        │   /oauth2/authorize → OAuth2AuthorizationEndpointFilter
     *        │   /oauth2/token     → OAuth2TokenEndpointFilter
     *        │   /oauth2/jwks      → NimbusJwkSetEndpointFilter
     *        │   /.well-known/...  → metadata filters
     *        ▼
     *     AuthorizationFilter: anyRequest().authenticated()
     *        │
     *        ├── authenticated ──────────► filter writes the OAuth response
     *        │
     *        └── not authenticated ──────► ExceptionTranslationFilter
     *                                          ├── browser (text/html) → 302 /login
     *                                          └── API client          → 401
     */
    @Bean       // Register the returned object as a bean.
    @Order(1)   // FilterChainProxy checks this chain FIRST.
    public SecurityFilterChain authorizationServerSecurityFilterChain(HttpSecurity http) throws Exception {

        // (A) Get the configurer that knows how to add all OAuth protocol filters.
        //     INPUT: none   OUTPUT: configurer (not yet attached to http)
        OAuth2AuthorizationServerConfigurer authorizationServerConfigurer =
                OAuth2AuthorizationServerConfigurer.authorizationServer();

        http
            // (B) getEndpointsMatcher(): asks the configurer "which URLs do you own?"
            //     securityMatcher(...):  "this chain applies ONLY to those URLs."
            //     /oauth2/jwks → chain ①     /login → not matched → falls to chain ②
            .securityMatcher(authorizationServerConfigurer.getEndpointsMatcher())

            // (C) with(...): plugs the configurer into this chain, adding its filters.
            //     oidc(...):  enables OpenID Connect → adds /.well-known/openid-configuration,
            //                 /userinfo, etc.   withDefaults() = default settings.
            .with(authorizationServerConfigurer, authorizationServer ->
                    authorizationServer.oidc(Customizer.withDefaults()))

            // (D) Authorization rule for every URL in this chain: caller must be authenticated.
            //     /oauth2/authorize → the USER must be logged in
            //     /oauth2/token     → the CLIENT must send id + secret
            .authorizeHttpRequests(authorize -> authorize
                    .anyRequest().authenticated())

            // (E) What to do when the caller is NOT authenticated:
            //     IF the request wants HTML (a browser)   → MediaTypeRequestMatcher(TEXT_HTML)
            //     THEN redirect to /login                 → LoginUrlAuthenticationEntryPoint
            //     Otherwise Spring's default applies (401).
            .exceptionHandling(exceptions -> exceptions
                    .defaultAuthenticationEntryPointFor(
                            new LoginUrlAuthenticationEntryPoint("/login"),
                            new MediaTypeRequestMatcher(MediaType.TEXT_HTML)));

        // (F) build() turns everything described above into a real, ordered SecurityFilterChain:
        //     a chain that ONLY handles the OAuth endpoints (B), uses the OAuth protocol filters
        //     plus OIDC to answer them (A, C), lets through only authenticated callers (the user
        //     for /oauth2/authorize, the client for /oauth2/token) (D), and redirects a
        //     not-yet-logged-in browser to /login so the user can authenticate (E).
        //     Spring registers it with FilterChainProxy at startup, and runs it FIRST (@Order 1)
        //     for every matching request at runtime.
        return http.build();
    }

    /*
     * ────────────────────────────────────────────────────────────────────────────────────────
     *  ② defaultSecurityFilterChain
     * ────────────────────────────────────────────────────────────────────────────────────────
     *  PURPOSE : Security for everything that is NOT an OAuth endpoint, mainly the login page.
     *  INPUT   : HttpSecurity (a fresh builder)
     *  PROCESS : require auth for all URLs → add form login
     *  OUTPUT  : SecurityFilterChain
     *  CALLED  : once at startup
     *  USED    : for any URL chain ① didn't match (no securityMatcher = catches all)
     *  FR      : FR-3.3, FR-3.5
     *
     *  RUNTIME: POST /login
     *
     *     POST /login (username, password)
     *        │
     *        ▼
     *     UsernamePasswordAuthenticationFilter
     *        │  builds unverified Authentication("nithin", "password")
     *        ▼
     *     AuthenticationManager → DaoAuthenticationProvider
     *        │  ③ userDetailsService.loadUserByUsername("nithin")
     *        │  PasswordEncoder: {noop} → compare plain text
     *        ▼
     *     ✓ success → SecurityContext saved in HTTP SESSION
     *        │
     *        ▼
     *     302 → the URL the browser originally wanted (/oauth2/authorize?...)
     *
     *     ✗ failure → 302 /login?error
     */
    @Bean
    @Order(2)   // Checked SECOND.
    public SecurityFilterChain defaultSecurityFilterChain(HttpSecurity http) throws Exception {
        http
            // Every URL in this chain requires login. (/login itself is permitted by formLogin.)
            .authorizeHttpRequests(authorize -> authorize
                    .anyRequest().authenticated())

            // Adds UsernamePasswordAuthenticationFilter + a generated login page at /login.
            // After login, redirects back to the originally requested URL.
            .formLogin(Customizer.withDefaults());

        return http.build();
    }

    /*
     * ────────────────────────────────────────────────────────────────────────────────────────
     *  ③ userDetailsService: THE PERSON
     * ────────────────────────────────────────────────────────────────────────────────────────
     *  PURPOSE : Store users who can log in.
     *  INPUT   : none
     *  PROCESS : build one User → put it in an in-memory store
     *  OUTPUT  : UserDetailsService
     *  USED    : at runtime by DaoAuthenticationProvider during POST /login
     *            loadUserByUsername("nithin") → UserDetails (username, password, authorities)
     *  FR      : FR-3.1, FR-3.2
     */
    @Bean
    public UserDetailsService userDetailsService() {
        UserDetails nithin = User.withUsername("nithin")   // login name
                .password("{noop}password")                // {noop} = plain text, compare directly (learning only)
                .roles("USER")                             // → authority ROLE_USER (required, unused by us)
                .build();                                  // → finished UserDetails object

        // In-memory user store. Runtime question it answers: "give me user X".
        return new InMemoryUserDetailsManager(nithin);
    }

    /*
     * ────────────────────────────────────────────────────────────────────────────────────────
     *  ④ registeredClientRepository: THE APPLICATION
     * ────────────────────────────────────────────────────────────────────────────────────────
     *  PURPOSE : Store applications that are allowed to request tokens.
     *  INPUT   : none
     *  PROCESS : build one RegisteredClient → put it in an in-memory store
     *  OUTPUT  : RegisteredClientRepository
     *  USED    : at runtime by chain ① on EVERY OAuth request:
     *
     *     /oauth2/authorize → findByClientId("payment-client")
     *                           ├─ grant type allowed?     (authorization_code)
     *                           ├─ redirect_uri allowed?   (exact match)
     *                           ├─ scopes allowed?         (payment.read / payment.write)
     *                           └─ consent required?       (yes → consent page)
     *
     *     /oauth2/token     → findByClientId("payment-client")
     *                           ├─ auth method = BASIC?
     *                           ├─ secret correct?
     *                           └─ token TTL?              (5 min → exp claim)
     *
     *  FR      : AS-4, FR-5.2
     */
    @Bean
    public RegisteredClientRepository registeredClientRepository() {
        RegisteredClient paymentClient = RegisteredClient
                .withId(UUID.randomUUID().toString())      // internal record ID (NOT the client ID)
                .clientId("payment-client")                // the app's "username", sent by Postman
                .clientSecret("{noop}secret")              // the app's "password"

                // How the client proves itself at /oauth2/token:
                // Authorization: Basic base64("payment-client:secret")
                .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)

                // The ONLY flow this client may use: login → code → token.
                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)

                // The ONLY address the one-time code may be sent to (exact match).
                .redirectUri("https://oauth.pstmn.io/v1/callback")

                // The ONLY permissions this client may ask for.
                .scope("payment.read")
                .scope("payment.write")

                // Login-flow behavior for this client:
                // show the "Allow these scopes?" screen before issuing a code.
                .clientSettings(ClientSettings.builder()
                        .requireAuthorizationConsent(true)
                        .build())

                // Token behavior for this client:
                // each JWT expires 5 min after issue → exp = iat + 300.
                .tokenSettings(TokenSettings.builder()
                        .accessTokenTimeToLive(Duration.ofMinutes(5))
                        .build())

                .build();                                   // → finished RegisteredClient

        // ── MACHINE CLIENT 1: reporting-client (learn client credentials in Postman) ──
        // No user, no login page, no consent, no redirect URI.
        // One call: POST /oauth2/token  grant_type=client_credentials
        // Token "sub" = "reporting-client". Read-only.
        RegisteredClient reportingClient = RegisteredClient
                .withId(UUID.randomUUID().toString())
                .clientId("reporting-client")
                .clientSecret("{noop}reporting-secret")
                .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
                .authorizationGrantType(AuthorizationGrantType.CLIENT_CREDENTIALS)   // the ONLY grant
                .scope("payment.read")
                .tokenSettings(TokenSettings.builder()
                        .accessTokenTimeToLive(Duration.ofMinutes(5))
                        .build())
                .build();

        // ── MACHINE CLIENT 2: settlement-job (the nightly settlement app) ──
        // Can read payments and settle them. Can NOT create payments (no payment.write).
        RegisteredClient settlementJob = RegisteredClient
                .withId(UUID.randomUUID().toString())
                .clientId("settlement-job")
                .clientSecret("{noop}settlement-secret")
                .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
                .authorizationGrantType(AuthorizationGrantType.CLIENT_CREDENTIALS)
                .scope("payment.read")
                .scope("payment.settle")
                .tokenSettings(TokenSettings.builder()
                        .accessTokenTimeToLive(Duration.ofMinutes(5))
                        .build())
                .build();

        // In-memory client store holding all three clients.
        // Runtime question it answers: "give me client X".
        return new InMemoryRegisteredClientRepository(paymentClient, reportingClient, settlementJob);
    }

    /*
     * ────────────────────────────────────────────────────────────────────────────────────────
     *  ⑤ jwkSource: THE SIGNING KEY ("official stamp")
     * ────────────────────────────────────────────────────────────────────────────────────────
     *  PURPOSE : Provide the key used to sign every JWT, and the public key to publish.
     *  INPUT   : none
     *  PROCESS :
     *
     *     generateRsaKey()            → KeyPair (public + private), new on every startup
     *          │
     *          ▼
     *     RSAKey (JWK format)          → public + private + kid
     *          │
     *          ▼
     *     JWKSet                       → list of keys (1 for now; several during rotation)
     *          │
     *          ▼
     *     ImmutableJWKSet              → read-only JWKSource
     *
     *  OUTPUT  : JWKSource<SecurityContext>
     *  USED    : at runtime in two places:
     *
     *     /oauth2/token → JWT encoder picks key → signs with PRIVATE key → "kid" in JWT header
     *     /oauth2/jwks  → publishes PUBLIC key only (private part stripped automatically)
     *                      ↑ Service A/B download this to verify signatures
     *
     *  FR      : AS-6
     */
    @Bean
    public JWKSource<SecurityContext> jwkSource() {
        KeyPair keyPair = generateRsaKey();                                  // fresh pair at startup

        RSAKey rsaKey = new RSAKey.Builder((RSAPublicKey) keyPair.getPublic()) // wrap public half in JWK format
                .privateKey((RSAPrivateKey) keyPair.getPrivate())            // attach private half (for signing)
                .keyID(UUID.randomUUID().toString())                         // unique "kid"
                .build();

        return new ImmutableJWKSet<>(new JWKSet(rsaKey));                    // read-only key list
    }

    /*
     *  generateRsaKey (private helper, plain Java)
     *  INPUT   : none
     *  PROCESS : RSA generator → 2048-bit size → generate
     *  OUTPUT  : KeyPair (public + private)
     *  NOTE    : in memory only → restart = new key = old tokens rejected (Q20)
     */
    private static KeyPair generateRsaKey() {
        try {
            KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA"); // "give me an RSA key generator"
            generator.initialize(2048);                                      // key size in bits (FR-6.1)
            return generator.generateKeyPair();                              // create public + private pair
        } catch (Exception ex) {
            throw new IllegalStateException(ex);                             // startup fails if keys can't be made
        }
    }

    /*
     * ────────────────────────────────────────────────────────────────────────────────────────
     *  ⑥ jwtDecoder
     * ────────────────────────────────────────────────────────────────────────────────────────
     *  PURPOSE : Read and verify JWTs sent TO this server (OIDC /userinfo).
     *  INPUT   : jwkSource (bean ⑤, injected by Spring)
     *  OUTPUT  : JwtDecoder
     *  NOTE    : NOT used by Service A/B; they build their own decoder from issuer-uri.
     */
    @Bean
    public JwtDecoder jwtDecoder(JWKSource<SecurityContext> jwkSource) {
        return OAuth2AuthorizationServerConfiguration.jwtDecoder(jwkSource);
    }

    /*
     * ────────────────────────────────────────────────────────────────────────────────────────
     *  ⑦ authorizationServerSettings: THE ISSUER
     * ────────────────────────────────────────────────────────────────────────────────────────
     *  PURPOSE : Server-wide settings: official name (issuer) and endpoint paths.
     *  INPUT   : none
     *  OUTPUT  : AuthorizationServerSettings
     *  USED    :
     *     /oauth2/token                     → writes "iss": "http://localhost:9000" into every JWT
     *     /.well-known/openid-configuration → publishes "issuer": "http://localhost:9000"
     *     Service A/B                       → trust ONLY tokens whose iss matches exactly
     *  NOTE    : set explicitly so localhost vs 127.0.0.1 can't produce different issuers.
     *  FR      : FR-2.1, FR-2.3, FR-5.6
     */
    @Bean
    public AuthorizationServerSettings authorizationServerSettings() {
        return AuthorizationServerSettings.builder()
                .issuer("http://localhost:9000")   // official name; endpoint paths keep defaults
                .build();
    }
}
