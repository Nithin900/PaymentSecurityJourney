# Interview prep: explaining the project

## What I did (10 lines)

1. Designed OAuth2 + JWT security for the payment microservices by answering 20 design questions before coding.
2. Built a separate Spring Authorization Server on port 9000 (Boot 3.5.5, Authorization Server 1.5).
3. Configured an in-memory user (`nithin`) and a registered client (`payment-client`) with scopes `payment.read` and `payment.write`.
4. Set up the Authorization Code flow with a login page, consent screen, and RSA-signed JWTs that expire after 5 minutes.
5. Turned Services A (8080) and B (8081) into resource servers that validate JWTs with the issuer's public key.
6. Added scope rules (POST needs `payment.write`, GET needs `payment.read`), stateless sessions, CSRF off.
7. Made Service A forward the caller's JWT to Service B, so both validate it independently.
8. Tested end to end: login, code, token (200 OK), decoded token, payments created and read through A to B.
9. Recorded the browser login flow as a GIF and kept a written test log.
10. Learned the filter chain internals, Spring Security's version history, and how to explain it in an interview.

## 30 seconds

> "I secured my payment microservices with OAuth 2.0 and JWT using Spring Security. I built a separate Authorization Server that logs users in and issues signed JWT access tokens. My two payment services are resource servers: they verify each token's signature with the Authorization Server's public key and check scopes before allowing an operation. Service A forwards the same token to Service B, so both services protect themselves."

## 2 minutes

1. **Problem:** anyone who could reach `/payments` could create a payment. I needed **who** and **what they may do**.
2. **Architecture:** Postman → Auth Server :9000 (login, JWT) → Service A :8080 → same JWT → Service B :8081 → H2.
3. **Getting a token:** Authorization Code flow. The user logs in on the Auth Server's own page, so the client never sees the password; approves scopes; the client exchanges a one-time code plus its own ID and secret for a JWT.
4. **Token contents:** `sub`, `aud`, `iss`, `scope`, 5-minute `exp`, signed with the Auth Server's RSA private key.
5. **Validation:** A and B are resource servers configured with the issuer URL; they download the public key once, cache it, and check signature, issuer and expiry on every request — no call to the Auth Server per request.
6. **Permissions:** create needs `payment.write`, read needs `payment.read`. Missing/invalid token → 401; valid token without the scope → 403.
7. **Service to service:** A forwards the caller's token to B; B validates independently, so bypassing A doesn't help.
8. **Choices:** stateless, CSRF off (bearer tokens, no cookies), short-lived tokens.

## "What would you improve?"

> In-memory users and clients → database; plain secrets → BCrypt; signing key regenerated on restart → persistent key with rotation; refresh tokens; audience restriction per service; client credentials for background jobs.

## Follow-ups

| Question | Answer |
|---|---|
| OAuth vs JWT? | Framework for permission vs token format |
| 401 vs 403? | Unknown identity vs no permission |
| Why a separate auth server? | Payment services never handle passwords |
| How do services trust the token? | Private key signs, public key verifies |
| Why does B validate if A did? | Defense in depth |
| Why short tokens? | Stolen token works only minutes |
| Why `SCOPE_`? | Spring prefixes JWT scopes when mapping to authorities |
| Why "Authorization Server" if it logs people in? | OAuth is an authorization framework; it authenticates in order to authorize |

Tip: run the failure tests first so you can say "no token gives 401, read-only token on POST gives 403".
