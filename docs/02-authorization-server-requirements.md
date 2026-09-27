# Epic 1: Authorization Server (:9000) — requirements

**Epic goal:** a standalone service that authenticates users and registered applications and issues signed JWT access tokens.

## Setup notes (Spring Boot 3.5.5)

- start.spring.io only offers Boot 4.x. Generate with 4.x, then change the parent to **3.5.5** and rename starters to the 3.x names:

| Boot 4 name (generated) | Boot 3.5 name (use this) |
|---|---|
| `spring-boot-starter-webmvc` | `spring-boot-starter-web` |
| `spring-boot-starter-security-oauth2-authorization-server` | `spring-boot-starter-oauth2-authorization-server` |
| `...-test` starters | one `spring-boot-starter-test` |

- Remove `spring-boot-starter-oauth2-client` if generated: the Auth Server **is** the server, not a client.
- Read the **Spring Authorization Server 1.5** docs, not Spring Security 7. In 1.5 the style is `OAuth2AuthorizationServerConfigurer.authorizationServer()` + `http.with(...)`; `http.oauth2AuthorizationServer(...)` exists only in Security 7.

## AS-1: Project setup
| ID | Requirement |
|---|---|
| FR-1.1 | The Authorization Server **shall** be a standalone Spring Boot app named `payment-authorization-server`, separate from A and B. |
| FR-1.2 | It **shall** listen on port **9000**. |
| FR-1.3 | It **shall** use the same Spring Boot version as A and B (**3.5.5**). |
| FR-1.4 | It **shall** log Spring Security decisions at TRACE level when running locally. |
| FR-1.5 | It **shall not** contain any payment classes, endpoints, or database. |

## AS-2: Issuer and discovery
| ID | Requirement |
|---|---|
| FR-2.1 | It **shall** identify itself with the issuer `http://localhost:9000`. |
| FR-2.2 | It **shall** publish metadata at `/.well-known/openid-configuration`. |
| FR-2.3 | The metadata's `issuer` **shall** exactly match FR-2.1. |
| FR-2.4 | It **shall** publish its public signing keys at `/oauth2/jwks`. |
| FR-2.5 | FR-2.2 and FR-2.4 **shall** be reachable without authentication. |

## AS-3: User login (the person)
| ID | Requirement |
|---|---|
| FR-3.1 | It **shall** store user accounts in memory. |
| FR-3.2 | It **shall** provide exactly one user: `nithin` / `password`. |
| FR-3.3 | It **shall** authenticate users only through a login form it serves itself. |
| FR-3.4 | An unauthenticated browser request to `/oauth2/authorize` **shall** be redirected to the login page. |
| FR-3.5 | After login, it **shall** continue the original authorization request automatically. |
| FR-3.6 | It **shall not** support the password grant. |

## AS-4: Client registration (the application)
| ID | Requirement |
|---|---|
| FR-4.1 | It **shall** store registered clients in memory. |
| FR-4.2 | It **shall** register the client `payment-client` / `secret`. |
| FR-4.3 | The client **shall** authenticate at the token endpoint with HTTP Basic (`client_secret_basic`). |
| FR-4.4 | The client **shall** be allowed **only** the `authorization_code` grant. |
| FR-4.5 | The client **shall** be allowed **only** the redirect URI `https://oauth.pstmn.io/v1/callback`. |
| FR-4.6 | Any other redirect URI **shall** be rejected. |
| FR-4.7 | The client **shall** be allowed **only** the scopes `payment.read` and `payment.write`. |
| FR-4.8 | Any other requested scope **shall** be rejected. |
| FR-4.9 | The user **shall** see a consent screen listing the requested scopes before a code is issued. |
| FR-4.10 | The token **shall** contain only the scopes the user approved. |

## AS-5: Token issuance
| ID | Requirement |
|---|---|
| FR-5.1 | Access tokens **shall** be JWTs. |
| FR-5.2 | Each access token **shall** expire **5 minutes** after it is issued. |
| FR-5.3 | Each token **shall** contain `sub`, `iss`, `aud`, `scope`, `iat` and `exp`. |
| FR-5.4 | `sub` **shall** equal the logged-in username. |
| FR-5.5 | `aud` **shall** equal the client ID that requested the token. |
| FR-5.6 | `iss` **shall** equal the issuer from FR-2.1. |
| FR-5.7 | Each authorization code **shall** work only once. |
| FR-5.8 | It **shall not** issue refresh tokens yet. |

## AS-6: Token signing
| ID | Requirement |
|---|---|
| FR-6.1 | Every token **shall** be signed with an RSA private key of at least 2048 bits. |
| FR-6.2 | The key pair **shall** be generated at startup and kept only in memory. |
| FR-6.3 | Each key **shall** have a unique `kid`, and every JWT header **shall** carry the `kid` that signed it. |
| FR-6.4 | The private key **shall never** be exposed by any endpoint or log. |
| FR-6.5 | Only the public key **shall** appear at `/oauth2/jwks`. |

## Structure

```text
SecurityConfig  (@Configuration, @EnableWebSecurity)
├── ① authorizationServerSecurityFilterChain  @Order(1)   → AS-2, AS-4, AS-5, FR-3.4
├── ② defaultSecurityFilterChain              @Order(2)   → FR-3.3, FR-3.5
├── ③ userDetailsService                                  → FR-3.1, FR-3.2
├── ④ registeredClientRepository                          → AS-4, FR-5.2
├── ⑤ jwkSource  (+ generateRsaKey helper)                → AS-6
├── ⑥ jwtDecoder                                          → OIDC /userinfo
└── ⑦ authorizationServerSettings                         → FR-2.1, FR-5.6
```

## Sequence (Authorization Code flow)

```text
 User        Postman (Client)        Auth Server :9000
  │                │ GET /oauth2/authorize  │
  │                │───────────────────────>│── not logged in (FR-3.4)
  │<────────────── 302 → /login ────────────│
  │ username + password (FR-3.3) ──────────>│── validate user (AS-3)
  │<──────────── consent screen (FR-4.9) ───│
  │ approve scopes ────────────────────────>│── create one-time code (FR-5.7)
  │                │<── redirect + code ────│
  │                │ POST /oauth2/token     │
  │                │ Basic(client:secret)   │
  │                │ + code ───────────────>│── validate client (AS-4), code
  │                │                        │── build claims (FR-5.3), sign (AS-6)
  │                │<── access_token (JWT) ─│
```

## Acceptance criteria

| # | Given / When | Expect |
|---|---|---|
| AC-1 | Open `/.well-known/openid-configuration` | `"issuer": "http://localhost:9000"` |
| AC-2 | Open `/oauth2/jwks` | One key with a `kid`; no private fields (`d`, `p`, `q`) |
| AC-3 | Request a token from Postman | Browser shows the :9000 login page |
| AC-4 | Log in as `nithin`, approve both scopes | Postman receives an access token |
| AC-5 | Decode the token | `sub=nithin`, `aud=payment-client`, both scopes, `exp − iat = 300` |
| AC-6 | Approve only `payment.read` | Token has only `payment.read` |
| AC-7 | Request scope `payment.delete` | Rejected (`invalid_scope`) |
| AC-8 | Change the redirect URI | Rejected with an error page on :9000 |
| AC-9 | Restart the app, reload `/oauth2/jwks` | The `kid` has changed |
| AC-10 | Reuse an authorization code | 400 `invalid_grant` |
| AC-11 | Wrong client secret at `/oauth2/token` | 401 `invalid_client` |

Status (23 Sep): AC-1 to AC-5 and AC-9 passed. AC-6, AC-7, AC-8, AC-10, AC-11 still to run.

**Out of scope:** refresh tokens, database users and clients, password hashing, persistent keys and rotation, custom claims, roles.
