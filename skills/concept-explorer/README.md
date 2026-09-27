# concept-explorer skill

My permanent learning method: every Java/Spring concept as an interactive click-a-box architecture page
(scenarios → class.method per step → state diff → "say it in the interview").

## Use it
- In Claude: "concept explorer: Spring @Transactional" (skill is saved in my Claude account).
- Anywhere else: paste `SKILL.md` as the prompt and attach `template/explorer-template.html`.

## Files
| File | What |
|---|---|
| `SKILL.md` | The skill / prompt |
| `template/app-template.html` | Current renderer (one site, many topics, compact auto-layout, side panel) |
| `build_site.py` | Builds `../../site/` from `examples/*/` |
| `template/explorer-template.html` | Old single-topic renderer |
| `examples/<topic>/data.js, own.js, scenarios.js` | Data per topic |

Build: `python3 -c "t=open('explorer-template.html').read(); d=open('data.js').read()+open('own.js').read()+open('scenarios.js').read(); open('out.html','w').write(t.replace('/*DATA*/', d))"`

## Done so far
- Spring Security 6.5 + Authorization Server 1.5 → `../../tracker/spring-security-architecture.html`
- Spring Core (beans, AOP, @Transactional) → `../../tracker/spring-core-internals.html` (data in `examples/spring-core/`)

## In the site now
Journey · Security · Core · Boot · MVC · Data JPA · Cloud · Kafka · Observability

## Next topics
HashMap/ConcurrentHashMap · ThreadPoolExecutor · CompletableFuture · JVM class loading + GC · WebFlux · Spring Batch
