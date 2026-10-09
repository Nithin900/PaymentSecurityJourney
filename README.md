# Payment Security Journey

Four Spring Boot services that take a payment from login to confirmation email, secured end to end with OAuth 2.0 and JWT.

🌐 **[Live explainer site](https://nithin900.github.io/PaymentSecurityJourney/)**: one real request traced hop by hop through this code.

### What this project demonstrates

- **Spring Authorization Server** issuing RS256-signed JWTs (authorization code flow for users, client credentials for service-to-service)
- **Scope-based authorization** per HTTP method (`payment.read` / `payment.write` / `notification.send`)
- **Resource ownership** from the token's `sub`: another user's payment returns 404, not 403
- **Zero trust between services**: Service B re-validates every token instead of trusting the gateway
- **Resilience**: WebClient connect/response timeouts, 503 when downstream is down, email failure never fails a payment
- **One error contract** across services (400 / 404 / 409 / 502 / 503) via `GlobalExceptionHandler`
- **Tested**: 25+ end-to-end checks with real logins and tokens, plus unit tests with `@MockitoBean`

---

Everything below (build, start, test, stop, debug) is done from **PowerShell**. No Postman needed.

Stack: Spring Boot 3.5.5 · Spring Security 6.5 · Spring Authorization Server 1.5 · Java 17

```text
You ──login──► Auth Server :9000 ──JWT──► You
You ──Bearer JWT──► Service A :8080 ──same JWT──► Service B :8081 ──► H2 (file DB)
                                                   │ after commit, own client_credentials JWT
                                                   ▼
                                     Notification Service :8082 ──► Gmail SMTP ──► email
```

| Module | Port | Role |
|---|---|---|
| `payment-authorization-server` | 9000 | OAuth2/OIDC Authorization Server: login, consent, issues JWTs |
| `payment-service-b` | 8081 | Payment persistence (JPA + H2), enforces ownership, triggers the email |
| `payment-service-a` | 8080 | Gateway, forwards the caller's token to B |
| `NotificationService` | 8082 | Sends the "payment created" email over SMTP |

Users (auth server login): **`nithin` / `password`** and **`alice` / `password`**. OAuth client: `payment-client` / `secret`. Service B's own client: `payment-service-b` / `b-secret` (scope `notification.send`).

---

## 1. Quick start (copy, paste, done)

Open **PowerShell** in the repo root (`PaymentMicroService`).

```powershell
# 0. One-time check: Java 17 and Maven must be found
java -version        # must say 17
mvn -v               # must print a Maven version

# 1. Build everything once (A depends on B's jar, so this must happen before the first start)
mvn clean install -DskipTests

# 2. Start all four services (order: auth -> B -> A -> notification; waits for each port)
.\scripts\start-all.ps1

# 3. Run the full test (real login, tokens, 25+ checks)
.\scripts\test-all.ps1

# 3b. Optional: send a test payment (asks for the auth code; triggers the email)
.\scripts\send-test-payment.ps1

# 4. Stop everything
.\scripts\stop-all.ps1
```

Type each command exactly as shown, from the repo root, with nothing after it (no trailing `:`). `start-all.ps1` ends by printing the auth server login and authorize links.

If `test-all.ps1` ends with `Result: N passed, 0 failed` the whole system works. A failing check prints what it got and which **Troubleshooting** entry below to read.

If PowerShell blocks the scripts ("running scripts is disabled"), allow them for this window only:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

### What `start-all.ps1` does

- Starts each module with `mvn spring-boot:run -pl <module>` as a hidden background process.
- Uses profiles `dev,local` unless `SPRING_PROFILES_ACTIVE` is already set:
  - `dev`: auth server signs tokens with an in-memory key (no keystore needed, **tokens die when the auth server restarts**) and Service B's H2 console is on.
  - `local`: loads `NotificationService/src/main/resources/application-local.yaml` (Gmail credentials, git-ignored).
- Logs: `scripts\logs\<module>.log` (and `.log.err`). PIDs: `scripts\pids.json`.

### Email setup (Notification Service)

Real SMTP is used (Gmail), not a fake inbox. Create `NotificationService/src/main/resources/application-local.yaml` (it is git-ignored, never commit it):

```yaml
spring:
  mail:
    username: YOUR_GMAIL@gmail.com
    password: YOUR_16_CHAR_APP_PASSWORD      # a Gmail App Password, NOT your normal password
notification:
  from: YOUR_GMAIL@gmail.com                 # must equal spring.mail.username for Gmail
  recipient: WHO_SHOULD_RECEIVE@example.com  # every notification goes to this one address in dev
```

Get an App Password at <https://myaccount.google.com/apppasswords> (needs 2-Step Verification on). Without this file, the payment flow still works; only the email step fails (and is logged as a warning by B).

---

## 2. Everything in PowerShell

### Start one service only

```powershell
mvn spring-boot:run -pl payment-authorization-server "-Dspring-boot.run.profiles=dev"
mvn spring-boot:run -pl payment-service-b            "-Dspring-boot.run.profiles=dev"
mvn spring-boot:run -pl payment-service-a
mvn spring-boot:run -pl NotificationService          "-Dspring-boot.run.profiles=dev,local"
```

Each blocks its terminal; use one window per service, `Ctrl+C` to stop. The quotes around `-D...` are required in PowerShell.

### Is it up?

```powershell
# listening ports
Get-NetTCPConnection -State Listen -LocalPort 9000,8081,8080,8082 | Select-Object LocalPort, OwningProcess

# expected status per service: 200, 401, 401, 401 (401 = running and protected)
foreach ($u in "http://localhost:9000/.well-known/openid-configuration","http://localhost:8080/payments","http://localhost:8081/payments","http://localhost:8082/notifications") {
  try { $c = (Invoke-WebRequest $u -UseBasicParsing).StatusCode } catch { $c = $_.Exception.Response.StatusCode.value__ }
  "$c  $u"
}
```

### Watch logs

```powershell
Get-Content .\scripts\logs\payment-service-b.log -Wait -Tail 40        # live
Select-String -Path .\scripts\logs\*.log* -Pattern "ERROR|Exception" | Select-Object -Last 20
```

### Interactive email test (asks for everything)

```powershell
.scripts
otify-test.ps1
```

First the auth code (it opens the login page and tells you where to copy `code=` from; it is exchanged for a token straight away), then the sender Gmail, its App Password (hidden) and the recipient Gmail. It restarts only the notification service with those values, creates a payment through A and B, then reports whether the email was sent. Nothing is written to disk. Needs `start-all.ps1` running first.

### Unit tests (Maven, no servers needed)

```powershell
mvn test -pl NotificationService        # mock mail sender + mock JWT decoder; checks 401 / 403 / 200 / 400 / 502
mvn test                                # every module
```

### Do the login + call by hand (what `test-all.ps1` automates)

The login needs a browser once (the script drives the same pages itself). To make one payment by hand:

```powershell
# 1) open this URL in a browser, log in as nithin / password, approve, then copy the `code=` value
#    http://localhost:9000/oauth2/authorize?response_type=code&client_id=payment-client&scope=payment.read%20payment.write&redirect_uri=https://oauth.pstmn.io/v1/callback
$code = "PASTE_CODE_HERE"      # single use, expires fast
$cred = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("payment-client:secret"))
$tok  = (Invoke-RestMethod -Method Post http://localhost:9000/oauth2/token `
          -Headers @{ Authorization = "Basic $cred" } `
          -Body @{ grant_type="authorization_code"; code=$code; redirect_uri="https://oauth.pstmn.io/v1/callback" }).access_token

$h = @{ Authorization = "Bearer $tok" }
Invoke-RestMethod -Method Post http://localhost:8080/payments -Headers $h -ContentType "application/json" `
  -Body '{"paymentId":"MANUAL-1","accountNumber":"acc-123","amount":25.00}'
Invoke-RestMethod http://localhost:8080/payments/MANUAL-1 -Headers $h
Invoke-RestMethod http://localhost:8080/payments          -Headers $h
```

The token lasts 5 minutes.

### Machine-to-machine token (Service B → Notification)

```powershell
$cred = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("payment-service-b:b-secret"))
Invoke-RestMethod -Method Post http://localhost:9000/oauth2/token -Headers @{ Authorization = "Basic $cred" } `
  -Body @{ grant_type="client_credentials"; scope="notification.send" }
```

---

## 3. What the test script checks

| Section | Checks |
|---|---|
| 0 Health | all four services answer (auth 200, others 401 without a token) |
| 1 Tokens | real authorization-code login as nithin, alice and a read-only nithin; `sub` and scopes inside the JWT |
| 2 Service A | no/garbage token → 401; create → 200; get and list; alice sees 404 and an empty list (ownership); duplicate → 409; negative amount → 400; malformed JSON → 400 `MALFORMED_REQUEST_BODY`; unknown route → 404 `NOT_FOUND`; read-only token POST → 403 and GET → 200 |
| 3 Service B direct | owner 200, other user 404, no token 401 (B never trusts A) |
| 4 Notification | no token 401; user token without `notification.send` 403; B can get its client-credentials token; B's log shows it asked for the email |

Each run uses a fresh payment id (`PS-<timestamp>`), so runs don't collide. Stop B or the notification service first and re-run to see failures: a payment must still succeed when only the email fails.

---

## 4. Troubleshooting (when something goes wrong)

General method, in this order:

1. **Read the failing line** of `test-all.ps1` (`got:` shows the real status/body) and find its entry below.
2. **Read the log of the service involved**: `Get-Content .\scripts\logs\<module>.log -Tail 80` and the matching `.log.err`.
3. **Restart clean**: `.\scripts\stop-all.ps1`, then `.\scripts\start-all.ps1`, then `.\scripts\test-all.ps1`.

### Start-up problems

| Symptom | Cause and fix |
|---|---|
| `mvn` / `java` not recognized | Install JDK 17 and Maven, reopen PowerShell, check `java -version` and `mvn -v`. |
| `start-all.ps1`: *"X did not open port N in time"* | Open `scripts\logs\X.log` and `.log.err`; the last `ERROR` / `Caused by` is the reason. Common ones are in this table. |
| *Port N already in use* | Something else (often a previous run) holds it. Find it: `Get-NetTCPConnection -LocalPort 8080 -State Listen \| Select OwningProcess`, then `Stop-Process -Id <pid> -Force`. Or run `.\scripts\stop-all.ps1`. If `pids.json` is stale, kill by port as above. |
| Service A: *Could not find artifact com.payment:payment-service-b* / cannot resolve dependency | A compiles against B. Run `mvn clean install -DskipTests` from the repo root once (it installs B's jar). |
| Auth server: *Could not resolve placeholder 'KEYSTORE_PATH'* | It started without the `dev` profile. Use `start-all.ps1` (sets `dev`), or set `$env:SPRING_PROFILES_ACTIVE="dev,local"`, or provide `KEYSTORE_PATH` + `KEYSTORE_PASSWORD` (see "Profiles"). |
| Notification service: mail or placeholder errors at boot | `application-local.yaml` missing or profile `local` not active. See "Email setup". |
| `running scripts is disabled on this system` | `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` |
| `start-all.ps1` leaves processes running after an error | `.\scripts\stop-all.ps1` (it also kills anything left on ports 9000, 8081, 8080, 8082). |
| *"The term '.\scripts\start-all.ps1:' is not recognized as the name of a cmdlet"* | A typo: there is a trailing colon (or other extra character) after the command. Type exactly `.\scripts\start-all.ps1` with nothing after it. |
| `stop-all.ps1`: *"No pids.json found"* | Not an error: the services were not started by `start-all.ps1`, or are already stopped. The script then stops whatever listens on ports 9000, 8081, 8080, 8082, so services started by hand are stopped too. |
| *"The term 'scripts/xxx.ps1' is not recognized"* or *cannot find path* | Wrong folder. `cd` to the repo root (the folder containing `scripts`, `pom.xml`, `README.md`) and start scripts with `.\`. |
| Build fails with compile errors in B about `io.netty` | `payment-service-b/pom.xml` needs `reactor-netty-http`; run `mvn clean install -DskipTests` and read the first error. |

### A service is not reachable / wrong status

`test-all.ps1` stopped at section 0. Wrong-status clues:

- **`HTTP 0`**: nothing listening. Start it, check its log.
- **Auth server not 200**: open `scripts\logs\payment-authorization-server.log.err`.
- **Another service returns 200 instead of 401**: security config not loaded; check for `SecurityConfig` errors at boot.

### Login or token step fails

| Message | Meaning and fix |
|---|---|
| `authorize did not redirect to login` | Auth server not the one on :9000, or `payment-client` missing. Restart auth server. |
| `no CSRF token on the login page` | The login page changed or a different server answered on :9000. Open `http://localhost:9000/login` in a browser. |
| `login rejected for <user>` | Wrong user/password. Only `nithin` and `alice`, password `password`. |
| `neither a code nor a consent page` | Redirect URI must be exactly `https://oauth.pstmn.io/v1/callback` (it is registered on the client). |
| `token endpoint returned 401` | Client secret wrong; must be `payment-client` / `secret`. |
| Everything worked yesterday, now 401 everywhere | **The dev signing key is regenerated on every auth-server restart.** Old tokens are invalid, and A/B may have cached the old key. Restart A and B too (`stop-all` then `start-all`), then get new tokens (the script does). |

### 401 or 403 where it should not be

- **401 on a call with a valid token**: token expired (lifetime 5 min, just re-login) or the signing key changed (see above). Confirm the issuer: `Invoke-RestMethod http://localhost:9000/.well-known/openid-configuration` must say `http://localhost:9000`.
- **403 on POST with a write token**: decode the token; scope must include `payment.write`. Inspect it:
  ```powershell
  $p = $tok.Split(".")[1].Replace("-","+").Replace("_","/"); while ($p.Length % 4) { $p += "=" }
  [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($p)) | ConvertFrom-Json
  ```
- **Read-only token gets 200 on POST**: scope rules in A's `SecurityConfig` are wrong (POST needs `SCOPE_payment.write`, GET needs `SCOPE_payment.read`).
- **Garbage token gets something other than 401**: check the resource server's `issuer-uri` property.

### Create payment does not return 200

Read the body printed after `got:`.

| Status | Likely cause |
|---|---|
| **503 PAYMENT_SERVICE_UNAVAILABLE** | A cannot reach B (down, or slower than the 3 s timeout). Check B is on :8081 and its log. |
| **500** | Open `payment-service-b.log` for the stack trace. A stale H2 file from an older schema is a frequent cause: stop everything, delete `payment-service-b\data\`, start again (H2 recreates it). |
| **401/403 from B via A** | A forwards the same token; check B's log for `Invalid` / `Insufficient` messages. |

### Ownership check fails

- **alice sees nithin's payment**: B's `PaymentServiceImpl` must filter by the token's `sub` (`findByOwner`).
- **Nobody can see old payments**: rows saved before ownership was added have `owner = NULL`. Delete `payment-service-b\data\` or run `UPDATE PAYMENTS SET OWNER='nithin' WHERE OWNER IS NULL;` in the H2 console (`http://localhost:8081/h2-console`, JDBC `jdbc:h2:file:./data/paymentdb`, user `sa`, password `password`; dev profile only).

### 409 / 400 / 404 error mapping is wrong

The mapping lives in `GlobalExceptionHandler` in A and B. Expected: duplicate id 409, validation 400, malformed JSON 400 `MALFORMED_REQUEST_BODY`, unknown route 404 `NOT_FOUND`, not found or not yours 404. A passes B's status through. If you get 500 instead, read the exception name in the log and check the matching handler exists.

### Notification service: 401 / 403 / 502

| Result | Meaning and fix |
|---|---|
| no-token call not 401 | Notification `SecurityConfig` not applied; check its boot log. |
| user token not 403 | `POST /notifications` must require `SCOPE_notification.send`; user tokens only have `payment.*`. |
| **502 NOTIFICATION_FAILED** | Notification service reached the SMTP server and failed (next section). |
| 401 with a valid B token | Notification service's `issuer-uri` must be `http://localhost:9000`; restart it after restarting the auth server. |

### B cannot get its notification token

`payment-service-b` / `b-secret` with scope `notification.send` must be registered in the auth server (it is, in `SecurityConfig`). If the call returns `invalid_client`, the secret differs; `invalid_scope` means the client lost the `notification.send` scope. Properties are in `payment-service-b/src/main/resources/application.properties` (`spring.security.oauth2.client.registration.notification.*`).

### Payment works but no email arrives

A failed email never fails a payment; B only logs a warning. Look for it:

```powershell
Select-String .\scripts\logs\payment-service-b.log -Pattern "notification could not be sent|Notification requested" | Select-Object -Last 5
Select-String .\scripts\logs\NotificationService.log* -Pattern "ERROR|MailSend|Authentication" | Select-Object -Last 10
```

| Log says | Fix |
|---|---|
| `notification could not be sent: Connection refused` | Notification service is down; start it (port 8082). |
| `401` / `403` from notification | See the section above; token or scope problem. |
| `MailAuthenticationException` / `535 Username and Password not accepted` | Gmail rejected the login. Use a **16-character App Password**, not the account password, and `spring.mail.username` must be the same account as `notification.from`. |
| `MailConnectException` / timeout to `smtp.gmail.com:587` | Network or firewall blocks port 587. Test: `Test-NetConnection smtp.gmail.com -Port 587`. |
| Nothing logged, no email | Check the spam folder and the `notification.recipient` address in `application-local.yaml`. If the file is missing, mail username/password are empty. |
| `Notification requested for payment ...` is logged, but no mail | Notification service accepted it; read `NotificationService.log` for the SMTP error. |

### Unit test failures (`mvn test -pl NotificationService`)

- Uses `@MockitoBean` for `JavaMailSender` and `JwtDecoder`, so no mail server and no auth server are needed. A failure here is a code problem, not an environment one; read `NotificationService\target\surefire-reports\*.txt`.
- `Unable to find a @SpringBootConfiguration` / context load errors: run from the repo root with `-pl NotificationService`, and check the `spring.mail.host` property exists (without it there is no `JavaMailSender` bean).

### Last resort: full reset

```powershell
.\scripts\stop-all.ps1
Get-NetTCPConnection -State Listen -LocalPort 9000,8081,8080,8082 -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }     # kill anything left on the ports
Remove-Item .\payment-service-b\data -Recurse -Force -ErrorAction SilentlyContinue   # wipe the H2 database
Remove-Item .\scripts\logs\* -Force -ErrorAction SilentlyContinue
mvn clean install -DskipTests
.\scripts\start-all.ps1
.\scripts\test-all.ps1
```

---

## 5. Profiles: `dev` vs default

| | `dev` (local) | default (anything else) |
|---|---|---|
| Auth server signing key | Generated in memory at startup, so **tokens stop working after an auth-server restart** | Loaded from a PKCS12 keystore. Needs `KEYSTORE_PATH` (e.g. `file:C:/keys/securepay.p12`) and `KEYSTORE_PASSWORD`; key alias must be `securepay` |
| Service B H2 console | On at `http://localhost:8081/h2-console` | Off |

Create a local keystore for the default profile:

```powershell
keytool -genkeypair -alias securepay -keyalg RSA -keysize 2048 -storetype PKCS12 -keystore securepay.p12 -storepass changeit -keypass changeit -dname "CN=securepay" -validity 365
$env:SPRING_PROFILES_ACTIVE = "local"
$env:KEYSTORE_PATH = "file:C:/full/path/securepay.p12"
$env:KEYSTORE_PASSWORD = "changeit"
.\scripts\start-all.ps1
```

---

## 6. How the project works

Only the **Authorization Server** issues tokens; A, B and the Notification service only check them.

1. **Log in.** The client sends the user to `/oauth2/authorize`; the user logs in and approves `payment.read` / `payment.write`. The one-time code is swapped at `/oauth2/token` for a signed **JWT** (RS256, 5 min). `sub` is the username.
2. **Service A** validates the JWT against the auth server's JWKS. `POST` needs `SCOPE_payment.write`, `GET` needs `SCOPE_payment.read`.
3. **A forwards the same token to B** (`WebClient`, 2 s connect and 3 s response timeouts). B is the only service that touches the database.
4. **B enforces ownership.** It validates the JWT again, stores the caller's `sub` as `owner`, and only returns payments the caller owns (others get 404).
5. **After the payment commits, B calls the Notification service** with its own `client_credentials` token (scope `notification.send`). The Notification service renders the HTML template and sends the email. If that fails, the payment is still saved; B only logs a warning.
6. **Errors are mapped consistently**: 400 validation, 404 not found, 409 duplicate, 503 when B is unreachable from A, 502 when the mail server fails.

| Concern | Where |
|---|---|
| Token issue, login, consent, signing key | `payment-authorization-server` → `Config/SecurityConfig.java` |
| Scope rules per method | `SecurityConfig` in A, B and the Notification service |
| Token relay + timeouts | A → `Config/WebClientConfig.java` |
| Ownership | B → `Entity/Payment`, `Repository/PaymentRepository`, `Service/PaymentServiceImpl` |
| Email trigger (after commit) | B → `Notification/NotificationListener.java`, `Config/NotificationClientConfig.java` |
| Email sending + template | `NotificationService` → `Service/EmailNotificationService.java`, `resources/Templates/NotificationTemplate.html` |
| Error mapping | `GlobalExceptionHandler` in each service |

---

## Known limits

- **Old rows have no owner.** Payments saved before ownership was added have `owner = NULL`, so nobody can see them. Delete `payment-service-b/data/` (H2 recreates it) or run `UPDATE PAYMENTS SET OWNER='<username>' WHERE OWNER IS NULL;` in the H2 console.
- **`sub` must be the user.** Ownership uses the token's `sub`. A client-credentials token has `sub = <client id>`, so a payment made that way belongs to the client, not a person (relevant for the coming `settlement-job`).
- **Local-only security shortcuts:** `User.withDefaultPasswordEncoder()`, in-memory users and clients, and a fixed `secret` client password. Fine for learning, not for production.
- **Service A depends on service B's classes** (it reuses `org.example.Exceptions.PaymentNotFoundException`), so A's build needs B's module.

## Docs (read in order)

| # | File | What |
|---|---|---|
| 01 | [Overview and design decisions](docs/01-overview-and-design-decisions.md) | Architecture, Q1–Q20, results, gaps |
| 02 | [Authorization Server requirements](docs/02-authorization-server-requirements.md) | Epic 1 stories, FRs, UML, acceptance criteria |
| 03 | [Resource servers requirements](docs/03-resource-servers-requirements.md) | Service A/B, token relay, error passthrough |
| 04 | [Spring Security big picture](docs/04-spring-security-big-picture.md) | Filter chain, authentication, authorization, 401/403 |
| 05 | [Auth Server methods explained](docs/05-auth-server-methods-explained.md) | Every bean and method |
| 06 | [Testing guide](docs/06-testing-guide.md) | Manual flow, Postman, logs, 21 test cases |
| 07 | [Test session log](docs/07-test-session-log.md) | Recorded run on 23 Sep |
| 08 | [OAuth 2.0 complete notes](docs/08-oauth2-complete-notes.md) | 5 phases: data points → trade-offs → interview |
| 09 | [OAuth internal flow (Telugu)](docs/09-oauth2-internal-flow-telugu.md) | Project flow + general flow |
| 10 | [Spring Security versions (Maltz)](docs/10-spring-security-versions-maltz.md) | Acegi → 7.x through Psycho-Cybernetics |
| 11 | [Client credentials + settlement](docs/11-client-credentials-and-settlement.md) | Design, requirements, LLD |
| 12 | [JWT validation](docs/12-jwt-validation.md) | Internal working, Java code |
| 13 | [RestTemplate vs Feign vs WebClient](docs/13-rest-clients-comparison.md) | Sync/async comparison |
| 14 | [Interview prep](docs/14-interview-prep.md) | 10 lines, 30 s, 2 min, follow-ups |
| 15 | [Claude Code mentor prompt](docs/15-claude-code-mentor-prompt.md) | Prompt to learn implementation |
| 16 | [Resource server + client methods explained](docs/16-resource-server-and-client-methods-explained.md) | Service A/B and settlement-job, method by method |
| 17 | [Explanation style prompt](docs/17-explanation-style-prompt.md) | Reusable prompt to get the same explanation style again |

## Site

`site/index.html` — one site with 9 interactive explorers (Full request journey, Spring Security, Spring Core, Boot, MVC, Data JPA, Cloud, Kafka, Observability; 131 scenarios), plus `site/learn.html` (**Spring interview study guide**: the 4-question method, 11 topics with code snippets, 60-second answers, self-check, links into the explorer), `site/wire.html` (**Dissect a request**: real HTTP messages hop by hop — Login with Google, token from the Auth Server, calling Service B, bytes → Java → SQL → bytes — every piece explained, plus a dissector for your own URLs / JWTs / headers), `site/dev.html` (**Build it**: developer questions per concept → SecurePay answer → which class you write / what you configure, plus a feature checklist and a worked refund example), `site/sky.html` (**Spring Security Sky**: the whole Spring Security family as word clouds, with definition, interview answer and build per concept), `site/decisions.html` (**Spring Security Decision Map**: 8 decisions → use cases → Spring pieces, the interview pattern), `site/compare.html` (**Java vs Spring vs Boot**: who does what for 15 common tasks, a release timeline, compatibility and upgrade gotchas), `site/securepay.html` (**Build SecurePay**: this project built step by step in 6 phases — guess the next step, then files, code, verify and interview line; ✓ done / ○ to do), `site/payment-journey.html` (**Payment Security Journey**: this project's real code, end to end. One live payment request stepped through A → B → H2 with the data changing at every step in 5 scenarios — create 200, alice 404, no token 401, read-only 403, B down 503 — then every class and method, why it was written, data at each hop, the error map, profiles and testing), `site/pictures.html` and `site/poster.html`. Open `site/index.html` in a browser. Rebuild: `cd skills/concept-explorer && python3 build_site.py`.

### On your phone (works offline)

The site is an installable web app (PWA). One-time setup:
1. GitHub repo → Settings → Pages → Source: **GitHub Actions** (Pages on a private repo needs a paid plan; otherwise make the repo public).
2. Push to main → the workflow `.github/workflows/pages.yml` publishes `site/` to `https://nithin900.github.io/PaymentSecurityJourney/`.
3. Open that link on the phone once:
   - Android (Chrome): ⋮ → **Install app** / Add to Home screen.
   - iPhone (Safari): Share → **Add to Home Screen**.
4. It now opens like an app and works offline (a service worker caches all pages). When online it loads the newest version.

## Other code snapshots

| Path | What |
|---|---|
| `code/auth-server/SecurityConfig-yours-2026-09-25.java` | Your own Auth Server config |
| `code/auth-server/SecurityConfig-annotated.java` | Same design, fully commented with flowcharts |
| `code/auth-server/SecurityConfig-with-client-credentials.java` | Adds `reporting-client` and `settlement-job` |
| `code/auth-server/pom.xml` | Boot 3.5.5 pom |
| `code/service-b/settlement-changes.md` | Service B changes for settlement (check ASSUMPTIONS) |
| `code/settlement-job/` | New client-credentials app (not compiled yet) |
| `skills/concept-explorer/` | My learning-method skill + reusable explorer template |
| `tracker/security-tracker.html` | Offline copy of the progress tracker |
| `tracker/security-in-pictures.html` | 12 concepts drawn as screens + numbered arrows |

## Way of working

Claude gives stories, requirements, UML and acceptance criteria → I implement → Claude reviews like a PR.
