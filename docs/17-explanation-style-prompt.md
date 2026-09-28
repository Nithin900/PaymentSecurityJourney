# Explanation style prompt (27 Sep)

Paste this into Claude Code (or reuse the pattern manually) whenever you want a *new* piece of code explained the same way `05-auth-server-methods-explained.md` and `16-resource-server-and-client-methods-explained.md` were built — method-by-method, with the runtime story and the gotchas, not just "what each line does."

```text
Explain <file/class/feature> the same way you explained my SecurityConfig classes earlier
in this project (see docs/05-auth-server-methods-explained.md and
docs/16-resource-server-and-client-methods-explained.md as the reference style). Specifically:

1. Read the real file(s) first. Don't explain from memory or from what a tutorial usually does —
   quote the actual method signatures and line content from my code.

2. Open with a small text diagram listing every bean/method in the file and what role it plays
   in one short phrase (e.g. "the PERSON", "the APPLICATION", "signing keys"). This is the map
   the reader holds while reading the detail below.

3. For each method/bean, in the order they'd actually run (not necessarily file order), explain:
   - WHAT it produces (the bean type, or the effect on the filter chain).
   - WHEN it runs: at startup (bean construction) vs. at runtime (per request), and by which
     filter/component it gets used later. Never let "startup" and "runtime" behavior blur
     together in the same sentence.
   - WHY it's needed: what would break, or what would silently misbehave, without it.
   - Any non-obvious default (e.g. a prefix like SCOPE_ that gets added automatically,
     an exact-match requirement, a deprecated-but-still-common alternative you'd see in
     tutorials/videos).

4. Call out contradictions or things that look wrong at first glance BEFORE I ask about them.
   If a rule reads like "require X" on something that clearly isn't X yet, explain that it's a
   declared requirement checked later, not a live assertion checked now — show the two moments
   (declaration at startup vs. enforcement at request time) as a short sequence diagram in text.

5. If my code differs from a working/reference example elsewhere in the repo (or is missing a
   piece that another file assumes exists), say so explicitly as a "gap," name the two files,
   and say what currently happens as a result (the actual error, e.g. invalid_client) rather
   than a vague "this might cause issues."

6. Close with a short runtime trace for the one realistic end-to-end flow this code takes part
   in (request in → filter → filter → controller, or scheduler → outbound call → response),
   and a cheat-sheet table: method/line | one-line meaning | which file(s) it applies to.

Constraints:
- Don't pad with generic Spring Security background I already have from prior explanations
  in this repo — assume I know what a SecurityFilterChain, JwtDecoder, and RegisteredClient
  are; explain THIS code's specific choices and consequences.
- Keep prose tight: short paragraphs, bullets over narrative, code fragments over full listings.
- If you're about to explain something you haven't verified against the actual file, say so
  and go read the file instead of guessing.
- When asked to "load this to the readme," don't dump chat text into README.md itself — put it
  in the numbered docs/ file it belongs with (create one if none fits) and add a one-line row
  to the docs table in README.md.
```

## Why this shape works (for future reference)

- **Diagram-first** gives a map before the detail, so a long method-by-method walk doesn't feel like a wall of text.
- **Startup vs. runtime, kept separate**, is the fix for the exact confusion that started this: `.anyRequest().authenticated()` reads like a live check but is a declared rule — conflating "when this code runs" with "when this rule is enforced" is the recurring trap in Spring Security config.
- **Gaps named with the actual failure**, not hedged ("might not work") — e.g. "this will 401 with invalid_client because the client isn't registered" is checkable; "this could be an issue" isn't.
- **Cheat sheet at the end** is what actually gets re-read later; the prose is for understanding once, the table is for looking things up during testing.
