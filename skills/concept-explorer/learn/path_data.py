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
    dict(n=6, status="done", title="Real users: database + BCrypt", level="l3",
         goal="Auth server loads users from a database table with BCrypt hashes instead of in-memory users.",
         proof="Login works after a restart; the stored password starts with {bcrypt}; a disabled user cannot log in.",
         note="Proved by ExA1_DbUsersTest and ExA2_RegisterEndpointTest (H2 in memory): BCrypt hash stored, disabled user refused, POST /register works. Since 18 Oct, /register is admin-only with the first admin seeded from env vars.",
         links=[("Guide §4 Authentication", "guide.html#authentication"), ("Card: password storage", "cards.html#password-storage"), ("Card: where users come from", "cards.html#user-source")]),
    dict(n=7, status="done", title="Account lockout after failed logins", level="l3",
         goal="Lock an account for a few minutes after 5 wrong passwords; reset on success.",
         proof="The 6th wrong password returns \"locked\"; it unlocks by itself.",
         note="Proved by ExB_LockoutTest, 6 of 6 green: 5 wrong passwords lock the account for 15 minutes (LoginAttemptListener, stored in lockedUntil); the custom LockoutAwareFailureHandler still stores a LockedException, so B1 passes.",
         links=[("Card: stopping password guessing", "cards.html#brute-force")]),
    dict(n=8, status="done", title="Security tests for Services A and B", level=None,
         goal="One allowed and one denied test per security rule, with MockMvc and jwt().",
         proof="mvn test is green: no token 401, wrong scope 403, right scope 200, other user's payment 404.",
         note="Proved on 2026-10-18 with mvn test: Service B 30 of 30, Service A 23 of 23. Both BUILD SUCCESS.",
         links=[("Guide §13 Testing", "guide.html#testing"), ("Card: testing approach", "cards.html#testing-approach")]),
    dict(n=9, status="now", title="Redis: shared login sessions", level=None,
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
    dict(date="2026-10-17", step=6, title="Users in Postgres with BCrypt and POST /register",
     predicted="works well bcoz all tests green",   # your prediction
     saw="16 Block A tests green (10 + 6). In Postgres authdb every hash starts with {bcrypt} and is 68 characters. "
         "Token for nithin has sub=nithin, scope payment.read payment.write, 5 minute lifetime.",
     learned="DaoAuthenticationProvider compares the typed password with the stored hash; my code only loads the user. "
             "The delegating encoder adds the {bcrypt} prefix, so the column needs length >= 68 (50 would fail). "
             "An 'enabled' field that is a primitive boolean defaults to false, so registered users came out disabled "
             "until I set it."),

dict(date="2026-10-17", step=6, title="Deleting the in-memory users deleted too much",
     predicted="will affect the DB users table too",
     saw="After removing the userDetailsService block, SecurityConfig also lost the registered clients, both JWK "
         "sources, jwtDecoder and authorizationServerSettings. It still compiled.",
     learned="A green compile says nothing about missing beans; they fail at startup. Check the diff of a "
             "delete (git diff) before moving on, and keep a backup file next to the old configs."),

dict(date="2026-10-17", step=6, title="A wrong password is a 302, not a 401",
     predicted="wrong password gives 401",   # from the Step 7 card; edit to what you really predicted
     saw="Form login answers a wrong password, an unknown user and an old in-memory user with "
         "302 to /login?error. A 401 only appears on endpoints using Basic or bearer auth, e.g. /oauth2/token "
         "with a bad client secret.",
     learned="The status code depends on the entry point, not on the failure. Fix the wording on the Step 7 card."),

dict(date="2026-10-17", step=6, title="POST /register is open to everyone",
     predicted="no only admin access ",
     saw="The exercise contract (A2.5/A2.6) needs /register permitted, so anyone who reaches :9000 can create accounts. "
         "A duplicate username also returns 409, which tells an attacker the name exists.",
     learned="Decision: only an admin should create users. Needs hasRole('ADMIN'), a seeded first admin from an "
             "environment variable, Basic auth for scripts, and updated A2 tests."),

dict(date="2026-10-17", step=8, title="System test: 26 of 27, the failure was timing",
     predicted="not sure what will happen",
     saw="test-all.ps1 first failed at login: it used the password 'password' but nithin was registered with "
         "'password1' and alice did not exist. After fixing the users: 26 passed. The one FAIL (B asked the "
         "notification service) checks B's log after 2 seconds, but the SMTP send takes about 12.5 seconds; "
         "both logs show the email was sent.",
     learned="A failing test can be the test: check the log timestamps before blaming the service. "
             "Replace the fixed sleep with a wait-until loop (up to about 20 seconds)."),

dict(date="2026-10-17", step=8, title="Tests silently stop working when a base annotation disappears",
     predicted="Yes, the tests would stop working: without @SpringBootTest on the base class no Spring context starts, so the injected fields stay empty.",
     saw="AuthServerTestBase lost its @SpringBootTest line (blank at line 19) after the 18:24 green run. "
         "Every test then fails with a NullPointerException on the @Autowired 'users' field, A tests included. "
         "The blank line was committed in 5491bd5.",
     learned="Null @Autowired fields in a test mean no Spring context started. The fix for contextLoads belongs in "
             "PaymentAuthorizationServerApplicationTests (extend the base, drop its @SpringBootTest), not in the base."),

dict(date="2026-10-17", step=6, title="Switched the auth server from Postgres to MySQL",
     predicted="Yes, the switch would work by changing only the datasource URL and driver; the entity and the tests would stay the same.",
     saw="Postgres 17 (service postgresql-x64-17) was running but psql was not on PATH; MySQL Server 8.0 (service MySQL80) "
         "was also running. Both pom.xml files already had the MySQL driver. Changed application.yaml to "
         "jdbc:mysql://localhost:3306/authdb?createDatabaseIfNotExist=true with DB_USER / DB_PASSWORD env vars, and removed "
         "the Postgres driver. mvnw test: 21 run, 20 passed (all Block A on H2). Starting the server failed with "
         "'Access denied for user root@localhost': the default root/root password was a guess. With the real root password the "
         "next start failed on 'Could not resolve placeholder KEYSTORE_PATH' (no dev profile). Started with "
         "-Dspring-boot.run.profiles=dev: :9000 answered 200 on /.well-known/openid-configuration, and MySQL now has "
         "authdb with a users table (id, email, username, password varchar(100), roles, enabled, failed_attempts, locked_until).",
     learned="The datasource is the only thing that ties the app to a database; the entity and tests stay the same. "
             "Hibernate's follow-up error 'Unable to determine Dialect' is just the failed connection in disguise: "
             "read the first 'Access denied' line, not the last one. Users in the old Postgres authdb do not move; "
             "ddl-auto=update creates an empty users table in MySQL, so register users again."),

dict(date="2026-10-17", step=10, title="Debug C3: cache key without a separator leaks payments",
     predicted="a bug in payments lookup test and need to modify",
     saw="PaymentLookupTest.noLeakBetweenSimilarNames fails (the only failure of 21 tests). cacheKey is "
         "'payment:' + owner + paymentId, so owner nithin + 123 and owner nithin1 + 23 both give 'payment:nithin123'. "
         "The second user receives the first user's payment from the cache.",
     learned="Any cache key built from two free-text parts needs a delimiter that cannot occur in either part "
             "(or a structured key such as a record). Not fixed yet: find it in the debugger first."),
]

# Experiments waiting to be run (shown on the Lab log until they move into LAB).
QUEUED = [
    ("Drill: payments fail but logins work", "Change Service B's b-secret in its config only. Make a payment. What does the user see, what happens to the email, which log says why?"),
    ("Drill: everyone logged out after a deploy", "Get a token, restart the auth server in dev, call Service A again. Explain the 401 in three sentences."),
    ("Drill: slow API", "Stop the Notification Service and create a payment. Does it still save? How long does the request take?"),
    ("Drill: a user sees someone else's data", "As Alice, try every endpoint with Nithin's payment id, including the list endpoint."),
    ("Drill: works locally, fails in production", "Set the issuer to http://127.0.0.1:9000 on one service only. Why does it break?"),
    ("Hypothesis: lockout leaks usernames", "Step 7 is done: now check it. Does a locked account show a different message than a wrong password? Try it with a real and a made-up username."),
]
