# OAuth 2.0 internal + external flow (Telugu + English)

## Part A: mana project lo (Authorization Code)

**3 phases:**
```text
Phase 1: Login + Code    →  browser  ↔  Auth Server (:9000)
Phase 2: Code → Token    →  Postman  ↔  Auth Server (:9000)
Phase 3: Token use       →  Postman  →  Service A (:8080)  →  Service B (:8081)
```

**Phase 1**
1. `GET /oauth2/authorize?...` → Chain ① → `OAuth2AuthorizationEndpointFilter` → bean ④ lo client, redirect_uri, scopes check → user login ledu.
2. `ExceptionTranslationFilter` → browser kabatti `LoginUrlAuthenticationEntryPoint` → **302 /login**. Anduke Auth Server **own login page**.
3. `POST /login` → Chain ② → `UsernamePasswordAuthenticationFilter` → `DaoAuthenticationProvider` → bean ③ → password ✅ → session → original URL ki 302.
4. Chain ① again → `requireAuthorizationConsent(true)` → consent screen.
5. Consent → one-time **code** create → `302 callback?code=...`.

**Phase 2**
6. `POST /oauth2/token` (Basic client:secret + code) → client authenticate (bean ④) → code valid + unused → claims build (`sub`, `aud`, `scope`, `iss` ⑦, `exp` ④) → bean ⑤ private key tho sign, header lo `kid` → access_token.

**Phase 3**
7. Service A: `BearerTokenAuthenticationFilter` → `JwtDecoder` (first time matrame `/jwks` download + cache) → signature, `iss`, `exp` ✅ → `SCOPE_payment.write` → `SecurityContextHolder` → `AuthorizationFilter` ✅ → controller → WebClient.
8. A → B: WebClient filter `SecurityContext` nundi **same JWT** forward chestundi.
9. B anni checks malli chestundi → H2 lo save.

| Ekkada fail | Enduku | Result |
|---|---|---|
| Step 1 | Wrong redirect_uri / scope | Error |
| Step 3 | Wrong password | `/login?error` |
| Step 6 | Wrong secret | 401 `invalid_client` |
| Step 6 | Code reuse / expired | 400 `invalid_grant` |
| Step 7/9 | Token ledu / tampered / expired | **401** |
| Step 7/9 | Scope ledu | **403** |

Gurthu pettukovalsina 3 points: password Auth Server ki matrame · private key sign, public key verify · A and B prathi request ki Auth Server ni call cheyyavu.

---

## Part B: General OAuth 2.0 (example: PhotoPrint app → Google Photos)

| Role | Example | Pani |
|---|---|---|
| Resource Owner | Nuvvu | Data nee di |
| Client | PhotoPrint | Photos kavali |
| Authorization Server | Google Accounts | Login + permission + token |
| Resource Server | Google Photos API | Token check chesi data istundi |

### External flow (Authorization Code + PKCE)

```text
① Client → browser redirect to /authorize (client_id, scope, redirect_uri, state, code_challenge)
② login page   ③ consent "Allow photos?"
④ redirect_uri?code=ABC&state=xyz          ← FRONT channel (browser): code matrame
⑤ Client → POST /token: code + code_verifier + client secret   ← BACK channel (server-to-server)
⑥ access_token + refresh_token
⑦ GET /photos  Bearer token   ⑧ photos
```

### Internal flow (prathi party lopala)

- **① Client:** random `state` save; random `code_verifier` → SHA-256 → `code_challenge` pampistundi, verifier daachi pedutundi.
- **①→③ Auth Server:** client_id registered? redirect_uri exact? scopes allowed? (redirect_uri tappu → redirect cheyyadu, error page). User login ledu → login page → session. Consent → approved scopes save.
- **④ Auth Server:** one-time code save: `{user, client, scopes, redirect_uri, code_challenge, expires}`.
- **④ Client:** returned `state` == saved `state`? kakapote reject.
- **⑤→⑥ Auth Server:** client authenticate · code exist + unexpired + **unused** (reuse → attack, tokens revoke) · same client/redirect_uri · **PKCE: `SHA256(verifier) == challenge`** · token create (JWT: claims + private key sign; opaque: random string + DB) · refresh token save.
- **⑦→⑧ Resource Server (JWT):** `kid` → public key (cache) → signature (401) → `iss` (401) → `exp` (401) → `aud` (401) → scope (403) → data.
- **Opaque token:** `POST /introspect` → `{active: true, scope, sub}`; prathi request ki network call, kaani instant revoke.

### Refresh flow
Client → `POST /token grant_type=refresh_token` → valid? revoke kaaleda? same client? → kotta access token (+ rotation unte kotta refresh token, old invalid).

### Client Credentials (user lekunda)
Service → `POST /token grant_type=client_credentials` + client_id/secret → token (`sub` = service peru). Login, consent, code emi levu.

### Ee pieces enduku

| Piece | Em aagutundi |
|---|---|
| Password Auth Server ki matrame | Client ki leak avvadu |
| Front channel lo code, token kaadu | Browser history/logs lo token leak avvadu |
| PKCE | Dongilinchina code useless |
| `state` | Fake redirect (CSRF) |
| Exact redirect_uri | Code attacker site ki vellakunda |
| Client secret at /token | Evaraina app code exchange cheyyalekapovadam |
| One-time code | Replay |
| Short access token | Dongilinchina token konchem sepu matrame |
| Signature | Token marchalekapovadam |
| Scopes | Kavalsinantha permission matrame |
