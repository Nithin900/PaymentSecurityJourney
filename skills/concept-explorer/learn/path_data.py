# Data for site/build.html (Build path) and site/lab.html (Lab log).
# Edit this file, then run:  python3 skills/concept-explorer/learn/build_path.py
# (build_site.py runs it too.)
#
# status: "done" | "now" | "next" | "later"
# links: (label, href) pairs into the Understand pages (guide sections, decision cards, levels)

STEPS = [
    dict(n=1, status="done", title="Default gate", level="l1",
         goal="Spring Boot secures every endpoint with the default filter chain.",
         proof="Any endpoint without a token returns 401.",
         links=[("Guide §2 Architecture", "guide.html#architecture"), ("Card: where security runs", "cards.html#where-security-runs")]),
    dict(n=2, status="done", title="Authorization server issues JWTs", level=None,
         goal="Spring Authorization Server on :9000 signs RS256 JWTs; users log in with the authorization code flow.",
         proof="A token from Postman decodes on jwt.io with iss http://localhost:9000.",
         links=[("Guide §10 OAuth2", "guide.html#oauth2"), ("Card: signing algorithm", "cards.html#signing"), ("Card: which auth server", "cards.html#auth-server")]),
    dict(n=3, status="done", title="Stateless resource servers with scope rules", level="l4",
         goal="Services A, B and Notification verify JWTs locally; GET needs payment.read, POST needs payment.write.",
         proof="test-all.ps1: missing token 401, wrong scope 403, right scope 200.",
         links=[("Guide §9 JWT", "guide.html#jwt"), ("Card: roles, authorities or scopes", "cards.html#roles-scopes")]),
    dict(n=4, status="done", title="Ownership: another user's payment is 404", level="l5",
         goal="Service B takes the owner from the JWT sub and never returns someone else's payment.",
         proof="Alice asking for Nithin's payment id gets 404.",
         links=[("Guide §7.6 IDOR", "guide.html#authorization"), ("Card: ownership", "cards.html#ownership")]),
    dict(n=5, status="done", title="Service-to-service with client credentials", level=None,
         goal="Service B gets its own token (scope notification.send) to call the Notification Service.",
         proof="A payment triggers the email; B's token has sub = payment-service-b.",
         links=[("Guide §11 Microservices", "guide.html#microservices"), ("Card: service-to-service", "cards.html#service-to-service")]),
    dict(n=6, status="now", title="Real users: database + BCrypt", level="l3",
         goal="Auth server loads users from a database table with BCrypt hashes instead of in-memory users.",
         proof="Login works after a restart; the stored password starts with {bcrypt}; a disabled user cannot log in.",
         note="Started on your laptop in Downloads\\Code\\PaymentMicroService (UserEntity, Repository, Service, PasswordEncoderConfig). Not committed yet.",
         links=[("Guide §4 Authentication", "guide.html#authentication"), ("Card: password storage", "cards.html#password-storage"), ("Card: where users come from", "cards.html#user-source")]),
    dict(n=7, status="next", title="Account lockout after failed logins", level="l3",
         goal="Lock an account for a few minutes after 5 wrong passwords; reset on success.",
         proof="The 6th wrong password returns \"locked\"; it unlocks by itself.",
         links=[("Card: stopping password guessing", "cards.html#brute-force")]),
    dict(n=8, status="now", title="Security tests for Services A and B", level=None,
         goal="One allowed and one denied test per security rule, with MockMvc and jwt().",
         proof="mvn test is green: no token 401, wrong scope 403, right scope 200, other user's payment 404.",
         note="Test folders exist on your laptop (payment-service-a/src/test, payment-service-b/src/test). Not committed yet.",
         links=[("Guide §13 Testing", "guide.html#testing"), ("Card: testing approach", "cards.html#testing-approach")]),
    dict(n=9, status="next", title="Redis: shared login sessions", level=None,
         goal="Spring Session + Redis on the auth server, so a restart or a second instance keeps users logged in.",
         proof="Log in, restart the auth server, refresh: still logged in.",
         links=[("Guide §6 Sessions", "guide.html#sessions"), ("Card: sessions across servers", "cards.html#session-scaling")]),
    dict(n=10, status="next", title="Redis: cache payments without leaking them", level=None,
         goal="Cache GET /payments/{id} in Service B with a TTL and eviction on update; the cache key includes the owner.",
         proof="Second GET is faster; Alice still gets 404 for Nithin's cached payment.",
         links=[("Card: ownership", "cards.html#ownership")]),
    dict(n=11, status="next", title="Audience check on every service", level=None,
         goal="Each resource server accepts only tokens issued for the clients it expects.",
         proof="Notification rejects a payment-client token with 401.",
         links=[("Guide §9.3 Audience", "guide.html#jwt"), ("Card: audience check", "cards.html#audience")]),
    dict(n=12, status="next", title="Persist OAuth2 state + hash client secrets", level=None,
         goal="Registered clients, authorizations and consents in the database; client secrets stored with BCrypt.",
         proof="Restart the auth server: consent is remembered; no {noop} secrets left.",
         links=[("Card: signing keys", "cards.html#keys"), ("Card: managing secrets", "cards.html#secrets")]),
    dict(n=13, status="next", title="Refresh tokens with rotation", level=None,
         goal="payment-client gets refresh tokens; each refresh issues a new one and invalidates the old.",
         proof="After 5 minutes the client refreshes without a new login; an old refresh token is rejected.",
         links=[("Card: revoking tokens", "cards.html#revocation")]),
    dict(n=14, status="later", title="Hardening: JSON errors, rate limits, two chains", level="l6",
         goal="401/403 as JSON matching GlobalExceptionHandler; login rate limit; separate API and web chains where needed.",
         proof="401 and 403 bodies are JSON; request 6 in a burst gets 429.",
         links=[("Card: what 401 and 403 look like", "cards.html#error-responses"), ("Card: one chain or several", "cards.html#multiple-chains")]),
    dict(n=15, status="later", title="OAuth2 login with Google or GitHub", level="l7",
         goal="Users can sign in with an external identity provider, mapped to local roles.",
         proof="Google login lands on the app with the right roles.",
         links=[("Guide §10.4 oauth2Login", "guide.html#oauth2"), ("Card: choosing a grant", "cards.html#grant-type")]),
]

# Lab log entries: add one after every experiment, drill or surprise. Newest first.
# dict(date="2026-10-17", title="...", predicted="...", saw="...", learned="...", step=6)
LAB = [
]

# Experiments waiting to be run (shown on the Lab log until they move into LAB).
QUEUED = [
    ("Drill: payments fail but logins work", "Change Service B's b-secret in its config only. Make a payment. What does the user see, what happens to the email, which log says why?"),
    ("Drill: everyone logged out after a deploy", "Get a token, restart the auth server in dev, call Service A again. Explain the 401 in three sentences."),
    ("Drill: slow API", "Stop the Notification Service and create a payment. Does it still save? How long does the request take?"),
    ("Drill: a user sees someone else's data", "As Alice, try every endpoint with Nithin's payment id, including the list endpoint."),
    ("Drill: works locally, fails in production", "Set the issuer to http://127.0.0.1:9000 on one service only. Why does it break?"),
    ("Hypothesis: lockout leaks usernames", "Predict: a locked account shows a different error than a wrong password. Check it after step 7."),
]
