# Payment Security Journey

Learning journal for securing **SecurePay** — payment microservices with Spring Security, OAuth 2.0 and JWT.
Covers 21–26 Sep 2026.

```text
Postman ──login──► Auth Server :9000 ──JWT──► Postman
Postman ──Bearer JWT──► Service A :8080 ──same JWT──► Service B :8081 ──► H2
Settlement Job ──client credentials JWT──► Service B          (next step)
```

Stack: Spring Boot 3.5.5 · Spring Security 6.5 · Spring Authorization Server 1.5 · Java 17

## Where I am (26 Sep)

- ✅ Authorization Server built and tested (Authorization Code, consent, RS256, JWKS)
- ✅ Services A and B validate JWTs with scope rules; token relay A → B works
- ⏳ Failure tests (401/403 paths) not run yet
- ⏳ Client credentials: `reporting-client` (Postman) → then `settlement-job`
- Honest progress: about 27% of the full Spring Security list (see `tracker/`)

## Modules

Three Spring Boot modules built and versioned together via a single parent `pom.xml`:

| Module | Port | Role |
|---|---|---|
| `payment-authorization-server` | 9000 | OAuth2/OIDC Authorization Server - login, consent, issues JWTs |
| `payment-service-b` | 8081 | Payment persistence (JPA + H2) - OAuth2 Resource Server |
| `payment-service-a` | 8080 | Payment gateway - OAuth2 Resource Server, calls into service-b |

**Start `payment-authorization-server` first.** The other two validate JWTs against its `issuer-uri` (`http://localhost:9000`) and will work even if it's briefly unreachable at boot, but you need it running to actually get a token.

Login credentials for the authorization server (`http://localhost:9000/login`): **`nithin` / `password`**.

## Running it

### Way 1 - Launcher script (recommended)

One command starts all three, in the correct order, and waits for each port to open before starting the next:

```powershell
.\scripts\start-all.ps1
```

Logs go to `scripts\logs\<module>.log`. Stop everything with:

```powershell
.\scripts\stop-all.ps1
```

Use this for day-to-day running/testing. It's the only method that starts all three with a single command.

### Way 2 - Maven, one module at a time

Useful when you only need one or two services, or want to watch a single service's console output directly.

From the repo root, target a module with `-pl` (don't run `mvn spring-boot:run` bare from the root - it's just the aggregator pom and has no main class):

```powershell
mvn spring-boot:run -pl payment-authorization-server
```

Open a **separate terminal per service** (each blocks the terminal while running) and start the others the same way, in order:

```powershell
mvn spring-boot:run -pl payment-service-b
mvn spring-boot:run -pl payment-service-a
```

Equivalently, `cd` into a module directory and run its wrapper directly:

```powershell
cd payment-authorization-server
.\mvnw.cmd spring-boot:run
```

Stop each with `Ctrl+C` in its terminal.

### Way 3 - Run/Debug from IntelliJ IDEA

Best when you want breakpoints, hot-reload, or to step through code.

1. Open the repo root in IntelliJ (it should auto-import as a multi-module Maven project - if not, right-click the root `pom.xml` → **Add as Maven Project**).
2. For each module, open its `*Application.java` main class and click the green **Run** (or **Debug**) arrow next to `main`:
   - `payment_authorization_server/PaymentAuthorizationServerApplication.java`
   - `org.example/PaymentServiceAppliaction.java` (service-b)
   - `com.example.PaymentA/PaymentAApplication.java` (service-a)
3. Start them in the same order as above (auth-server → service-b → service-a). Each opens as its own Run tab, so you get separate console output and can restart one without touching the others.

### Testing the OAuth2 flow

See `postman/PaymentMicroService.postman_collection.json` - import it into Postman for the full manual login → consent → token → payment walkthrough, plus ready-to-run requests against both services.

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
| `postman/` | Postman collection for the OAuth2 flow |
| `tracker/security-tracker.html` | Offline copy of the progress tracker |
| `tracker/security-in-pictures.html` | 12 concepts drawn as screens + numbered arrows |
| `tracker/spring-security-architecture.html` | Interactive architecture: 16 scenarios, click a box → class.method + state diff |
| `tracker/spring-core-internals.html` | Spring Core explorer: bean lifecycle, AOP proxy, @Transactional (19 scenarios) |

## Online (claude.ai, private)

- Tracker: https://claude.ai/artifact/JthRvYjMpSE4981S6pRtfQ
- Security in Pictures: https://claude.ai/artifact/BFw5a8NUtpvW8RLzSJRZZu
- Doc: https://claude.ai/code/artifact/9f213fce-8424-4835-a754-6f4bab8b008e

## Way of working

Claude gives stories, requirements, UML and acceptance criteria → I implement → Claude reviews like a PR.
