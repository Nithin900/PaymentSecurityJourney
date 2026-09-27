# Testing and observing the whole flow

## Setup: turn on the "cameras"

1. In all three apps: `logging.level.org.springframework.security=TRACE`. Keep the three consoles side by side.
2. Postman → **View → Show Postman Console** to see real headers.
3. Chrome → F12 → **Network** → tick **Preserve log**.
4. jwt.io to look inside tokens. (jwt.io only **decodes**; only signature verification proves a token is valid.)

## Manual Authorization Code flow (see every step)

1. Start Auth Server → B → A.
2. Open in the browser (one line):
   ```text
   http://localhost:9000/oauth2/authorize?response_type=code&client_id=payment-client&scope=payment.read%20payment.write&redirect_uri=https://oauth.pstmn.io/v1/callback
   ```
   → you land on `localhost:9000/login` — the Auth Server's **own login page**.
   (If you don't see it, your session is still active: use an **Incognito** window or open `/logout` first.)
3. Log in `nithin` / `password` → consent page.
4. Tick both scopes → **Submit Consent** → browser goes to `...callback?code=XXXX`.
5. Copy the code (it expires in minutes, works once).
6. Postman → **Step 2 - Exchange Code for Access Token**: put the code in the Body `code` field (or the `authCode` collection variable) → **Send**.
   - Basic Auth `payment-client` / `secret`; body `grant_type=authorization_code`, `code`, `redirect_uri`.
7. Decode `access_token` at jwt.io: `sub`, `aud`, `scope`, `iss`, `exp − iat = 300`, header `kid` = the `kid` at `/oauth2/jwks`.
8. **Service A → Create Payment** with the Bearer token → saved.
9. Check `localhost:8081/h2-console`.

Network tab order:
```text
/oauth2/authorize      → 302 → /login              not logged in
POST /login            → 302 → /oauth2/authorize   logged in
/oauth2/authorize      → consent page
POST /oauth2/authorize → 302 → callback?code=...   code issued
```

## What the logs show (Service A → Create Payment)

```text
A: Securing POST /payments
A: Set SecurityContextHolder to JwtAuthenticationToken [..., Granted Authorities=[SCOPE_payment.read, SCOPE_payment.write]]
A: Authorized ... POST /payments
B: Securing POST /payments
B: Set SecurityContextHolder to JwtAuthenticationToken   ← SAME token arrived from A
```
If B shows no token / 401, A isn't forwarding the token. On the first call, A and B fetch `/.well-known/...` and `/oauth2/jwks` once; after that :9000 stays quiet.

## Test cases

**Setup:** get Token FULL (both scopes) and Token READ (only `payment.read` on consent).

### Service B directly (:8081)
| # | Request | Token | Expected |
|---|---|---|---|
| 1 | `POST /payments` | none | 401 |
| 2 | `POST /payments` | FULL | 201/200 |
| 3 | `GET /payments/{id}` | FULL | 200 |
| 4 | `POST /payments` | READ | 403 |
| 5 | `GET /payments/{id}` | READ | 200 |
| 6 | `POST /payments` | FULL, one char changed | 401 |
| 7 | `POST /payments` bad body | FULL | 400, not 401 |
| 8 | `/h2-console` | none | loads |

### Service A (:8080)
| # | Request | Token | Expected | Checks |
|---|---|---|---|---|
| 9 | `POST /payments` | none | 401 from A, B silent | A protects itself |
| 10 | `POST /payments` | FULL | saved in B's H2 | token relay |
| 11 | `POST /payments` | READ | 403 | scopes in A |
| 12 | `POST /payments` bad body | FULL | 400 | `/error` permitted |

### Error passthrough
| # | How | Expected |
|---|---|---|
| 13 | Change B's POST rule to `payment.admin`, call A with FULL | A returns 403, not 500 |

### Token lifetime and keys
| # | How | Expected |
|---|---|---|
| 14 | Wait 6 minutes, call A | 401 |
| 15 | Restart Auth Server, call A | 401 |

### Health
| # | Request | Expected |
|---|---|---|
| 16 | `GET /actuator/health` on A and B, no token | 200 (404 if Actuator missing; 401 means not permitted) |

### Auth Server negatives
| # | Do | Expect |
|---|---|---|
| 17 | authorize with `scope=payment.delete` | `error=invalid_scope` |
| 18 | authorize with another `redirect_uri` | error page on :9000, no redirect |
| 19 | token exchange with wrong secret | 401 `invalid_client` |
| 20 | reuse the same code | 400 `invalid_grant` |
| 21 | restart, reload `/oauth2/jwks` | different `kid` |

## Postman tips

- The collection is in `postman/`. Step 1 must be opened in a browser, not sent from Postman.
- Collection variables: Postman top-right **eye icon**, or collection **⋯ → Edit → Variables**. Simplest: paste the code straight into Step 2's Body.
- Automated: Authorization tab → OAuth 2.0 → Grant type **Authorization Code (With PKCE)**, Auth URL `http://localhost:9000/oauth2/authorize`, Token URL `http://localhost:9000/oauth2/token`, client `payment-client`/`secret`, scope `payment.read payment.write`, **Authorize using browser**, Client Authentication **Basic Auth header**.
