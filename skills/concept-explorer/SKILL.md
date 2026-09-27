---
name: concept-explorer
description: Build an interactive click-a-box architecture explorer (scenarios, class.method per step, state diff, interview lines) for learning any Java/Spring concept.
---

# Concept Explorer

Nithin's permanent learning method, used for every Java developer concept. All topics live in ONE site ("Java Internals Explorer" artifact: topic dropdown, plus Security in Pictures and the Authentication poster pages). A new topic is added to that site, not published as a separate page. It is for understanding and interviews, not project code.

## Where things are
- GitHub: Nithin900/PaymentSecurityJourney (local copy on his PC: C:\Users\nithi\IdeaProjects\PaymentSecurityJourney). The cloud session cannot push there; commit locally and ask him to run `git push`.
- Site artifact: https://claude.ai/artifact/DAb62c1vW5MfcaWK3SdewB
- Renderer: `skills/concept-explorer/template/app-template.html` (placeholder `/*TOPICS*/`).
- Data per topic: `skills/concept-explorer/examples/<topic>/data.js` (NODES, GROUPS, OWN, SECTIONS) + `scenarios.js` (security/core keep OWN in a separate own.js). Topics now: journey, security, core, boot, mvc, jpa, cloud, kafka, obs.
- Build: `cd skills/concept-explorer && python3 build_site.py` writes `site/index.html`, `site/pictures.html`, `site/poster.html`. Add the new topic to the `topic(...)` calls in build_site.py (id, dropdown name, versions line, files).
- Republish the site artifact: read it first if it was published in another conversation (Artifact read on its URL), then publish `site/index.html` with `files` {pictures.html, poster.html} to the same URL.

## Inputs
- TOPIC (e.g. Spring Boot auto-configuration)
- VERSIONS. If not given, use current stable versions (Java 17+, Spring Boot 3.5, Spring Framework 6.2, etc.). They are shown under the diagram.

## Data (build first, then render)
1. NODES, 30–60 boxes: [id, label, real class name, x, y, width, group, 1–2 line description].
   - x/y only need to be roughly right: the renderer auto-packs boxes into columns by group (group order left→right by x, top→bottom by y). Groups wider than 420 become full-width rows under the columns (use this for "Your code").
   - The label is short (fits one line); the class name appears in the side panel and as a tooltip.
2. GROUPS: [name, x, y, w, h] logical layers; every node's original x/y should fall inside its group.
3. SECTIONS: the state areas that change (request, session, thread-local state, connection, persistence context, response…).
4. SCENARIOS, 10–20, each with a group for the dropdown:
   - happy path
   - every common failure path (the exact exception, and where it is thrown and caught)
   - classic interview gotchas
   - a cross-thread or cross-service scenario if relevant
5. OWN (one entry per node): {id: [kind, text]}
   - kind: spring (Spring creates it) · config (exists because of a bean, DSL line or property you write) · write (a class you write) · ext (outside your code)
   - text: 1–2 lines naming WHICH bean, DSL call or property causes it, or what class to write and when a default stops being enough. Name the API; don't write full implementations.
   - Scenarios may have `extra: [nodeIds]` for config that matters even when no step visits it.
6. STEP fields: n (node id), t (title), w (ExactClass.exactMethod → next.method), d (1–4 bullets), c ({"SECTION|key": value, or null to remove}), f (if it fails), iv (one interview sentence). Every node must be used by at least one scenario.
   - Scenario-level `prev` / `next`: [topicId, scenarioId, stepIndex, label]. A flow must never stop at a module boundary: when a request leaves this topic (e.g. security passes → Spring MVC, controller → service proxy), the last step names the hand-off class.method and `next` points to where it continues (usually the journey topic); a flow that starts mid-way gets `prev`. Next/Prev on the last/first step follow these links.
   - Optional z: [[topicId, scenarioId, stepIndex (0-based), label], …] → "Zoom in" buttons that open that step in a deeper topic, with a "← Back" button. The "journey" topic (big picture: one request through Tomcat → Security → MVC → proxy → JPA → DB) links into the deep topics this way; when a new deep topic is added, add zoom links from the matching journey steps.

## Page behaviour (already in app-template.html)
- Sticky top bar: topic select, scenario select, step counter, links to other pages; step chips row (1, 2, 3…) to jump.
- The step card sits NEXT TO the active box (dashed leader line), with ← Back / Next → inside the card under the class.method line. Card content: title, class.method, nav, What changed (only changed rows), What happens, Say it in the interview, If it fails, Zoom in, then collapsed "Full state after this step" and "<box> · in your code". The part of the leader line that crosses the diagram is drawn inside the SVG behind the boxes. Under 700px the card sits below the diagram.
- "Guess mode" (on by default): when moving forward with Next, the card first asks "Which box acts next?" with 4 options (correct + 3 distractors from the scenario/topic); clicking a box in the diagram also answers. Then the full card shows ✓/✗ and a per-scenario score. Jumps (chips, zoom, back) reveal directly. A "Hide unseen boxes" toggle (only visible in guess mode) hides the scenario boxes not reached yet, so the diagram builds up step by step; off = all boxes visible. Keeps learning active instead of passive clicking.
- "Only this scenario" (on by default) re-lays out the diagram with just the scenario's boxes; off shows the full architecture with unused boxes dimmed.
- Active box orange with a step badge; orange arrow from the previous box (curved in the same column).
- Ownership: coloured left bar per box, legend, "Show only my part" toggle, collapsible "What YOU write for this scenario (N)".
- URL hash #topic/scenario/step for deep links. Black background, white text, no external libraries, no localStorage.

## Accuracy rules
- Only real class and method names for the stated versions. If unsure, say so in the step; never invent names.
- Default behaviour unless the scenario says it's configured. Note version changes in defaults.
- No filler steps.
- Before publishing, have a separate agent fact-check data/own/scenarios against the real source (GitHub raw files / docs) and list missing interview concepts; fix what it finds.

## Verify before publishing
- Node script: every step.n exists; every node used; every node has OWN; every change key's section is in SECTIONS; extra ids exist.
- Playwright (Chromium at /opt/pw-browsers): no page errors; screenshots at 1440, 860 and 390 px; at 390 px document scrollWidth must equal 390; look at the screenshots.

## Deliver
- Republish the site artifact, commit to the repo (site/ + examples/<topic>/ + build_site.py). To get commits onto his PC (when the computer is linked): `git bundle create x.bundle <his-HEAD>..main` → SendUserFile → device_commit_files into C:\Users\nithi\IdeaProjects → device_bash `git pull --ff-only ../x.bundle main` in the repo, delete the bundle. Then tell him to `git push`.
- Reply briefly in his Telugu-English style: how to open the topic, the scenario list, and 3–5 interview points people usually get wrong.
- Don't write his project code; he implements himself.
