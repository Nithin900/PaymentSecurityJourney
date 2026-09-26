# JWT validation: internal working (25 Sep)

From the chat "JWT validation and internal working".

## 1. Structure
```
Header.Payload.Signature
```
- Header: `{"alg":"HS256","typ":"JWT"}`
- Payload: claims, e.g. `{"sub":"123","exp":1727280000}`
- Signature: header + payload signed with a secret / private key

Header and payload are only **Base64URL encoded**, not encrypted. Never put passwords in the payload.

## 2. Signing
```
data      = base64url(header) + "." + base64url(payload)
signature = HMAC_SHA256(data, secretKey)      // HS256
token     = data + "." + base64url(signature)
```
RS256: sign with the **private key**, verify with the **public key**.

## 3. Validation steps
1. **Split and decode:** must be 3 parts.
2. **Algorithm check:** must match what the server expects. Never trust the header blindly (`alg: none`, RS256→HS256 algorithm-confusion attack).
3. **Signature verify:** recompute and compare with **constant-time comparison**. One changed character breaks the signature.
4. **Claims:** `exp` (now < exp), `nbf`, `iat`, `iss` (our auth server), `aud` (our API); 30–60 s leeway.
5. **Optional:** revocation (`jti` blacklist), user still active.

## 4. Manual Java validation (learning only)
```java
public JsonNode validate(String token) throws Exception {
    String[] parts = token.split("\\.");
    if (parts.length != 3) throw new SecurityException("Invalid token format");

    Base64.Decoder dec = Base64.getUrlDecoder();
    JsonNode header  = mapper.readTree(dec.decode(parts[0]));
    JsonNode payload = mapper.readTree(dec.decode(parts[1]));

    if (!"HS256".equals(header.path("alg").asText()))
        throw new SecurityException("Unexpected algorithm");

    Mac mac = Mac.getInstance("HmacSHA256");
    mac.init(new SecretKeySpec(secret, "HmacSHA256"));
    byte[] expected = mac.doFinal((parts[0] + "." + parts[1]).getBytes(StandardCharsets.US_ASCII));
    byte[] received = dec.decode(parts[2]);
    if (!MessageDigest.isEqual(expected, received))   // constant time; not Arrays.equals
        throw new SecurityException("Invalid signature");

    long now = System.currentTimeMillis() / 1000, leeway = 60;
    if (payload.has("exp") && now > payload.get("exp").asLong() + leeway)
        throw new SecurityException("Token expired");
    if (payload.has("nbf") && now + leeway < payload.get("nbf").asLong())
        throw new SecurityException("Token not active yet");
    if (!"auth.myapp.com".equals(payload.path("iss").asText()))
        throw new SecurityException("Invalid issuer");
    return payload;
}
```

## 5. Production: JJWT 0.12.x
```java
public Claims validate(String token) {
    return Jwts.parser()
        .verifyWith(key)                  // signature + algorithm fixed by key type
        .requireIssuer("auth.myapp.com")
        .requireAudience("api.myapp.com")
        .clockSkewSeconds(60)
        .build()
        .parseSignedClaims(token)         // rejects unsigned (alg: none)
        .getPayload();
}
```
`jwt.decode()`-style methods only decode; always **verify**.

## 6. Spring Boot: let Spring do it
```yaml
spring.security.oauth2.resourceserver.jwt.issuer-uri: https://auth.myapp.com
```
Spring fetches JWKS, verifies every `Authorization: Bearer` header; controllers read claims with `@AuthenticationPrincipal Jwt jwt`.

## 7. Custom filter version (incoming requests)
A `OncePerRequestFilter` reads `Authorization: Bearer`, validates, puts an `Authentication` in `SecurityContextHolder`, or returns 401. Register with `addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)`, stateless sessions, CSRF off. (With OAuth2 resource server you don't need this; it's how it works underneath.)

"Correct" token = format ✓ signature ✓ algorithm ✓ expiry ✓ issuer/audience ✓ (+ optional revocation). jwt.io only decodes.

## 8. JWT and OAuth / OIDC
- OAuth 2.0 = framework (authorization). JWT = token format. Access token may be JWT or opaque.
- **OIDC** adds authentication: **ID token** (always JWT, for the client) + access token (for APIs) + refresh token.
- External issuers use **RS256**; APIs get public keys from **JWKS**, pick by `kid`; check `iss` and `aud`; opaque tokens → **introspection**.
- Common mistake: using the access token as login proof, or sending the ID token to APIs.

| Token | Purpose | Format | Used by |
|---|---|---|---|
| ID token | who the user is | always JWT | client |
| Access token | API permission | JWT or opaque | resource server |
| Refresh token | new access tokens | usually opaque | client |
