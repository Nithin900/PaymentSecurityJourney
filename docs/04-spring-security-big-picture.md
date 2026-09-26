# Spring Security: the full picture

## 1. Where Spring Security sits

Spring Security is **a set of servlet filters that run before your controller**. If security says no, the request never reaches the DispatcherServlet — that's why an invalid JWT never touches your controller, service, or database.

```text
HTTP Request → Tomcat → Filter → Filter → [SPRING SECURITY] → DispatcherServlet → Controller
```

## 2. The filter plumbing

```text
Tomcat filter chain
   ▼
DelegatingFilterProxy        ← bridge: Tomcat knows nothing about Spring beans
   ▼
FilterChainProxy             ← "Which SecurityFilterChain matches this URL?" (first match wins)
   ├──→ SecurityFilterChain #1 (@Order 1)  e.g. /oauth2/**
   └──→ SecurityFilterChain #2 (@Order 2)  everything else
```

One app can have **several** chains. That's why the Auth Server has two: chain ① for OAuth endpoints, chain ② for the login page.

## 3. Inside one chain (important filters, in order)

```text
SecurityContextHolderFilter           load "who is logged in" (e.g. from session)
CsrfFilter                            block forged form submissions
LogoutFilter                          handle /logout
── AUTHENTICATION FILTERS ──          "WHO are you?"
UsernamePasswordAuthenticationFilter    login form (Auth Server)
BearerTokenAuthenticationFilter         JWT in header (Service A/B)
AnonymousAuthenticationFilter         nobody identified? mark as anonymous
ExceptionTranslationFilter            turns security failures into 401 / 403
AuthorizationFilter                   "Are you ALLOWED?" (always last)
   ▼
your controller
```

## 4. The two questions

| AUTHENTICATION | AUTHORIZATION |
|---|---|
| "Who are you?" | "What may you do?" |
| Happens first | Happens after |
| Failure → **401** | Failure → **403** |
| Form login, bearer token filters | `AuthorizationFilter` |

## 5. Authentication architecture

```text
Authentication filter (form / bearer)
   │ 1. builds an UNVERIFIED Authentication
   ▼
AuthenticationManager (ProviderManager)
   │ 2. asks each provider "can you handle this type?"
   ▼
DaoAuthenticationProvider            JwtAuthenticationProvider
  → UserDetailsService (load user)     → JwtDecoder (signature, exp, iss)
  → PasswordEncoder (match?)           → JwtAuthenticationConverter (scope → SCOPE_)
   │ 3. returns a VERIFIED Authentication
   ▼
SecurityContextHolder → SecurityContext → Authentication
                          principal: nithin
                          authorities: [SCOPE_payment.read, SCOPE_payment.write]
```

| Object | What it is |
|---|---|
| Authentication | "Who this is + what they're allowed", before and after verification |
| AuthenticationManager | Front desk: "verify this" |
| AuthenticationProvider | Specialist for one credential type |
| UserDetailsService | Loads a user by username |
| PasswordEncoder | Compares passwords safely |
| JwtDecoder | Checks JWT signature, expiry, issuer |
| GrantedAuthority | One permission string, e.g. `SCOPE_payment.write` |
| SecurityContextHolder | Where the verified identity lives during the request (**ThreadLocal** by default) |

## 6. Authorization

`AuthorizationFilter` → `AuthorizationManager` checks your rules top to bottom, first match wins. Second level: **method security** (`@PreAuthorize`) using the same authorities.

## 7. How failures become 401 / 403

```text
security exception → ExceptionTranslationFilter
   ├── not authenticated → AuthenticationEntryPoint
   │       browser  → 302 /login   (Auth Server)
   │       API      → 401 + WWW-Authenticate: Bearer   (Service A/B)
   └── authenticated but not allowed → AccessDeniedHandler → 403
```

## 8. Sessions vs stateless

| STATEFUL (Auth Server) | STATELESS (Service A/B) |
|---|---|
| Log in once, identity in HTTP session | Every request carries a JWT |
| Browser sends session cookie | No session, no cookie |
| CSRF protection needed | CSRF not needed |

## 9. One request through Service B

1. Tomcat receives the request
2. DelegatingFilterProxy → FilterChainProxy picks B's chain
3. BearerTokenAuthenticationFilter finds `Bearer eyJ...`
4. JwtDecoder: signature ✓ issuer ✓ expiry ✓
5. Converter: `payment.write` → `SCOPE_payment.write`
6. Verified Authentication stored in SecurityContextHolder
7. AuthorizationFilter: POST /payments needs `SCOPE_payment.write` ✓
8. DispatcherServlet → Controller → Service → Repository → H2
9. Response returns; SecurityContext is cleared

| Fails at | Why | Result |
|---|---|---|
| 3 | No header | anonymous → denied at 7 → **401** |
| 4 | Bad signature / expired / wrong issuer | **401** |
| 7 | Missing scope | **403** |

## 10. Interview version (60 seconds)

> Spring Security is a chain of servlet filters in front of the DispatcherServlet. `DelegatingFilterProxy` hands requests to `FilterChainProxy`, which picks the matching `SecurityFilterChain`. Authentication filters build an `Authentication` object and pass it to the `AuthenticationManager`, which delegates to an `AuthenticationProvider` — DAO for passwords or JWT for bearer tokens. The verified result is stored in the thread-local `SecurityContextHolder`. The `AuthorizationFilter` then checks the user's `GrantedAuthority`s against the rules. `ExceptionTranslationFilter` turns failures into 401 for authentication problems and 403 for authorization problems. In OAuth2, the Authorization Server issues signed JWTs, and resource servers validate them statelessly using the issuer's public key.

**Tip:** with TRACE logging on, look for "Will secure any request with [...]" at startup — it lists the actual filters in each chain.
