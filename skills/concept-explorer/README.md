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
| `template/explorer-template.html` | Renderer; replace `/*DATA*/` with NODES, GROUPS, SECTIONS, SCENARIOS |
| `template/example-*.js` | Spring Security data, as a reference for the format |

Build: `python3 -c "t=open('explorer-template.html').read(); d=open('data.js').read()+open('scenarios.js').read(); open('out.html','w').write(t.replace('/*DATA*/', d))"`

## Done so far
- Spring Security 6.5 + Authorization Server 1.5 → `../../tracker/spring-security-architecture.html`

## Next topics
Spring MVC request · Bean lifecycle · @Transactional · JPA persistence context · HashMap/ConcurrentHashMap ·
ThreadPoolExecutor · CompletableFuture · JVM class loading + GC · Boot auto-configuration · Kafka · Resilience4j
