---
name: "concept-explorer"
description: "Build an interactive click-a-box architecture explorer (scenarios, class.method per step, state diff, interview lines) for learning any Java/Spring concept."
---

# Concept Explorer

Nithin's permanent learning method, used for every Java developer concept (first built for Spring Security 6.5). The output is ONE self-contained interactive HTML page published as an artifact. It is for understanding and interviews, not project code.

## Inputs
- TOPIC (e.g. Spring @Transactional internals)
- VERSIONS. If not given, use current stable versions (Java 17+, Spring Boot 3.5, Spring Framework 6.2, etc.) and state them at the top of the page.
- If a previous explorer HTML (e.g. spring-security-architecture.html) is attached or exists in the repo `payment-security-journey/tracker/`, reuse its HTML, CSS and JS exactly and only replace the data (NODES, GROUPS, SECTIONS, SCENARIOS).

## Data (build first, then render)
1. NODES, 30–50 boxes: [id, label, real class name, x, y, width, group, 1–2 line description].
   - Groups flow left to right in the order things happen.
   - Boxes must not overlap.
2. GROUPS: [name, x, y, w, h] logical layers.
3. SECTIONS: the state areas that change (thread-local state, connection, persistence context, request, response, and so on).
4. SCENARIOS, 10–16, each with a group for the dropdown:
   - happy path
   - every common failure path (the exact exception, and where it is thrown and caught)
   - classic interview gotchas
   - a cross-thread or cross-service scenario if relevant
5. STEP fields:
   - n: node id
   - t: title
   - w: ExactClass.exactMethod → next.method
   - d: 1–4 bullets
   - c: {"SECTION|key": value, or null to remove}
   - f: if it fails
   - iv: one interview sentence
   Every node must be used by at least one scenario.

## Page behaviour
- Scenario dropdown, Prev/Next buttons, arrow keys.
- Active box is orange (#f0a35c) with a step badge. An orange arrow goes from the previous box to the current one; it curves out to the right when both boxes are in the same column.
- Left card:
  - step title, class.method
  - What happens / If it fails / Say it in the interview
  - What this box is
  - Same box in other scenarios (jump buttons)
- Right card: state after this step, with + added (green #5fd38d), ~ changed (yellow #f2c14e), − removed (red #e5534b, struck through). The diff is computed from the cumulative state.
- Unused boxes are dimmed. Clicking one shows its description and "used in scenario X step N" buttons. Clicking a used box jumps to its step, cycling if it appears more than once.
- Style:
  - plain black background, white text, #0c0e11 panels, minimal
  - add `<meta charset="utf-8">`
  - `.wrap>*{min-width:0}`
  - the diagram scrolls horizontally (svg min-width about 980px); the page never scrolls sideways at 390px
- No external libraries, no localStorage.

## Accuracy rules
- Only real class and method names for the stated versions. If unsure, say so in the step; never invent names.
- Default behaviour unless the scenario says it's configured. Note version changes in defaults.
- No filler steps.

## Verify before publishing
- Node script:
  - every step.n exists in NODES
  - every node is used
  - every change key's section is in SECTIONS
- Playwright (Chromium at /opt/pw-browsers):
  - no page errors
  - screenshot at 1280px and at 390px; the 390px page must have document scrollWidth equal to 390
  - look at the screenshots and fix overlaps

## Deliver
- Publish with the Artifact tool (icon matching the topic).
- If the payment-security-journey repo exists, copy the page to tracker/, add a README row, and commit.
- Reply briefly in Nithin's Telugu-English style: how to use the page, the scenario list, and 3–5 interview points people usually get wrong.
- Don't write his project code; he implements himself.