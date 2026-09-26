# OAuth 2.0 + Spring Security: complete notes (snapshot)

Built from your handwritten page (24 Sep). Items marked **✚** were missing from the page.

**Corrections to the page**
- **Implicit grant** is deprecated (token in the URL leaks). Web and mobile use **Authorization Code + PKCE**; OAuth 2.1 removes implicit.
- OAuth 2.0 is an **authorization framework**, not an authentication protocol. Login is **OpenID Connect**'s job.
- "Native support?" → **Yes**, Spring Security supports client, resource server and authorization server.
- There is no "OAuth 3". **OAuth 2.1** is the consolidation of current best practice.

---

## Phase 1: Data points

**Purpose:** OAuth 2.0 = delegated access · ✚ OIDC = identity layer · ✚ OAuth 2.1 = cleanup

**Roles:** Resource Owner (user) · Client (app) · Authorization Server (issues tokens) · Resource Server (API) · ✚ public vs confidential client

**Tokens:** access token · refresh token · ✚ ID token (OIDC) · ✚ JWT vs opaque · ✚ claims `sub iss aud exp iat scope jti`

**Grants:** Authorization Code · ✚ PKCE · Client Credentials · Refresh Token · ✚ Device Code · ~~Implicit~~ · ✚ ~~Password~~

**Pieces ✚:** scope · consent · redirect URI · `state` · client authentication method · front channel vs back channel

**Endpoints ✚:** `/authorize` · `/token` · `/jwks` · `/introspect` · `/revoke` · `/userinfo` · `/.well-known/openid-configuration`

**Crypto ✚:** private key signs · public key verifies · `kid` · key rotation · RS256 vs HS256

**Spring:** OAuth2 Client · Resource Server · Authorization Server · ✚ filter chain · `SecurityContextHolder` · `JwtDecoder` · `JwtAuthenticationConverter` · `SCOPE_` · `RegisteredClient` · `JWKSource` · `OAuth2AuthorizedClientManager`

## Phase 2: How each data point works

| Data point | How it works |
|---|---|
| Authorization Code | User logs in at the auth server → client gets a one-time code → exchanges it for a token |
| PKCE | Client sends a hash (challenge) first, the secret (verifier) later → a stolen code is useless |
| Client Credentials | Service sends client ID + secret → gets a token; no user |
| Refresh Token | Client sends refresh token to `/token` → new access token, no login |
| Device Code | Device shows a code → user approves on a phone → device polls for the token |
| Scope | Permission string in the token → the API checks it |
| Consent | User approves scopes → only approved scopes go in the token |
| Redirect URI | Code sent only to a pre-registered URL (exact match) |
| `state` | Random value sent and returned → blocks forged redirects (CSRF) |
| JWT | header.payload.signature → verified locally with the public key |
| Opaque token | Random string → the API asks `/introspect` |
| ID token | JWT about the user → for the client, never sent to APIs |
| JWKS | Public keys at a URL → APIs download once and cache |
| `kid` | Key ID in the JWT header → which key to verify with |
| Discovery | One URL lists all endpoints → the API needs only `issuer-uri` |
| Revocation | `/revoke` kills a refresh token (a JWT access token lives until `exp`) |
| Spring filter chain | Filters before the controller → auth fails 401, scope fails 403 |
| `SCOPE_` prefix | `payment.read` → authority `SCOPE_payment.read` |

## Phase 3: How everything connects

```text
            ┌──────────── (1) /authorize + PKCE challenge + state ───────────┐
User ── Client                                                      Authorization Server
            │◄─ (2) login page → (3) consent → (4) code to redirect URI ─────┤
            ├──── (5) /token: code + verifier + client auth (back channel) ─►│
            │◄─── (6) access token (JWT) + refresh token + ID token ─────────┤
            ├── (7) Bearer JWT ─► Resource Server A ── (8) same JWT ─► Resource Server B
            │                        └── (9) public key via /jwks (fetched once, cached)
            └── (10) token expires → refresh token → /token → new access token
```

Identity (login) → permission (consent + scopes) → proof (signed token) → verification (public key) → decision (200 / 401 / 403) → renewal (refresh).

Inside Spring (steps 7–8): `BearerTokenAuthenticationFilter` → `JwtDecoder` → converter (`SCOPE_…`) → `SecurityContextHolder` → `AuthorizationFilter` → controller.

## Phase 4: Trade-offs

| Choice | Option A | Option B | Pick when |
|---|---|---|---|
| Token format | JWT: fast, no call per request | Opaque: instant revocation | JWT for most microservices |
| Lifetime | Short (5–15 min) | Long | Short access + refresh token |
| Signing | RS256: public key shareable | HS256: one shared secret | RS256 when many services verify |
| Service-to-service | Token relay: keeps user identity | Client credentials: service identity | Relay for user actions; client credentials for jobs |
| Validation | Every service | Gateway only | Every service (zero trust) |
| Auth server | Build (Spring AS) | Buy (Keycloak, Okta, Azure AD) | Buy in most companies |
| Session | Stateless (JWT) | Stateful (cookie) | Stateless for APIs |
| Token in browser | BFF (backend holds tokens) | Token in JS | BFF for payments |

## Phase 5: Production scenarios and interview questions

| Scenario | Answer |
|---|---|
| User's phone stolen | Revoke refresh tokens; access tokens die within minutes |
| Rotate the signing key | Publish new + old in JWKS → sign with new → remove old after max token lifetime |
| Auth server down | Existing JWTs still work; new logins fail → run it HA |
| A calls B for a user | Token relay; B validates too |
| Nightly batch job | Client credentials |
| Token for B used on C | Validate `aud` everywhere |
| Clocks differ | ~60 s clock skew (Spring default) |
| SPA login | Authorization Code + PKCE, ideally behind a BFF |
| All 401 after deploy | Issuer mismatch (`localhost` vs `127.0.0.1`) or regenerated key |
| Always 403 | Missing `SCOPE_` prefix or scope not granted |

| Question | One-line answer |
|---|---|
| OAuth vs OIDC? | Access (authorization) vs identity (authentication) |
| OAuth vs JWT? | Framework vs token format |
| Why PKCE? | Stops a stolen authorization code being exchanged |
| Why is implicit deprecated? | Token in the URL leaks |
| 401 vs 403? | Unknown identity vs no permission |
| How does an API trust a JWT? | Verifies the signature with the public key from JWKS |
| How to revoke a JWT? | Can't directly: short-lived, revoke refresh token, or opaque tokens |
| Access vs refresh token? | Access: short, to APIs; refresh: long, only to the auth server |
| Where do scopes come from? | Client requests → user consents → auth server writes them |
| Spring roles? | `oauth2Login`/client, `oauth2ResourceServer`, Spring Authorization Server |
| What changed in Spring Security 7? | Authorization Server merged in; built-in MFA |

---

## Concepts to know, in learning order

1. **Security basics:** authentication vs authorization · 401 vs 403 · stateful vs stateless · least privilege · defense in depth
2. **Cryptography:** hashing · public/private keys · digital signature · `kid` · key rotation
3. **JWT:** structure (encoded, not encrypted) · standard claims · validation · short lifetime · clock skew
4. **OAuth 2.0:** roles · access token · scopes · Authorization Code · PKCE · client credentials · refresh token · redirect URI · consent
5. **OIDC:** identity layer · discovery · JWKS · ID token vs access token
6. **Spring Security internals:** servlet filters · DelegatingFilterProxy → FilterChainProxy → SecurityFilterChain · `@Order` + `securityMatcher` · Authentication / Manager / Provider · UserDetailsService + PasswordEncoder · SecurityContextHolder · GrantedAuthority · AuthorizationFilter · ExceptionTranslationFilter · CSRF · CORS
7. **Spring Authorization Server:** two chains · RegisteredClient · JWKSource · AuthorizationServerSettings · token customization
8. **Resource Server:** `issuer-uri` · JwtDecoder · JwtAuthenticationConverter · `SCOPE_` · `@PreAuthorize` · reading the user from the JWT
9. **Microservices:** token relay · servlet vs reactive · error propagation · audience restriction · API gateway
10. **Production:** DB users/clients · encoded secrets · persistent keys · refresh/revocation · HTTPS · Keycloak/Okta/Azure AD · security testing
