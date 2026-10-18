# One payment request, every layer

Request followed: `POST /payments` as user `nithin`, through Service A (:8080), Service B (:8081)
and the Notification service (:8082), with tokens issued by the auth server (:9000).

For each layer: **what attack it stops**, **what breaks if you remove it**, **how you prove it**.
The "Prove" lines are the checks to run; none of them has been run yet. Fill in the results in the
lab log as you go.

## Layer 0: Getting the token (before the request)

nithin logs in on the auth server, consents, and gets a JWT (authorization code flow, 5 minute
life, scopes `payment.read` / `payment.write`).

| | |
|---|---|
| **Stops** | Anyone without an account. BCrypt means a stolen `authdb` dump doesn't reveal passwords. The signature means nobody can mint their own token. |
| **Remove it** | Without BCrypt, `SELECT password FROM users` shows passwords. Without a signing key, any caller could forge `sub=nithin`. |
| **Prove** | `SELECT LEFT(password,8), LENGTH(password) FROM users` shows `{bcrypt}` and 68. Edit one character of the token payload and every service rejects it. |

## Layer 1: A verifies the token

`oauth2ResourceServer().jwt()` with `issuer-uri=http://localhost:9000`. Checks the signature against
the auth server's public keys, the expiry and the issuer.

| | |
|---|---|
| **Stops** | Forged, tampered and expired tokens, and anonymous callers. |
| **Remove it** | A would trust whatever `sub` a caller claims. |
| **Prove** | No header gives 401. A tampered token gives 401. After 5 minutes the old token gives 401. |

## Layer 2: A checks the scope

`POST /payments/**` needs `SCOPE_payment.write`; `GET` needs `payment.read`.

| | |
|---|---|
| **Stops** | A valid token being used for more than it was granted. |
| **Remove it** | A read-only token could create payments. |
| **Prove** | Token with only `payment.read`, then POST: 403 (not 401). The difference shows it passed layer 1 and failed layer 2. |

## Layer 3: Stateless sessions and no CSRF

| | |
|---|---|
| **Stops** | Nothing directly. It is only safe because authentication is a Bearer header, not a cookie. A browser can't attach a header automatically, so CSRF has nothing to ride on. |
| **Remove it** | Switching to cookie or session auth while CSRF stays off would open a CSRF hole. |
| **Prove** | Explain it: browsers only auto-send cookies, and the token is never in one. |

## Layer 4: A calls B safely

`WebClient` with a 2 s connect timeout and a 3 s response timeout. It forwards the caller's own
token to B (`ServletBearerExchangeFilterFunction`).

| | |
|---|---|
| **Stops** | A hanging forever on a slow B (a 503 instead). Forwarding the user's token lets B know who the real caller is. |
| **Remove it** | Without timeouts, A's threads pile up behind a dead B. Without forwarding, B can't enforce ownership. |
| **Prove** | Stop B, POST to A: 503 `PAYMENT_SERVICE_UNAVAILABLE`. |

## Layer 5: B verifies the token again

Same JWT and scope rules as A.

| | |
|---|---|
| **Stops** | Anyone who skips A and calls :8081 directly. |
| **Remove it** | Whoever can reach B's port could create and read anyone's payments. |
| **Prove** | `POST :8081/payments` with no token gives 401. Defense in depth: B never assumes A already checked. |

## Layer 6: B validates the input

`@Valid` plus explicit checks that id and account are present and amount is above zero.

| | |
|---|---|
| **Stops** | Garbage, zero and negative amounts (a negative "payment" is a refund trick). |
| **Remove it** | Bad rows get stored, and failures show up later as unrelated 500s. |
| **Prove** | POST with `amount: -5` gives 400 `INVALID_PAYMENT`. |

## Layer 7: Duplicate payment id

`existsById` gives 409; the id is also the primary key.

| | |
|---|---|
| **Stops** | A retry or replay creating a second charge. |
| **Remove it** | The same POST sent twice creates two payments. |
| **Prove** | Send the same body twice; the second gives 409. |

## Layer 8: The owner comes from the token

`paymentEntity.setOwner(currentUser())` uses the JWT `sub`, never the request body.

| | |
|---|---|
| **Stops** | A caller claiming a payment belongs to someone else. |
| **Remove it** | If `owner` came from the body, alice could POST `owner: nithin`. |
| **Prove** | Add `"owner":"alice"` to nithin's POST body. The saved row still says `nithin`. |

## Layer 9: Reads are filtered by owner

`getPaymentById` filters by `currentUser()`; the list uses `findByOwner`. Non-owners get 404, not 403.

| | |
|---|---|
| **Stops** | Reading someone else's payment by guessing ids (IDOR). The 404 also hides that the id exists. |
| **Remove it** | alice reads `PS-1001` that belongs to nithin. |
| **Prove** | Create as nithin, GET as alice: 404. |

## Layer 10: Save first, notify after

`@Transactional` save, then an `AFTER_COMMIT` + `@Async` event.

| | |
|---|---|
| **Stops** | An email failure rolling back a real payment, and the caller waiting on slow SMTP (about 12 s). |
| **Remove it** | A Gmail outage would fail payments, or A would 503 while the payment was already saved. |
| **Prove** | Break the SMTP credentials. The payment still returns 200 and B's log says "saved, but the notification could not be sent". |

## Layer 11: B calls Notification as itself

B gets its own `client_credentials` token (client `payment-service-b`, scope `notification.send`).
Notification only accepts `SCOPE_notification.send`.

| | |
|---|---|
| **Stops** | A user's token being used to send emails; Notification accepting any logged-in caller. |
| **Remove it** | Any user with `payment.write` could call `:8082/notifications` and send mail. |
| **Prove** | POST `:8082/notifications` with nithin's payment token gives 403. With B's token it works. |

## Layer 12: One trace id everywhere

`management.tracing`, with the id in the log pattern.

| | |
|---|---|
| **Stops** | An incident you can't investigate. |
| **Remove it** | The A, B and Notification logs can't be tied to the same request. |
| **Prove** | Grep one trace id and see it in all three logs. |

## Weak spots found while reading the code

1. **`POST /register` is open to the public** (already in the lab log).
2. **The 409 on a duplicate id leaks existence.** GET hides ids with a 404, but POST tells any user
   "this id is taken", even if it belongs to someone else. The primary key is one namespace shared
   by all users.
3. **The duplicate check is a race.** `existsById` then `save` can let two simultaneous requests
   both pass. The primary key still blocks the second, but it probably surfaces as a 500 and not a
   clean 409.
4. **Client secrets are `{noop}secret` and `b-secret` in plain config.** Fine for a lab, not production.
5. **No audience check.** Any token from this issuer with the right scope is accepted by every service.
6. **No rate limiting or lockout** yet (Step 7).

## Your turn

For each layer, write in your own words what breaks if it is removed, then run the "Prove" step and
note what you saw. Being able to do that without this file is the goal.
