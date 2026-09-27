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

## Site

`site/index.html` — one site with 9 interactive explorers (Full request journey, Spring Security, Spring Core, Boot, MVC, Data JPA, Cloud, Kafka, Observability; 131 scenarios), plus `site/pictures.html` and `site/poster.html`. Open `site/index.html` in a browser. Rebuild: `cd skills/concept-explorer && python3 build_site.py`.

## Code

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

- Java Internals site (explorers + pictures + poster): https://claude.ai/artifact/DAb62c1vW5MfcaWK3SdewB
- Tracker: https://claude.ai/artifact/JthRvYjMpSE4981S6pRtfQ
- Security in Pictures: https://claude.ai/artifact/BFw5a8NUtpvW8RLzSJRZZu
- Doc: https://claude.ai/code/artifact/9f213fce-8424-4835-a754-6f4bab8b008e

## Way of working

Claude gives stories, requirements, UML and acceptance criteria → I implement → Claude reviews like a PR.
