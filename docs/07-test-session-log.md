# OAuth2 Flow: Recorded Test Session

**Date:** 2026-09-23, 17:48–17:57 (Toronto)
**Apps:** Auth Server :9000, Service A :8080, Service B :8081, Chrome, Postman
**Recording:** `oauth2_login_flow.gif` (in your Downloads folder) covers the browser steps 1–4

| # | Step | Where | What happened | Result |
|---|---|---|---|---|
| 1 | Discovery document | Chrome → `/.well-known/openid-configuration` | Auth Server published its metadata and issuer | ✅ |
| 2 | Public key | Chrome → `/oauth2/jwks` | One RSA key, `kid = f445aa14-e9eb-4ae2-9673-2595ae0731d1`, public parts only | ✅ |
| 3 | Log out | Chrome → `/logout` → **Log Out** | Ended the old session, so the login page would show | ✅ |
| 4 | Authorize | Chrome → `/oauth2/authorize?...` | Not logged in, so **302 → `/login`** ("Please sign in") | ✅ |
| 5 | Login | Chrome, typed by you | `nithin` / `password` accepted, redirected back into the flow | ✅ |
| 6 | Consent | Chrome | Already approved earlier, so skipped | ✅ |
| 7 | Code | Chrome | Redirected to `oauth.pstmn.io/v1/callback?code=xgxz5y…` | ✅ |
| 8 | Exchange code | Postman → **Step 2 - Exchange Code** | **200 OK**, tests 2/2, `scope: payment.write payment.read`, `expires_in: 300` | ✅ |
| 9 | Read payment | Postman → **Service A → Get Payment By Id** | **200 OK**, `pay-postman-1` retrieved through A → B | ✅ |

## Token contents (from the first run, same structure)

```text
Header:  kid = f445aa14-...  (matches the JWKS key in step 2)   alg = RS256
sub   = nithin
aud   = payment-client
scope = [payment.write, payment.read]
iss   = http://localhost:9000
exp − iat = 300 seconds
```

## What this proves

- The Auth Server serves its **own login page**, so the client never sees the password.
- The token is signed with the key published at `/oauth2/jwks` (same `kid`).
- Service A accepted the token and **forwarded it to B**, which also accepted it.

## Earlier in the session

- First run: a new code was exchanged for a token (200 OK), and **Service A → Create Payment** returned `pay-postman-1`, `SUCCESS`.
