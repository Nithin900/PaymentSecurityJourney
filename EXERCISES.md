# Practice day: Friday 17 October 2026

About 3.5 hours. Do the blocks in order. Every block follows the same loop:

1. **Predict.** Write one line before you run anything.
2. **Run.** Run the test in IntelliJ and watch it go red.
3. **Code.** Write code until it is green.
4. **Log.** Write three lines in the Lab log (format at the bottom).

Do not open the Hints section until you have been stuck for 20 minutes.

| Time | Block | Proves |
|---|---|---|
| 15 min | 0. Setup + Service B tests | Build step 8 |
| 30 min | C. Debug warm-up (planted bug) | Debugger skills, step 10 idea |
| 90 min | A. Database users + BCrypt + /register | Build step 6 |
| 10 min | Break | |
| 60 min | B. Lockout after 5 wrong passwords | Build step 7 |
| 15 min | Lab log | |

C comes before A on purpose. Once the A tests are copied in, they will not compile until you write the classes. Any compile error in `src/test` stops every test in the module, including C.

---

## 0. Setup (PowerShell in `C:\Users\nithi\Downloads\Code\PaymentMicroService`)

**Step 1. Save your current work as a commit on your branch.** You do the commit yourself, under your own name.

```powershell
Remove-Item -Recurse -Force _review
Add-Content .git\info\exclude "_exercises/"
git add -A
git commit -m "Step 6 skeleton (DB users) and security tests for A, B, Notification"
git push -u origin site-security-levels
```

**Step 2. Create the practice branch.**

```powershell
git switch -c practice/2026-10-17
```

**Step 3. Run the Service B tests.**

1. In IntelliJ, open `payment-service-b/src/test/java/org/example/Controller/PaymentApiIntegrationTest.java`.
2. Click the green arrow next to the class name and choose Run.

Predict first: how many of the 13 tests pass? If all 13 are green, Build step 8 is proven for Service B.

---

## C. Debug warm-up (30 min)

```powershell
Copy-Item -Recurse -Force _exercises\C\payment-authorization-server\src\* payment-authorization-server\src\
```

Open `payment-authorization-server/src/test/java/practice/debug/PaymentLookupTest.java` and run it. One test fails.

**Rule: find the cause with the debugger, not by reading the code.**

1. **Predict.** Before debugging, write down why you think `C3` fails.
2. **Breakpoint.** Put a breakpoint on the line `Payment hit = cache.get(key);` in `PaymentLookup`.
3. **Make it conditional.** Right-click the red dot and set the condition to `owner.equals("nithin1")`.
4. **Debug.** Right-click `C3` and choose Debug.
5. **Inspect.** When it stops, check three things:
   - The value of `key`.
   - The contents of `cache`, in the Variables panel.
   - The result of Evaluate Expression (Alt+F8) on `cacheKey("nithin", 123)`.
6. **Fix and re-run.** Fix the bug and run all 4 tests again.

**Bonus question for the Lab log:** your Service B Redis cache (Build step 10) needs a key. What will it look like, and why?

---

## A. Database users + BCrypt + POST /register (90 min)

```powershell
Copy-Item -Recurse -Force _exercises\A\payment-authorization-server\src\* payment-authorization-server\src\
```

This gives you `AuthServerTestBase`, `ExA1_DbUsersTest` and `ExA2_RegisterEndpointTest`. The base class runs the tests with these settings:

- the `dev` profile, so no keystore is needed
- H2 in memory, so Postgres doesn't need to be running
- tracing off

**First, a 2-minute fix.** The old `PaymentAuthorizationServerApplicationTests.contextLoads` fails. It needs `KEYSTORE_PATH` and a running Postgres. Make it `extends AuthServerTestBase` and remove its `@SpringBootTest`.

### Contract the tests expect

Package root: `com.example.payment_authorization_server`.

| Class | What it must be |
|---|---|
| `DTO.RegisterRequest` | `record RegisterRequest(String username, String password, String email)`. Username: not blank, 3 to 50 characters. Password: not blank, at least 8 characters. Email: not blank, valid email. |
| `DTO.RegisterResponse` | `record RegisterResponse(Long id, String username)`. Nothing else. |
| `Exception.UserAlreadyExistsException` | `extends RuntimeException` |
| `Service.UserRegistrationService` | `@Service` with method `RegisterResponse register(RegisterRequest request)` |
| `Service.CustomUserDetailsService` | Must be the **only** `UserDetailsService` bean |
| `Controller.RegistrationController` | `POST /register` returns 201. A duplicate returns 409. Invalid input returns 400. |
| `Config.PasswordEncoderConfig` | One `PasswordEncoder` bean. Stored hashes must start with `{bcrypt}`. |

### Order that works well

1. **A1.1 to A1.6** (service level):
   - Write `PasswordEncoderConfig`.
   - Write the DTOs and the exception.
   - Write `UserRegistrationService`.
   - Finish `UserEntity` (add a roles column).
   - Finish `CustomUserDetailsService`.
2. **A1.7 to A1.10** (login): remove the in-memory users from `SecurityConfig`.
3. **A2.1 to A2.6** (endpoint):
   - Write the controller.
   - Write a `@RestControllerAdvice`.
   - Open `/register` in `SecurityConfig` **without** turning off security or CSRF for anything else. A2.5 and A2.6 check this.

### Manual check after the tests are green

1. Start Postgres and run the auth server with the `dev` profile.
2. In Postman, call `POST http://localhost:9000/register` with a JSON body.
3. Log in at `http://localhost:9000/login` with the new user.
4. Restart the server and log in again. It should still work (step 6 proof).
5. In psql, run `SELECT username, password FROM users;`. Predict what the hash starts with before you look.

---

## B. Lockout after 5 wrong passwords (60 min)

Start only when every A test is green.

```powershell
Copy-Item -Recurse -Force _exercises\B\payment-authorization-server\src\* payment-authorization-server\src\
```

### Contract

`UserEntity` gets two new fields, each with a getter and setter:

- `int failedAttempts`
- `Instant lockedUntil` (`null` means not locked)

The rules:

- After 5 wrong passwords in a row, the account is locked for 15 minutes.
- During the lock, even the right password gets a `LockedException`.
- A successful login resets the counter to 0.

**Predict before you start:** which Spring Security class decides "locked", and does it run before or after the password check?

**After green, run the queued Lab log hypothesis:** does a locked account answer differently than a wrong password? If it does, what does that tell an attacker?

---

## Finish: commit (you do this, under your own name)

```powershell
git add -A
git commit -m "Practice 17 Oct: DB users, register endpoint, lockout, debug kata"
git push -u origin practice/2026-10-17
```

Later, when you're happy, merge `practice/2026-10-17` into your main branch.

---

## Lab log

Write one entry per block. Paste these into `LAB` in `PaymentSecurityJourney/skills/concept-explorer/learn/path_data.py`, or send them to me and I will add them and mark steps 6, 7 and 8 done on the site.

```python
dict(date="2026-10-17", step=10, title="Debug: cache key leak",
     predicted="...", saw="...", learned="..."),
dict(date="2026-10-17", step=6, title="Users in the DB with BCrypt",
     predicted="...", saw="...", learned="..."),
dict(date="2026-10-17", step=7, title="Lockout after 5 wrong passwords",
     predicted="...", saw="...", learned="..."),
```

---

## Hints (only after 20 minutes stuck)

<details><summary>A1.1 fails with "Value too long for column PASSWORD"</summary>

Count the characters in a `{bcrypt}` hash: the 8-character prefix plus a 60-character BCrypt hash. Now look at your `@Column(length = ...)` on `password`.
</details>

<details><summary>Hash does not start with {bcrypt}</summary>

`new BCryptPasswordEncoder()` stores no prefix. `PasswordEncoderFactories.createDelegatingPasswordEncoder()` adds the prefix.
</details>

<details><summary>Context fails: "expected single matching bean but found 2" (UserDetailsService)</summary>

Two beans are fighting: the in-memory one in `SecurityConfig` and yours. Delete one of them. Also check that yours has `@Service`.
</details>

<details><summary>A1.9: disabled user still logs in</summary>

`User.withUsername(...)` has a `.disabled(boolean)` method. Who calls `isEnabled()` during login? Put a breakpoint in `AbstractUserDetailsAuthenticationProvider.DefaultPreAuthenticationChecks.check` to find out.
</details>

<details><summary>A2.1 returns 403 instead of 201</summary>

The CSRF filter runs before authorization. Use `csrf(c -> c.ignoringRequestMatchers("/register"))` and `requestMatchers("/register").permitAll()` in the default chain.
</details>

<details><summary>Postman gets 401 or a redirect on a 400 error, but the test passes</summary>

MockMvc does not forward errors to `/error`, but the real server does, and `/error` is protected. Permit `/error` too.
</details>

<details><summary>B: where to count failures</summary>

Spring publishes these events:

- `AuthenticationFailureBadCredentialsEvent` (wrong password)
- `AuthenticationSuccessEvent`

Write a `@Component` with two `@EventListener` methods that update the user row. In `CustomUserDetailsService`, set `.accountLocked(lockedUntil != null && lockedUntil.isAfter(Instant.now()))`. B6 fails if your listener assumes the user exists.
</details>
