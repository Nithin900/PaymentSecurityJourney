const FORMULA_HELP = {who:'Who sends it', where:'Which server / endpoint / component', carries:'What travels (public, secret, one-time, token, object)', checks:'What the receiver verifies — and which Spring class', returns:'What comes back and goes to the next hop'};

const FLOWS = [
// ======================= SECURITY =======================
{id:'login', g:'Security', name:'Get a token: login → consent → code → JWT', goal:'Postman gets an access token from the SecurePay Auth Server (:9000) with the authorization code flow — exactly your RegisteredClient "payment-client" and user "nithin".',
 actors:['Postman','Browser','Auth Server :9000'],
 links:[['security',12,'Inside: /oauth2/authorize → code'],['security',13,'Inside: /oauth2/token code → JWT']],
 hops:[
 {from:'Browser',to:'Auth Server :9000',ch:'front',title:'Authorization request (not logged in yet)',
  f:{who:'Postman opens a browser window', where:':9000 GET /oauth2/authorize', carries:'client_id, scope, redirect_uri, state — all PUBLIC, no secret', checks:'Is a user logged in? No → AuthorizationFilter denies, LoginUrlAuthenticationEntryPoint (your text/html matcher)', returns:'302 → /login + a new session that remembers this URL'},
  req:{raw:`GET /oauth2/authorize?response_type=code&client_id=payment-client&scope=payment.read%20payment.write&redirect_uri=https%3A%2F%2Foauth.pstmn.io%2Fv1%2Fcallback&state=pm-7c1e9a HTTP/1.1
Host: localhost:9000
Accept: text/html`,parts:[
   ['/oauth2/authorize','Authorization endpoint','Spring Authorization Server endpoint. Matched by your @Order(1) chain (authorizationServerConfigurer.getEndpointsMatcher()).','spring'],
   ['response_type=code','response_type','"Give me a one-time code." Authorization code flow.','public'],
   ['client_id=payment-client','client_id','From your RegisteredClient .clientId("payment-client"). Public.','public'],
   ['scope=payment.read%20payment.write','scope','%20 = space. Must be scopes registered on the client.','public'],
   ['redirect_uri=https%3A%2F%2Foauth.pstmn.io%2Fv1%2Fcallback','redirect_uri','URL-encoded https://oauth.pstmn.io/v1/callback. Must exactly match .redirectUri(...) or the server refuses.','public'],
   ['state=pm-7c1e9a','state','Random value chosen by the client (Postman). Must come back unchanged.','public'],
   ['Accept: text/html','Accept','A browser asks for HTML → your MediaTypeRequestMatcher(TEXT_HTML) picks the login-page entry point.','info']]},
  res:{raw:`HTTP/1.1 302
Location: http://localhost:9000/login
Set-Cookie: JSESSIONID=A1B2C3D4E5; Path=/; HttpOnly`,parts:[
   ['Location: http://localhost:9000/login','Location','LoginUrlAuthenticationEntryPoint("/login") from your exceptionHandling(...).','spring'],
   ['JSESSIONID=A1B2C3D4E5','Session','The request cache saved the full /oauth2/authorize URL in this new session so it can resume after login.','spring']]},
  next:'Browser follows Location → login page. The saved authorize URL waits in the session.',
  spring:'<code>AuthorizationFilter</code> → <code>ExceptionTranslationFilter</code> → <code>LoginUrlAuthenticationEntryPoint</code>; <code>HttpSessionRequestCache</code>.',config:'Your <code>authorizationServerSecurityFilterChain</code> (@Order(1)) + <code>RegisteredClient</code>.'},

 {from:'Browser',to:'Auth Server :9000',ch:'front',title:'User logs in (form login)',
  f:{who:'Browser (user nithin)', where:':9000 POST /login', carries:'username + password (SECRET) + _csrf token + session cookie', checks:'UsernamePasswordAuthenticationFilter → your InMemoryUserDetailsManager → password match; CSRF token match', returns:'302 back to the saved /oauth2/authorize URL + NEW session id'},
  req:{raw:`POST /login HTTP/1.1
Host: localhost:9000
Cookie: JSESSIONID=A1B2C3D4E5
Content-Type: application/x-www-form-urlencoded

username=nithin&password=password&_csrf=Hk2pQ7vX9mZ3`,parts:[
   ['JSESSIONID=A1B2C3D4E5','Session cookie','Same session as hop 1 (holds the saved URL and the CSRF token).','spring'],
   ['username=nithin&password=password','Credentials','From your UserDetailsService bean (User.withDefaultPasswordEncoder). Travels only to the Auth Server — never to Service A/B.','secret'],
   ['_csrf=Hk2pQ7vX9mZ3','_csrf','Hidden field from the generated login page. CsrfFilter compares it with the session token → blocks forged logins.','spring']]},
  res:{raw:`HTTP/1.1 302
Location: http://localhost:9000/oauth2/authorize?response_type=code&client_id=payment-client&scope=payment.read%20payment.write&redirect_uri=https%3A%2F%2Foauth.pstmn.io%2Fv1%2Fcallback&state=pm-7c1e9a&continue
Set-Cookie: JSESSIONID=F6G7H8I9J0; Path=/; HttpOnly`,parts:[
   ['state=pm-7c1e9a&continue','Saved request','The exact URL from hop 1, taken from the request cache. "continue" marks it as a saved-request replay.','spring'],
   ['JSESSIONID=F6G7H8I9J0','New session id','Changed after login (session fixation protection). The session now holds the logged-in user.','spring']]},
  fail:{raw:`Wrong password →  HTTP/1.1 302   Location: http://localhost:9000/login?error`,parts:[['/login?error','Login failed','Default failure URL; the login page shows "Bad credentials".','spring']]},
  next:'Browser replays the authorize request — now as a logged-in user.',
  spring:'<code>CsrfFilter</code>, <code>UsernamePasswordAuthenticationFilter</code> → <code>DaoAuthenticationProvider</code>, <code>SavedRequestAwareAuthenticationSuccessHandler</code>.',config:'<code>defaultSecurityFilterChain</code> (@Order(2)) <code>.formLogin(...)</code> + <code>userDetailsService()</code> bean.'},

 {from:'Browser',to:'Auth Server :9000',ch:'front',title:'Consent page',
  f:{who:'Browser (logged in)', where:':9000 GET /oauth2/authorize (again)', carries:'same public params + new session cookie', checks:'User logged in ✓; client needs consent? requireAuthorizationConsent(true) → yes', returns:'200 consent page with a NEW server-side state'},
  req:{raw:`GET /oauth2/authorize?response_type=code&client_id=payment-client&scope=payment.read%20payment.write&redirect_uri=https%3A%2F%2Foauth.pstmn.io%2Fv1%2Fcallback&state=pm-7c1e9a&continue HTTP/1.1
Host: localhost:9000
Cookie: JSESSIONID=F6G7H8I9J0`,parts:[
   ['JSESSIONID=F6G7H8I9J0','Session cookie','The logged-in session from hop 2.','spring']]},
  res:{raw:`HTTP/1.1 200
Content-Type: text/html;charset=UTF-8

<form method="post" action="/oauth2/authorize">
  <input type="hidden" name="client_id" value="payment-client">
  <input type="hidden" name="state" value="cQ8wN2kL5rT1">
  <input type="checkbox" name="scope" value="payment.read"> payment.read
  <input type="checkbox" name="scope" value="payment.write"> payment.write
  <button type="submit">Submit Consent</button>
</form>`,parts:[
   ['value="cQ8wN2kL5rT1"','Consent state','A NEW state made by the Auth Server for the consent step. Postman\'s pm-7c1e9a stays saved on the server and comes back in hop 4.','spring'],
   ['name="scope" value="payment.read"','Scope checkboxes','The user can untick a scope → the token will not have it (→ 403 later).','public']]},
  next:'User ticks scopes and submits → hop 4.',
  spring:'<code>OAuth2AuthorizationEndpointFilter</code> → <code>OAuth2AuthorizationCodeRequestAuthenticationProvider</code> (sees consent required) → default consent page.',config:'<code>ClientSettings.builder().requireAuthorizationConsent(true)</code>'},

 {from:'Browser',to:'Auth Server :9000',ch:'front',title:'Consent submitted → one-time code',
  f:{who:'Browser', where:':9000 POST /oauth2/authorize', carries:'client_id, consent state, chosen scopes', checks:'Consent state matches; scopes allowed', returns:'302 to Postman callback with code (ONE-TIME) + original state'},
  req:{raw:`POST /oauth2/authorize HTTP/1.1
Host: localhost:9000
Cookie: JSESSIONID=F6G7H8I9J0
Content-Type: application/x-www-form-urlencoded

client_id=payment-client&state=cQ8wN2kL5rT1&scope=payment.read&scope=payment.write`,parts:[
   ['state=cQ8wN2kL5rT1','Consent state','Must match what the server stored for this consent.','spring'],
   ['scope=payment.read&scope=payment.write','Granted scopes','Saved as the authorization consent for (payment-client, nithin).','public']]},
  res:{raw:`HTTP/1.1 302
Location: https://oauth.pstmn.io/v1/callback?code=kP3vQz8mW1xR…(128 chars)&state=pm-7c1e9a`,parts:[
   ['code=kP3vQz8mW1xR…(128 chars)','code','ONE-TIME authorization code, valid 5 minutes by default. Useless without payment-client\'s secret.','onetime'],
   ['state=pm-7c1e9a','state','Postman\'s original state, unchanged. Postman compares it.','public']]},
  next:'Postman reads the code from the callback URL. From here: back channel only.',
  spring:'<code>OAuth2AuthorizationConsentAuthenticationProvider</code> → code generated and stored in <code>OAuth2AuthorizationService</code> (in-memory by default).',config:'—'},

 {from:'Postman',to:'Auth Server :9000',ch:'back',title:'Code + secret → access token (JWT)',
  f:{who:'Postman (not the browser)', where:':9000 POST /oauth2/token', carries:'client_id:secret in Basic header (SECRET) + code (ONE-TIME) + redirect_uri', checks:'Client secret ✓ (client_secret_basic), code valid and unused ✓, redirect_uri same as hop 1 ✓', returns:'JSON with a signed JWT access_token, expires_in ≈ 299'},
  req:{raw:`POST /oauth2/token HTTP/1.1
Host: localhost:9000
Authorization: Basic @@PCBASIC@@
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&code=kP3vQz8mW1xR…&redirect_uri=https%3A%2F%2Foauth.pstmn.io%2Fv1%2Fcallback`,parts:[
   ['Basic @@PCBASIC@@','client_id:secret','Base64 of "payment-client:secret" ({noop}secret in your config). Base64 is NOT encryption — decode it in tab "Dissect your own".','secret'],
   ['grant_type=authorization_code','grant_type','"Trading a code for tokens."','public'],
   ['code=kP3vQz8mW1xR…','code','From hop 4. Can be used once only.','onetime'],
   ['redirect_uri=https%3A%2F%2Foauth.pstmn.io%2Fv1%2Fcallback','redirect_uri','Must equal the one in hop 1.','public']]},
  res:{raw:`HTTP/1.1 200
Content-Type: application/json;charset=UTF-8
Cache-Control: no-cache, no-store, max-age=0, must-revalidate

{"access_token":"@@PJWT@@","scope":"payment.read payment.write","token_type":"Bearer","expires_in":299}`,parts:[
   ['"access_token":"','access_token','A JWT signed with the RSA private key from your jwkSource() bean. Decoded below.','signed'],
   ['"scope":"payment.read payment.write"','scope','What the user consented to.','public'],
   ['"expires_in":299','expires_in','Your accessTokenTimeToLive(Duration.ofMinutes(5)). No refresh_token: your client doesn\'t register the refresh_token grant. No id_token: "openid" scope not requested.','info']]},
  dec:{title:'access_token decoded',raw:`HEADER   {"kid":"5d1f0c2a-9e7b-4a61-b3c8-2f4d6e8a0b1c","alg":"RS256"}
PAYLOAD  {"sub":"nithin","aud":"payment-client","nbf":@@T0@@,
          "scope":["payment.read","payment.write"],"iss":"http://localhost:9000",
          "exp":@@T0@@+300,"iat":@@T0@@,"jti":"e41b7c90-2d3a-4f58-9a61-7b0c5d2e8f13"}`,parts:[
   ['"kid":"5d1f0c2a-9e7b-4a61-b3c8-2f4d6e8a0b1c"','kid','keyID(UUID.randomUUID()) in your jwkSource(). A NEW key every time :9000 restarts!','signed'],
   ['"sub":"nithin"','sub','The logged-in user.','signed'],
   ['"aud":"payment-client"','aud','The client the token was issued to.','signed'],
   ['"scope":["payment.read","payment.write"]','scope','Service A/B turn these into SCOPE_payment.read / SCOPE_payment.write.','signed'],
   ['"iss":"http://localhost:9000"','iss','From AuthorizationServerSettings.issuer(...). Must equal A/B\'s issuer-uri.','signed'],
   ['"exp":@@T0@@+300','exp','5 minutes after iat.','signed']]},
  fail:{raw:`Wrong secret       →  401  {"error":"invalid_client"}
Code used twice    →  400  {"error":"invalid_grant"}
Other redirect_uri →  400  {"error":"invalid_grant"}`,parts:[
   ['{"error":"invalid_client"}','invalid_client','Client authentication failed.','info'],
   ['Code used twice    →  400  {"error":"invalid_grant"}','invalid_grant','Code expired, already used, or redirect_uri different. If a code is reused, SAS also invalidates the access token already issued from it.','info']]},
  next:'Postman sends this JWT as <code>Authorization: Bearer …</code> to Service A (next flow).',
  spring:'<code>OAuth2ClientAuthenticationFilter</code> → <code>OAuth2TokenEndpointFilter</code> → <code>OAuth2AuthorizationCodeAuthenticationProvider</code> → <code>JwtGenerator</code> (signs with <code>jwkSource</code>).',config:'<code>clientSecret("{noop}secret")</code>, <code>CLIENT_SECRET_BASIC</code>, <code>TokenSettings</code>, <code>jwkSource()</code>.'}
 ]},

{id:'call', g:'Security', name:'Call A → A relays the token to B', goal:'Postman calls Service A with the JWT. A checks it, then WebClient forwards the SAME token to Service B, which checks it again.',
 actors:['Postman','Service A :8080','Service B :8081','Auth Server :9000'],
 links:[['security',7,'Inside: JWT accepted'],['security',15,'Inside: token relay A → B']],
 hops:[
 {from:'Postman',to:'Service A :8080',ch:'front',title:'API call with the JWT',
  f:{who:'Postman', where:'A :8080 POST /payments', carries:'Bearer JWT (SIGNED) + JSON body', checks:'(next hop) BearerTokenAuthenticationFilter extracts the token', returns:'—'},
  req:{raw:`POST /payments HTTP/1.1
Host: localhost:8080
Authorization: Bearer @@PJWTSHORT@@
Content-Type: application/json
Content-Length: 69

{"paymentId":"PAY-1001","accountNumber":"ACC-778899","amount":250.00}`,parts:[
   ['Bearer @@PJWTSHORT@@','Bearer JWT','The access_token from the login flow. Whoever holds it can use it for 5 minutes.','signed'],
   ['Content-Type: application/json','Content-Type','Tells Spring MVC to use Jackson for the body.','info'],
   ['{"paymentId":"PAY-1001","accountNumber":"ACC-778899","amount":250.00}','Body','Becomes A\'s PaymentRequest object.','info']]},
  res:{raw:`(A verifies the token first — hop 2)`,parts:[]},
  next:'Token string goes to A\'s JwtDecoder.',spring:'<code>BearerTokenAuthenticationFilter</code> → <code>DefaultBearerTokenResolver</code>.',config:'—'},

 {from:'Service A :8080',to:'Service A :8080',ch:'jvm',title:'A verifies the token',
  f:{who:'A\'s security filter', where:'inside A (JwtDecoder)', carries:'the JWT string', checks:'First request only: fetch :9000 metadata + public keys. Then signature (kid), exp/nbf (60 s skew), iss = issuer-uri, then rule POST /payments/** → SCOPE_payment.write', returns:'JwtAuthenticationToken in SecurityContextHolder → controller'},
  req:{raw:`first request only:
  GET http://localhost:9000/.well-known/openid-configuration  → {"issuer":"http://localhost:9000","jwks_uri":"http://localhost:9000/oauth2/jwks",…}
  GET http://localhost:9000/oauth2/jwks                       → {"keys":[{"kty":"RSA","e":"AQAB","kid":"5d1f0c2a-…","n":"…"}]}`,parts:[
   ['/.well-known/openid-configuration','Discovery','Built from your issuer-uri. Boot creates the decoder lazily → this happens on the first request.','spring'],
   ['"kid":"5d1f0c2a-…"','Public key','Same kid as the token header → verifies the signature locally. No call per request: keys are cached (~5 min) and re-fetched on expiry or on an unknown kid.','public']]},
  res:{raw:`signature ✓   exp ✓   iss ✓
JwtAuthenticationToken  name=nithin  authorities=[SCOPE_payment.read, SCOPE_payment.write]
rule: POST /payments/** hasAuthority("SCOPE_payment.write") → ✓`,parts:[
   ['authorities=[SCOPE_payment.read, SCOPE_payment.write]','Authorities','"SCOPE_" + each scope claim (JwtGrantedAuthoritiesConverter).','spring'],
   ['hasAuthority("SCOPE_payment.write")','Your rule','From A\'s SecurityConfig.','spring']]},
  next:'Request reaches A\'s PaymentController → PaymentServiceImpl.createPayment → WebClient.',
  spring:'<code>NimbusJwtDecoder</code> (inside Boot\'s <code>SupplierJwtDecoder</code>), <code>JwtAuthenticationProvider</code>, <code>AuthorizationFilter</code>.',config:'<code>spring.security.oauth2.resourceserver.jwt.issuer-uri=http://localhost:9000</code> + A\'s <code>SecurityConfig</code>.'},

 {from:'Service A :8080',to:'Service B :8081',ch:'back',title:'A → B: same token forwarded',
  f:{who:'A\'s WebClient (server → server)', where:'B :8081 POST /payments', carries:'the SAME Bearer JWT (copied from A\'s SecurityContext) + body re-serialized by Jackson', checks:'(next hop) B does the same checks A did', returns:'—'},
  req:{raw:`POST /payments HTTP/1.1
host: localhost:8081
accept: */*
user-agent: ReactorNetty/1.2.x
Authorization: Bearer @@PJWTSHORT@@
Content-Type: application/json
Content-Length: 69

{"paymentId":"PAY-1001","accountNumber":"ACC-778899","amount":250.00}`,parts:[
   ['user-agent: ReactorNetty/1.2.x','Reactor Netty','WebClient runs on Reactor Netty. It adds host / accept / user-agent.','info'],
   ['Bearer @@PJWTSHORT@@','Relayed token','ServletBearerExchangeFilterFunction copies the JWT from A\'s SecurityContext. No new token — B sees user nithin.','signed'],
   ['{"paymentId":"PAY-1001"','Body','A\'s PaymentRequest written back to JSON by Jackson (bodyValue(request)).','info']]},
  res:{raw:`(B verifies the token — hop 4)`,parts:[]},
  next:'B repeats hop 2 on its own (B also fetches the keys once).',
  spring:'<code>WebClient</code> → <code>ServletBearerExchangeFilterFunction</code> → Reactor Netty.',config:'Your <code>WebClientConfig</code>: <code>baseUrl("http://localhost:8081")</code> + <code>.filter(new ServletBearerExchangeFilterFunction())</code>.'},

 {from:'Service B :8081',to:'Service B :8081',ch:'jvm',title:'B verifies, validates, saves',
  f:{who:'B', where:'inside B: security → controller → service → H2', carries:'JWT + JSON', checks:'Same JWT checks as A; @Valid (@NotBlank, @NotNull @Positive); service rules; duplicate id', returns:'200 {"paymentId","status","message"}'},
  req:{raw:`JWT ✓ SCOPE_payment.write ✓
@Valid PaymentRequest ✓
paymentRepository.existsById("PAY-1001") → false
paymentRepository.save(Payment{PAY-1001, ACC-778899, 250.00})`,parts:[
   ['@Valid PaymentRequest ✓','Validation','Bean Validation on B\'s DTO. Fail → MethodArgumentNotValidException → your handler → 400.','spring'],
   ['existsById("PAY-1001") → false','Duplicate check','Your service rule. Exists → DuplicatePaymentException → 409.','info']]},
  res:{raw:`HTTP/1.1 200
Content-Type: application/json

{"paymentId":"PAY-1001","status":"SUCCESS","message":"Payment created Successfully"}`,parts:[
   ['HTTP/1.1 200','200 OK','ResponseEntity.ok(...) — not 201, because the controller uses ok().','info'],
   ['"status":"SUCCESS"','Body','B\'s PaymentResponse written by Jackson.','info']]},
  next:'JSON travels back to A; retrieve().bodyToMono(PaymentResponse.class).block() turns it into A\'s PaymentResponse.',
  spring:'Same resource-server filters; <code>RequestResponseBodyMethodProcessor</code>; <code>SimpleJpaRepository</code>.',config:'B\'s <code>SecurityConfig</code> + <code>application.properties</code>.'},

 {from:'Service A :8080',to:'Postman',ch:'front',title:'A answers Postman',
  f:{who:'A', where:'back to Postman', carries:'B\'s JSON, re-serialized by A', checks:'—', returns:'200 + same JSON + Spring Security default headers'},
  req:{raw:`(answer to hop 1)`,parts:[]},
  res:{raw:`HTTP/1.1 200
X-Content-Type-Options: nosniff
X-XSS-Protection: 0
Cache-Control: no-cache, no-store, max-age=0, must-revalidate
Pragma: no-cache
Expires: 0
X-Frame-Options: DENY
Content-Type: application/json

{"paymentId":"PAY-1001","status":"SUCCESS","message":"Payment created Successfully"}`,parts:[
   ['X-Content-Type-Options: nosniff','Security headers','Added by Spring Security\'s HeaderWriterFilter by default.','spring'],
   ['{"paymentId":"PAY-1001","status":"SUCCESS"','Body','Same data B returned: JSON → A\'s object → JSON again.','info']]},
  next:'Done. One token, checked twice (A and B), issued once (:9000).',spring:'<code>HeaderWriterFilter</code>, Jackson.',config:'—'}
 ]},

{id:'reject', g:'Security', name:'401 / 403: when the token is rejected', goal:'Four real ways a SecurePay request fails security — and the exact response header that tells you why.',
 actors:['Postman','Service A :8080'],
 links:[['security',8,'Inside: JWT rejected (401)'],['security',9,'Inside: missing scope (403)']],
 hops:[
 {from:'Postman',to:'Service A :8080',ch:'front',title:'No token at all',
  f:{who:'Postman', where:'A POST /payments', carries:'no Authorization header', checks:'anyRequest().authenticated() → anonymous user → denied', returns:'401 + WWW-Authenticate: Bearer'},
  req:{raw:`POST /payments HTTP/1.1
Host: localhost:8080
Content-Type: application/json`,parts:[['Content-Type: application/json','No Authorization','Nothing for BearerTokenAuthenticationFilter to read → request stays anonymous.','info']]},
  res:{raw:`HTTP/1.1 401
WWW-Authenticate: Bearer`,parts:[['WWW-Authenticate: Bearer','Challenge','"Send a Bearer token." No error code because no token was sent. Body is empty.','spring']]},
  next:'Get a token (login flow) and retry.',spring:'<code>AuthorizationFilter</code> → <code>ExceptionTranslationFilter</code> → <code>BearerTokenAuthenticationEntryPoint</code>.',config:'—'},
 {from:'Postman',to:'Service A :8080',ch:'front',title:'Token older than 5 minutes',
  f:{who:'Postman', where:'A POST /payments', carries:'expired JWT', checks:'JwtDecoder: exp < now − 60 s → invalid', returns:'401 invalid_token + reason in the header'},
  req:{raw:`POST /payments HTTP/1.1
Authorization: Bearer eyJraWQiOiI1ZDFmMGMyYS…(issued 6 minutes ago)`,parts:[['(issued 6 minutes ago)','Expired','Your TTL is 5 minutes (+60 s clock skew allowed).','signed']]},
  res:{raw:`HTTP/1.1 401
WWW-Authenticate: Bearer error="invalid_token", error_description="An error occurred while attempting to decode the Jwt: Jwt expired at @@EXP@@", error_uri="https://tools.ietf.org/html/rfc6750#section-3.1"`,parts:[
   ['error="invalid_token"','invalid_token','The token itself is bad.','info'],
   ['Jwt expired at @@EXP@@','Reason','Read it from the header — the body is empty.','info']]},
  next:'Get a new token.',spring:'<code>JwtTimestampValidator</code> → <code>JwtAuthenticationProvider</code> → <code>BearerTokenAuthenticationEntryPoint</code>.',config:'<code>accessTokenTimeToLive(Duration.ofMinutes(5))</code> on :9000.'},
 {from:'Postman',to:'Service A :8080',ch:'front',title:'Auth Server restarted → old token\'s key is gone',
  f:{who:'Postman', where:'A POST /payments', carries:'a still-unexpired JWT signed with the OLD key', checks:'kid not in cache → A re-fetches /oauth2/jwks → :9000 now has a NEW random key → no match', returns:'401 invalid_token'},
  req:{raw:`Authorization: Bearer eyJraWQiOiI1ZDFmMGMyYS…   (kid 5d1f0c2a-…, :9000 restarted since)`,parts:[['(kid 5d1f0c2a-…, :9000 restarted since)','Old kid','Your jwkSource() generates a new RSA key + random kid at every startup.','signed']]},
  res:{raw:`HTTP/1.1 401
WWW-Authenticate: Bearer error="invalid_token", error_description="An error occurred while attempting to decode the Jwt: Signed JWT rejected: Another algorithm expected, or no matching key(s) found", error_uri="https://tools.ietf.org/html/rfc6750#section-3.1"`,parts:[
   ['no matching key(s) found','No key','Every token issued before the restart is now useless. In production the key is loaded from a keystore, not generated at startup.','info']]},
  next:'Get a new token after every Auth Server restart.',spring:'Nimbus JWS verifier inside <code>NimbusJwtDecoder</code>.',config:'<code>jwkSource()</code> + <code>generateRsaKey()</code> in the Auth Server.'},
 {from:'Postman',to:'Service A :8080',ch:'front',title:'Token without payment.write (user unticked it)',
  f:{who:'Postman', where:'A POST /payments', carries:'valid JWT with scope ["payment.read"] only', checks:'Token ✓, rule hasAuthority("SCOPE_payment.write") ✗', returns:'403 insufficient_scope'},
  req:{raw:`POST /payments HTTP/1.1
Authorization: Bearer eyJ…   (scope: ["payment.read"])`,parts:[['(scope: ["payment.read"])','Scope','User unticked payment.write on the consent page.','signed']]},
  res:{raw:`HTTP/1.1 403
WWW-Authenticate: Bearer error="insufficient_scope", error_description="The request requires higher privileges than provided by the access token.", error_uri="https://tools.ietf.org/html/rfc6750#section-3.1"`,parts:[
   ['error="insufficient_scope"','403 vs 401','401 = "who are you?" (token missing/bad). 403 = "I know you, but you can\'t do this."','info']]},
  next:'GET /payments still works (needs only payment.read).',spring:'<code>AuthorizationFilter</code> → <code>AccessDeniedException</code> → <code>BearerTokenAccessDeniedHandler</code>.',config:'A\'s rule <code>.requestMatchers(HttpMethod.POST, "/payments/**").hasAuthority("SCOPE_payment.write")</code>'}
 ]},

// ======================= CORE =======================
{id:'di', g:'Spring Core', name:'Startup: beans and constructor injection (Service A)', goal:'What the container does with your classes before the first request. The "wire" here is the DEBUG log.',
 actors:['main()','Component scan','BeanFactory','Your beans'],
 links:[['core',2,'Explorer: one bean\'s lifecycle'],['core',3,'Explorer: injection — which bean?']],
 hops:[
 {from:'main()',to:'Component scan',ch:'jvm',title:'Find your classes',
  f:{who:'SpringApplication.run(PaymentAApplication.class)', where:'package com.example.PaymentA and below', carries:'class files with @Component / @Service / @RestController / @Configuration', checks:'ClassPathBeanDefinitionScanner reads annotations (no objects yet)', returns:'BeanDefinitions: recipes, not objects'},
  req:{raw:`@SpringBootApplication  →  @ComponentScan("com.example.PaymentA")`,parts:[['@ComponentScan("com.example.PaymentA")','Scan root','The package of your main class. Classes outside it are not found.','spring']]},
  res:{raw:`BeanDefinitions:
  paymentController   → com.example.PaymentA.Controller.PaymentController
  paymentServiceImpl  → com.example.PaymentA.Service.PaymentServiceImpl
  webClientConfig     → com.example.PaymentA.Config.WebClientConfig
  webClient           → factory method WebClientConfig.webClient()
  securityConfig      → com.example.PaymentA.Security.SecurityConfig
  globalExceptionHandler, securityFilterChain, …`,parts:[
   ['paymentServiceImpl','Bean name','Class name with a lower-case first letter.','spring'],
   ['factory method WebClientConfig.webClient()','@Bean method','The bean\'s name is the method name.','spring']]},
  next:'BeanFactory creates singletons one by one, dependencies first.',spring:'<code>ConfigurationClassPostProcessor</code>, <code>ClassPathBeanDefinitionScanner</code>.',config:'<code>@SpringBootApplication</code> on <code>PaymentAApplication</code>.'},
 {from:'BeanFactory',to:'Your beans',ch:'jvm',title:'Create beans; dependencies first',
  f:{who:'DefaultListableBeanFactory', where:'creating paymentServiceImpl', carries:'constructor parameter type WebClient', checks:'Controller needs PaymentService → create it first; it needs WebClient → create that first. Exactly one candidate → use it (0 → fail, 2+ → @Primary/@Qualifier/name)', returns:'new PaymentServiceImpl(webClient), then new PaymentController(service)'},
  req:{raw:`Creating shared instance of singleton bean 'webClientConfig'
Creating shared instance of singleton bean 'paymentController'
Creating shared instance of singleton bean 'paymentServiceImpl'
Creating shared instance of singleton bean 'webClient'`,parts:[
   ['singleton bean \'webClient\'','Singleton','One instance for the whole app, shared by all threads.','spring']]},
  res:{raw:`Autowiring by type from bean name 'paymentServiceImpl' via constructor to bean named 'webClient'
Autowiring by type from bean name 'paymentController' via constructor to bean named 'paymentServiceImpl'`,parts:[
   ['via constructor to bean named \'webClient\'','Constructor injection','Your single constructor — no @Autowired needed.','spring'],
   ['to bean named \'paymentServiceImpl\'','Interface → impl','Controller asks for PaymentService (interface); the only implementation is injected.','spring']]},
  fail:{raw:`***************************
APPLICATION FAILED TO START
***************************

Description:

Parameter 0 of constructor in com.example.PaymentA.Service.PaymentServiceImpl required a bean of type 'org.springframework.web.reactive.function.client.WebClient' that could not be found.

Action:

Consider defining a bean of type 'org.springframework.web.reactive.function.client.WebClient' in your configuration.`,parts:[
   ['Parameter 0 of constructor','NoSuchBeanDefinition','What you see if WebClientConfig is deleted or outside the scanned package.','info']]},
  next:'All singletons ready → Tomcat starts → first request can arrive.',spring:'<code>ConstructorResolver</code>, <code>DefaultListableBeanFactory.resolveDependency</code>.',config:'See these logs: <code>logging.level.org.springframework.beans.factory=DEBUG</code>.'},
 {from:'BeanFactory',to:'Your beans',ch:'jvm',title:'Proxies replace some beans (Service B repository)',
  f:{who:'BeanPostProcessors / repository factory', where:'after a bean is built', carries:'the raw object', checks:'Needs transactions / exception translation? → wrap it', returns:'a proxy object is injected instead of the raw one'},
  req:{raw:`PaymentRepository (your interface, no class written)`,parts:[['PaymentRepository','Interface only','Spring Data creates the implementation at startup.','spring']]},
  res:{raw:`paymentRepository.getClass() → jdk.proxy2.$Proxy115
  target: org.springframework.data.jpa.repository.support.SimpleJpaRepository
  advice: ExposeInvocationInterceptor, CrudMethodMetadataPopulatingMethodInterceptor,
          PersistenceExceptionTranslationInterceptor, TransactionInterceptor, …,
          QueryExecutorMethodInterceptor, ImplementationMethodExecutionInterceptor

(if a class had @Transactional → PaymentServiceImpl$$SpringCGLIB$$0)`,parts:[
   ['jdk.proxy2.$Proxy115','JDK proxy','Interfaces get a JDK dynamic proxy.','spring'],
   ['SimpleJpaRepository','Real work','The class that runs save/findById.','spring'],
   ['PaymentServiceImpl$$SpringCGLIB$$0','CGLIB proxy','Classes get a CGLIB subclass proxy (Boot default).','spring']]},
  next:'When your service calls paymentRepository.save(...), it calls the proxy first (flow "AOP").',spring:'<code>JpaRepositoryFactoryBean</code>, <code>ProxyFactory</code>.',config:'—'}
 ]},

{id:'aop', g:'Spring Core', name:'AOP: one save() call through the proxy (Service B)', goal:'Your code calls paymentRepository.save(entity). The stack trace is the "wire" inside the JVM. Frames here are listed in call order (top-down); a real stack trace prints them reversed, newest frame first.',
 actors:['PaymentServiceImpl','Repository proxy','Interceptors','SimpleJpaRepository'],
 links:[['core',5,'Explorer: proxy creation'],['core',10,'Explorer: self-invocation']],
 hops:[
 {from:'PaymentServiceImpl',to:'Repository proxy',ch:'jvm',title:'Your call hits the proxy',
  f:{who:'PaymentServiceImpl.create', where:'paymentRepository.save(...)', carries:'the Payment entity', checks:'Nothing yet — you are calling a proxy, not SimpleJpaRepository', returns:'JdkDynamicAopProxy starts the interceptor chain'},
  req:{raw:`at org.example.Controller.PaymentController.createPayment(PaymentController.java:22)
at org.example.Service.PaymentServiceImpl.create(PaymentServiceImpl.java:73)
at jdk.proxy2/jdk.proxy2.$Proxy115.save(Unknown Source)`,parts:[
   ['PaymentServiceImpl.create(PaymentServiceImpl.java:73)','Your line','paymentRepository.save(paymentEntity).','info'],
   ['$Proxy115.save(Unknown Source)','Proxy','Generated class — no source file.','spring']]},
  res:{raw:`at org.springframework.aop.framework.JdkDynamicAopProxy.invoke(JdkDynamicAopProxy.java)
at org.springframework.aop.framework.ReflectiveMethodInvocation.proceed(ReflectiveMethodInvocation.java)`,parts:[
   ['JdkDynamicAopProxy.invoke','Chain start','Builds the list of advice for save().','spring'],
   ['ReflectiveMethodInvocation.proceed','proceed()','Calls the next interceptor; the last one calls the real method.','spring']]},
  next:'Each interceptor does its "before" work and calls proceed().',spring:'<code>JdkDynamicAopProxy</code>.',config:'—'},
 {from:'Interceptors',to:'Interceptors',ch:'jvm',title:'Interceptors wrap the call',
  f:{who:'ReflectiveMethodInvocation', where:'interceptor chain', carries:'the method call (MethodInvocation)', checks:'Exception translation wraps; TransactionInterceptor opens a transaction (save is @Transactional in SimpleJpaRepository)', returns:'proceed() → next → finally the target'},
  req:{raw:`at org.springframework.dao.support.PersistenceExceptionTranslationInterceptor.invoke(…)
at org.springframework.transaction.interceptor.TransactionInterceptor.invoke(…)
at org.springframework.transaction.interceptor.TransactionAspectSupport.invokeWithinTransaction(…)`,parts:[
   ['PersistenceExceptionTranslationInterceptor','Exception translation','Turns JPA/Hibernate exceptions into Spring DataAccessExceptions (e.g. DataIntegrityViolationException).','spring'],
   ['TransactionInterceptor','Transaction','BEGIN before, COMMIT/ROLLBACK after (see flow "@Transactional").','spring']]},
  res:{raw:`at org.springframework.data.jpa.repository.support.SimpleJpaRepository.save(SimpleJpaRepository.java)
  → entityManager.merge(entity)   (id is set, so not "new")`,parts:[['SimpleJpaRepository.save','Target','The real method finally runs.','spring']]},
  next:'Return value / exception travels back up through the same interceptors in reverse.',spring:'<code>ReflectiveMethodInvocation</code>, <code>TransactionInterceptor</code>.',config:'—'},
 {from:'SimpleJpaRepository',to:'PaymentServiceImpl',ch:'jvm',title:'Way back: exceptions get translated',
  f:{who:'Hibernate / H2', where:'back up the chain', carries:'result, or an exception', checks:'TransactionInterceptor: exception → rollback; ExceptionTranslation: JPA exception → Spring exception', returns:'your code sees a Spring exception type'},
  req:{raw:`org.hibernate.exception.ConstraintViolationException: could not execute statement
  [Unique index or primary key violation: "PUBLIC.PRIMARY_KEY_x ON PUBLIC.PAYMENTS(PAYMENT_ID) VALUES ( /* key:1 */ 'PAY-1001' )"; SQL statement:
  insert into payments (account_number,amount,payment_id) values (?,?,?) [23505-232]]`,parts:[['Unique index or primary key violation','H2 error','Two requests with the same paymentId passed the existsById check (see flow "@Transactional").','info']]},
  res:{raw:`Initiating transaction rollback after commit exception
org.springframework.dao.DataIntegrityViolationException: could not execute statement […]; SQL [insert into payments (account_number,amount,payment_id) values (?,?,?)]; constraint [PUBLIC.PRIMARY_KEY_x]`,parts:[['DataIntegrityViolationException','Translated','The INSERT ran during commit, so JpaTransactionManager.doCommit translated it (HibernateJpaDialect). Your GlobalExceptionHandler has no handler for it → catch-all → 500.','spring']]},
  next:'Rule: only calls that go THROUGH a proxy get advice. this.method() inside the same class skips it.',spring:'<code>JpaTransactionManager.doCommit</code> → <code>HibernateJpaDialect</code> (translation); <code>PersistenceExceptionTranslationInterceptor</code> for exceptions thrown inside the call.',config:'—'}
 ]},

{id:'tx', g:'Spring Core', name:'@Transactional: what B does today vs with one annotation', goal:'Service B has no @Transactional. Each repository call runs its own transaction. The DEBUG log shows exactly where BEGIN/COMMIT happen.',
 actors:['PaymentServiceImpl','TransactionManager','H2'],
 links:[['core',7,'Explorer: @Transactional commit'],['core',12,'Explorer: REQUIRES_NEW']],
 hops:[
 {from:'PaymentServiceImpl',to:'TransactionManager',ch:'jvm',title:'Transaction 1: existsById',
  f:{who:'PaymentServiceImpl.create', where:'paymentRepository.existsById → TransactionInterceptor', carries:'method name + @Transactional(readOnly = true) from SimpleJpaRepository', checks:'Existing transaction? No → create one', returns:'COMMIT right after the SELECT'},
  req:{raw:`Found thread-bound EntityManager [SessionImpl(1834021987<open>)] for JPA transaction
Creating new transaction with name [org.springframework.data.jpa.repository.support.SimpleJpaRepository.existsById]: PROPAGATION_REQUIRED,ISOLATION_DEFAULT,readOnly`,parts:[
   ['Found thread-bound EntityManager','Open-in-view','spring.jpa.open-in-view is true by default → one EntityManager is bound for the whole web request.','spring'],
   ['SimpleJpaRepository.existsById','Tx name','The proxied method that started the transaction.','spring'],
   ['PROPAGATION_REQUIRED,ISOLATION_DEFAULT,readOnly','Attributes','REQUIRED (default), DB default isolation, read-only (SimpleJpaRepository is @Transactional(readOnly = true)).','spring']]},
  res:{raw:`Hibernate: select count(*) from payments p1_0 where p1_0.payment_id=?     (one line here; format_sql=true prints it over several lines)
Initiating transaction commit
Committing JPA transaction on EntityManager [SessionImpl(1834021987<open>)]
Not closing pre-bound JPA EntityManager after transaction`,parts:[
   ['select count(*) from payments p1_0 where p1_0.payment_id=?','SQL','existsById → count query.','info'],
   ['Initiating transaction commit','COMMIT #1','Transaction 1 is over.','spring']]},
  next:'Gap here: nothing locks PAY-1001 between this check and the insert.',spring:'<code>TransactionInterceptor</code> → <code>JpaTransactionManager</code>.',config:'See it: <code>logging.level.org.springframework.orm.jpa=DEBUG</code>.'},
 {from:'PaymentServiceImpl',to:'TransactionManager',ch:'jvm',title:'Transaction 2: save',
  f:{who:'PaymentServiceImpl.create', where:'paymentRepository.save → TransactionInterceptor', carries:'Payment entity with id already set', checks:'New transaction; isNew(entity)? id != null → NO → merge()', returns:'SELECT + INSERT, then COMMIT'},
  req:{raw:`Creating new transaction with name [org.springframework.data.jpa.repository.support.SimpleJpaRepository.save]: PROPAGATION_REQUIRED,ISOLATION_DEFAULT`,parts:[['SimpleJpaRepository.save','Tx #2','A second, separate transaction.','spring']]},
  res:{raw:`Hibernate: select p1_0.payment_id,p1_0.account_number,p1_0.amount from payments p1_0 where p1_0.payment_id=?
Initiating transaction commit
Committing JPA transaction on EntityManager [SessionImpl(1834021987<open>)]
Hibernate: insert into payments (account_number,amount,payment_id) values (?,?,?)
Not closing pre-bound JPA EntityManager after transaction`,parts:[
   ['select p1_0.payment_id,p1_0.account_number,p1_0.amount','Extra SELECT','merge() must check if the row exists (see flow "JPA save").','info'],
   ['insert into payments (account_number,amount,payment_id)','INSERT at flush','Runs when commit flushes the persistence context — not at save().','info']]},
  next:'Two requests with the same paymentId can both pass transaction 1 → the second either fails on INSERT (PK violation) or, if the first already committed, its merge() finds the row and silently UPDATEs it.',spring:'<code>JpaTransactionManager</code>, Hibernate flush.',config:'—'},
 {from:'PaymentServiceImpl',to:'H2',ch:'jvm',title:'With @Transactional on create(): one transaction',
  f:{who:'Controller → PaymentServiceImpl$$SpringCGLIB$$0 (proxy)', where:'create() as ONE transaction', carries:'the whole method', checks:'Repository calls see an existing transaction → join it (REQUIRED)', returns:'one COMMIT; any RuntimeException → rollback of everything'},
  req:{raw:`@Transactional
public PaymentResponse create(PaymentRequest request) { … }

Creating new transaction with name [org.example.Service.PaymentServiceImpl.create]: PROPAGATION_REQUIRED,ISOLATION_DEFAULT`,parts:[
   ['[org.example.Service.PaymentServiceImpl.create]','Tx name','Now your method is the boundary.','spring']]},
  res:{raw:`Found thread-bound EntityManager […] for JPA transaction
Participating in existing transaction      ← existsById
Found thread-bound EntityManager […] for JPA transaction
Participating in existing transaction      ← save
Initiating transaction commit
Committing JPA transaction on EntityManager [SessionImpl(1834021987<open>)]`,parts:[
   ['Participating in existing transaction','Join','REQUIRED: repository methods join yours instead of starting their own.','spring']]},
  fail:{raw:`Duplicate id → DuplicatePaymentException (RuntimeException)
Initiating transaction rollback
Rolling back JPA transaction on EntityManager [SessionImpl(1834021987<open>)]`,parts:[['Rolling back JPA transaction','Rollback','RuntimeException → rollback. A checked exception would COMMIT by default.','spring']]},
  next:'The race is smaller but still possible; the primary key is the real guard → map DataIntegrityViolationException to 409.',spring:'<code>TransactionInterceptor</code> on your CGLIB proxy.',config:'Add <code>@Transactional</code> on <code>PaymentServiceImpl.create</code>.'}
 ]},

// ======================= BOOT =======================
{id:'boot', g:'Spring Boot', name:'java -jar → "Started" (Service B startup log)', goal:'Every line of B\'s startup log is Boot auto-configuration doing something because of a starter or a property you wrote.',
 actors:['SpringApplication','Auto-config','Tomcat','DataSource / JPA'],
 links:[['boot',1,'Explorer: startup timeline'],['boot',4,'Explorer: how a DataSource appears']],
 hops:[
 {from:'SpringApplication',to:'Auto-config',ch:'jvm',title:'Start + find repositories',
  f:{who:'main() → SpringApplication.run', where:'environment + classpath', carries:'application.properties, profiles, starters on the classpath', checks:'Which auto-configurations match (@ConditionalOnClass, @ConditionalOnMissingBean…)', returns:'bean definitions for Tomcat, DataSource, JPA, Security…'},
  req:{raw:`Starting PaymentServiceAppliaction using Java 17.0.12 with PID 20412
No active profile set, falling back to 1 default profile: "default"`,parts:[
   ['using Java 17.0.12','JVM','<java.version>17</java.version> in your pom.','info'],
   ['falling back to 1 default profile: "default"','Profiles','No spring.profiles.active → only application.properties is used.','spring']]},
  res:{raw:`Bootstrapping Spring Data JPA repositories in DEFAULT mode.
Finished Spring Data repository scanning in 31 ms. Found 1 JPA repository interface.`,parts:[['Found 1 JPA repository interface','Repositories','Your PaymentRepository — found because spring-boot-starter-data-jpa is present.','spring']]},
  next:'Web server next.',spring:'<code>SpringApplication</code>, <code>JpaRepositoriesAutoConfiguration</code>.',config:'<code>spring-boot-starter-data-jpa</code> in the pom.'},
 {from:'Auto-config',to:'Tomcat',ch:'jvm',title:'Embedded Tomcat',
  f:{who:'ServletWebServerFactoryAutoConfiguration', where:'embedded Tomcat', carries:'server.port=8081', checks:'spring-boot-starter-web on classpath → Tomcat', returns:'Tomcat initialized (not accepting requests yet)'},
  req:{raw:`server.port=8081`,parts:[['server.port=8081','Your property','From application.properties.','info']]},
  res:{raw:`Tomcat initialized with port 8081 (http)
Starting service [Tomcat]
Starting Servlet engine: [Apache Tomcat/10.1.44]
Initializing Spring embedded WebApplicationContext
Root WebApplicationContext: initialization completed in 1287 ms`,parts:[['Tomcat initialized with port 8081 (http)','Port','Bound later, at "Tomcat started".','spring']]},
  next:'DataSource and JPA.',spring:'<code>TomcatServletWebServerFactory</code>.',config:'<code>server.port</code>'},
 {from:'Auto-config',to:'DataSource / JPA',ch:'jvm',title:'H2 + Hikari + Hibernate',
  f:{who:'DataSourceAutoConfiguration, HibernateJpaAutoConfiguration', where:'connection pool + EntityManagerFactory', carries:'spring.datasource.*, spring.jpa.*', checks:'URL/driver present → Hikari; entities found → Hibernate; ddl-auto=update → alter schema', returns:'EntityManagerFactory ready (+ a warning)'},
  req:{raw:`spring.datasource.url=jdbc:h2:file:./data/paymentdb
spring.jpa.hibernate.ddl-auto=update
spring.h2.console.enabled=true`,parts:[['jdbc:h2:file:./data/paymentdb','File DB','Data survives restarts (a file in ./data).','info']]},
  res:{raw:`HikariPool-1 - Starting...
HikariPool-1 - Added connection conn0: url=jdbc:h2:file:./data/paymentdb user=SA
HikariPool-1 - Start completed.
H2 console available at '/h2-console'. Database available at 'jdbc:h2:file:./data/paymentdb'
HHH000204: Processing PersistenceUnitInfo [name: default]
Initialized JPA EntityManagerFactory for persistence unit 'default'
WARN  spring.jpa.open-in-view is enabled by default. Therefore, database queries may be performed during view rendering. Explicitly configure spring.jpa.open-in-view to disable this warning`,parts:[
   ['HikariPool-1 - Added connection conn0','Pool','Boot picked HikariCP (default pool).','spring'],
   ['H2 console available at \'/h2-console\'','H2 console','From spring.h2.console.enabled=true (you permitAll it in SecurityConfig).','spring'],
   ['spring.jpa.open-in-view is enabled by default','OSIV warning','Why the tx log says "Found thread-bound EntityManager". Set spring.jpa.open-in-view=false to remove.','spring']]},
  next:'Security + start listening.',spring:'<code>DataSourceAutoConfiguration</code>, <code>HibernateJpaAutoConfiguration</code>, <code>H2ConsoleAutoConfiguration</code>.',config:'Your <code>spring.datasource.*</code>, <code>spring.jpa.*</code>, <code>spring.h2.console.*</code>.'},
 {from:'Tomcat',to:'Tomcat',ch:'jvm',title:'Ready',
  f:{who:'SpringApplication', where:'port 8081', carries:'—', checks:'all singletons created, Tomcat connector started', returns:'app accepts requests'},
  req:{raw:`(no "Using generated security password" line: the resource-server starter is on the classpath and Boot registered a JwtDecoder bean)`,parts:[['no "Using generated security password"','Security back-off','Boot\'s default in-memory user is not created when a resource server (JwtDecoder) is configured.','spring']]},
  res:{raw:`Tomcat started on port 8081 (http) with context path '/'
Started PaymentServiceAppliaction in 4.213 seconds (process running for 4.781)`,parts:[['Tomcat started on port 8081 (http) with context path \'/\'','Listening','Now requests can arrive.','spring']]},
  next:'First request → security flow. Why did something (not) configure? Run with --debug for the conditions report.',spring:'<code>SpringApplication</code>.',config:'—'}
 ]},

// ======================= MVC & ERRORS =======================
{id:'mvc', g:'Spring MVC', name:'POST /payments inside DispatcherServlet (Service B)', goal:'With logging.level.org.springframework.web=DEBUG, Spring MVC prints each hand-off. Read the log as the wire.',
 actors:['Tomcat','DispatcherServlet','HandlerMapping','Jackson','PaymentController'],
 links:[['mvc',3,'Explorer: POST @RequestBody + @Valid'],['journey',1,'Explorer: full request journey']],
 hops:[
 {from:'Tomcat',to:'DispatcherServlet',ch:'jvm',title:'Request enters Spring MVC',
  f:{who:'Tomcat (after the security filters)', where:'DispatcherServlet.doDispatch', carries:'HttpServletRequest (method, path, headers, unread body)', checks:'—', returns:'asks the HandlerMappings who handles it'},
  req:{raw:`POST "/payments", parameters={}`,parts:[['parameters={}','Params','Query / form parameters — none here; the data is in the JSON body.','spring']]},
  res:{raw:`(DispatcherServlet → getHandler(request))`,parts:[]},
  next:'Find the controller method.',spring:'<code>DispatcherServlet</code>.',config:'See it: <code>logging.level.org.springframework.web=DEBUG</code>.'},
 {from:'DispatcherServlet',to:'HandlerMapping',ch:'jvm',title:'Which method?',
  f:{who:'DispatcherServlet', where:'RequestMappingHandlerMapping', carries:'POST + /payments', checks:'@RequestMapping("/") + @PostMapping("/payments") → match', returns:'HandlerMethod PaymentController#createPayment'},
  req:{raw:`POST /payments`,parts:[]},
  res:{raw:`Mapped to org.example.Controller.PaymentController#createPayment(PaymentRequest)`,parts:[['PaymentController#createPayment(PaymentRequest)','Handler','No match → NoResourceFoundException → your handler → 404 NOT_FOUND.','spring']]},
  next:'Resolve the method\'s arguments.',spring:'<code>RequestMappingHandlerMapping</code>.',config:'Your <code>@RequestMapping</code> / <code>@PostMapping</code>.'},
 {from:'HandlerMapping',to:'Jackson',ch:'jvm',title:'JSON → PaymentRequest (+ @Valid)',
  f:{who:'RequestMappingHandlerAdapter', where:'RequestResponseBodyMethodProcessor → Jackson', carries:'body bytes + Content-Type', checks:'Content-Type supported? (else HttpMediaTypeNotSupportedException → your catch-all → 500, not 415); JSON valid? (else HttpMessageNotReadableException → your 400); @Valid constraints', returns:'a PaymentRequest object'},
  req:{raw:`{"paymentId":"PAY-1001","accountNumber":"ACC-778899","amount":250.00}`,parts:[]},
  res:{raw:`Read "application/json" to [org.example.DTO.PaymentRequest@6b3f2c1a]`,parts:[
   ['PaymentRequest@6b3f2c1a','Object','Your DTO has no toString(), so the log shows ClassName@hash.','info']]},
  next:'Controller runs → service → repository.',spring:'<code>MappingJackson2HttpMessageConverter</code>, Bean Validation.',config:'<code>@Valid @RequestBody PaymentRequest</code>'},
 {from:'PaymentController',to:'Jackson',ch:'jvm',title:'PaymentResponse → JSON → 200',
  f:{who:'PaymentController (returns ResponseEntity.ok)', where:'return value handler → Jackson', carries:'PaymentResponse object', checks:'Content negotiation: client accepts */* → application/json', returns:'200 + JSON body'},
  req:{raw:`return ResponseEntity.ok(reponse);`,parts:[]},
  res:{raw:`Using 'application/json', given [*/*] and supported [application/json, application/*+json]
Writing [org.example.DTO.PaymentResponse@2a7e91d4]
Completed 200 OK`,parts:[
   ['given [*/*]','Accept','What the client said it accepts.','info'],
   ['Completed 200 OK','Done','DispatcherServlet finished.','spring']]},
  next:'Bytes go back through the filters (security headers) to Tomcat.',spring:'<code>RequestResponseBodyMethodProcessor</code>, <code>DispatcherServlet</code>.',config:'—'}
 ]},

{id:'errors', g:'Spring MVC', name:'Errors: what B returns and what A turns it into', goal:'B has specific handlers. A\'s only handlers for errors FROM B are 401/403 — everything else from B becomes 500 in A. Follow the exception.',
 actors:['Postman','Service A :8080','Service B :8081'],
 links:[['mvc',6,'Explorer: business exception → handler'],['mvc',7,'Explorer: 500 → /error']],
 hops:[
 {from:'Postman',to:'Service B :8081',ch:'front',title:'Invalid body directly to B',
  f:{who:'Postman', where:'B POST /payments', carries:'amount = -5', checks:'@Valid: @Positive fails → MethodArgumentNotValidException', returns:'400 VALIDATION_ERROR from your GlobalExceptionHandler'},
  req:{raw:`POST /payments HTTP/1.1
Host: localhost:8081
Authorization: Bearer eyJ…
Content-Type: application/json

{"paymentId":"PAY-1002","accountNumber":"ACC-778899","amount":-5}`,parts:[['"amount":-5','Bad value','@Positive on B\'s PaymentRequest.amount.','info']]},
  res:{raw:`HTTP/1.1 400
Content-Type: application/json

{"message":"must be greater than 0","status":400,"error":"VALIDATION_ERROR","path":"/payments","timestamp":"2026-09-27T19:40:11.482913"}`,parts:[
   ['"message":"must be greater than 0"','Message','Default Hibernate Validator message for @Positive; your handler takes the first field error.','spring'],
   ['"error":"VALIDATION_ERROR"','Your code','From handleValidationException.','info'],
   ['"timestamp":"2026-09-27T19:40:11.482913"','LocalDateTime','Written as ISO text (Boot turns off numeric dates).','spring']]},
  next:'Same request through A → next hop.',spring:'<code>RequestResponseBodyMethodProcessor</code> → <code>ExceptionHandlerExceptionResolver</code> → your <code>@RestControllerAdvice</code>.',config:'B\'s <code>GlobalExceptionHandler</code>.'},
 {from:'Service A :8080',to:'Service B :8081',ch:'back',title:'Same bad body through A',
  f:{who:'A\'s WebClient', where:'B POST /payments', carries:'amount = -5 (A has no @Valid, so it passes A)', checks:'B returns 400; retrieve() turns any 4xx/5xx into WebClientResponseException', returns:'WebClientResponseException.BadRequest thrown inside A'},
  req:{raw:`A: PaymentController.createPayment(@RequestBody PaymentRequest)   ← no @Valid, no constraints in A's DTO`,parts:[['no @Valid','A doesn\'t validate','A forwards whatever it gets.','info']]},
  res:{raw:`org.springframework.web.reactive.function.client.WebClientResponseException$BadRequest: 400 Bad Request from POST http://localhost:8081/payments`,parts:[['WebClientResponseException$BadRequest','Exception','B\'s JSON body is inside the exception (getResponseBodyAsString), not returned automatically.','spring']]},
  next:'Which of A\'s handlers catches BadRequest?',spring:'<code>WebClient.retrieve()</code> default status handler.',config:'—'},
 {from:'Service A :8080',to:'Postman',ch:'front',title:'A answers 500',
  f:{who:'A', where:'A\'s GlobalExceptionHandler', carries:'WebClientResponseException.BadRequest', checks:'Handlers for Unauthorized / Forbidden only → falls to @ExceptionHandler(Exception.class)', returns:'500 INTERNAL_SERVER_ERROR — B\'s 400 detail is lost'},
  req:{raw:`@ExceptionHandler(WebClientResponseException.Unauthorized.class)  ✗
@ExceptionHandler(WebClientResponseException.Forbidden.class)     ✗
@ExceptionHandler(Exception.class)                                ✓`,parts:[['@ExceptionHandler(Exception.class)','Catch-all','Most specific handler wins; only the catch-all matches.','spring']]},
  res:{raw:`HTTP/1.1 500
Content-Type: application/json

{"message":"An unexpected error occurred","status":500,"error":"INTERNAL_SERVER_ERROR","path":"/payments","timestamp":"2026-09-27T19:40:11.901244"}`,parts:[['"status":500','Lost detail','Same for B\'s 409 DUPLICATE_PAYMENT, and B down (WebClientRequestException: Connection refused).','info']]},
  fail:{raw:`GET /payments/NOPE through A:
  B → 404  →  A catches WebClientResponseException.NotFound
           →  throws PaymentNotFoundException (B's class, from the payment-service-b dependency)
           →  A has no handler for it → catch-all → 500`,parts:[['A has no handler for it','404 becomes 500','Interview line: map downstream errors on purpose (e.g. onStatus / handlers for WebClientResponseException), don\'t let them fall to the catch-all.','info']]},
  next:'Interview answer: "An exception walks back up until the most specific @ExceptionHandler; downstream 4xx must be mapped explicitly or they become 500."',spring:'<code>ExceptionHandlerExceptionResolver</code> (most specific exception type wins).',config:'A\'s <code>GlobalExceptionHandler</code>.'}
 ]},

// ======================= JPA =======================
{id:'jpa', g:'Spring Data JPA', name:'save() with an assigned String id → SELECT + INSERT', goal:'Your Payment id is a String you set yourself. That changes what save() does. The SQL log is the wire.',
 actors:['PaymentServiceImpl','SimpleJpaRepository','Hibernate','H2'],
 links:[['jpa',3,'Explorer: dirty checking'],['jpa',8,'Explorer: optimistic locking']],
 hops:[
 {from:'PaymentServiceImpl',to:'SimpleJpaRepository',ch:'jvm',title:'save(entity): new or not?',
  f:{who:'your service', where:'SimpleJpaRepository.save', carries:'Payment{id="PAY-1001", …}', checks:'entityInformation.isNew(entity): no @Version and id is not null → NOT new', returns:'em.merge(entity) (not persist)'},
  req:{raw:`Payment paymentEntity = new Payment();
paymentEntity.setId(request.getPaymentId());   // "PAY-1001"
paymentRepository.save(paymentEntity);`,parts:[['setId(request.getPaymentId())','Assigned id','No @GeneratedValue — you set the id.','info']]},
  res:{raw:`isNew(entity) → false   → entityManager.merge(entity)`,parts:[['entityManager.merge(entity)','merge','With a generated id (null before save) it would be persist() and no SELECT.','spring']]},
  next:'merge must find out if PAY-1001 already exists.',spring:'<code>SimpleJpaRepository.save</code>, <code>JpaMetamodelEntityInformation.isNew</code>.',config:'<code>@Id @Column(name = "payment_id") private String id;</code>'},
 {from:'Hibernate',to:'H2',ch:'jvm',title:'merge → SELECT',
  f:{who:'Hibernate', where:'H2 table payments', carries:'id PAY-1001', checks:'Is it in the persistence context? No → SELECT by id', returns:'no row → Hibernate creates a new managed copy'},
  req:{raw:`em.merge(Payment{PAY-1001})`,parts:[]},
  res:{raw:`Hibernate:
    select
        p1_0.payment_id,
        p1_0.account_number,
        p1_0.amount
    from
        payments p1_0
    where
        p1_0.payment_id=?`,parts:[
   ['payments p1_0','Table + alias','@Table(name = "payments"); Hibernate 6 aliases p1_0.','info'],
   ['p1_0.payment_id=?','Bound parameter','"?" = prepared statement; the value is bound separately (no SQL injection). Pretty-printed because format_sql=true.','spring']]},
  next:'Managed copy waits in the persistence context until flush.',spring:'Hibernate <code>DefaultMergeEventListener</code>.',config:'<code>spring.jpa.show-sql=true</code>, <code>format_sql=true</code>'},
 {from:'Hibernate',to:'H2',ch:'jvm',title:'Commit → flush → INSERT',
  f:{who:'JpaTransactionManager commit → Hibernate flush', where:'H2', carries:'the new managed Payment', checks:'Dirty / new entities in the persistence context', returns:'INSERT, then COMMIT'},
  req:{raw:`Initiating transaction commit`,parts:[]},
  res:{raw:`Hibernate:
    insert
    into
        payments
        (account_number, amount, payment_id)
    values
        (?, ?, ?)`,parts:[
   ['(account_number, amount, payment_id)','Columns','Field accountNumber → column account_number (Boot\'s naming strategy). Id column last.','spring']]},
  next:'Total for one create: count(*) + select + insert = 3 SQL statements.',spring:'Hibernate <code>ActionQueue</code> flush.',config:'—'},
 {from:'PaymentServiceImpl',to:'H2',ch:'jvm',title:'How to make it 2 statements',
  f:{who:'you', where:'the Payment entity', carries:'—', checks:'Tell Spring Data the entity is new', returns:'persist() → INSERT only'},
  req:{raw:`Option 1: implement Persistable<String> and return isNew() = true for new objects
Option 2: add @Version Long version (null = new)
Option 3: skip existsById, just insert and map the primary-key violation to 409`,parts:[['@Version Long version','@Version','Also gives optimistic locking for updates.','spring']]},
  res:{raw:`Hibernate: select count(*) from payments p1_0 where p1_0.payment_id=?
Hibernate: insert into payments (account_number,amount,version,payment_id) values (?,?,?,?)`,parts:[]},
  next:'Interview line: "save() = persist for new, merge for existing; an assigned id looks existing, so Spring Data does an extra SELECT."',spring:'<code>JpaMetamodelEntityInformation</code>.',config:'Payment entity.'}
 ]},

// ======================= KAFKA =======================
{id:'kafka', g:'Kafka (if SecurePay publishes events)', name:'PaymentCreated: send → partition → consume → DLT', goal:'Not in your project yet. If B published an event after saving, this is what travels.',
 actors:['Service B','Kafka broker','Consumer','DLT'],
 links:[['kafka',1,'Explorer: publish'],['kafka',4,'Explorer: retries → DLT']],
 hops:[
 {from:'Service B',to:'Kafka broker',ch:'back',title:'send()',
  f:{who:'KafkaTemplate in B', where:'topic payments.events', carries:'key PAY-1001 + JSON value + __TypeId__ header', checks:'Serializer; partition = hash(key) % partitions', returns:'RecordMetadata topic-partition@offset'},
  req:{raw:`ProducerRecord(topic=payments.events, partition=null, headers=RecordHeaders(headers = [RecordHeader(key = __TypeId__, value = [111, 114, 103, …])], isReadOnly = true), key=PAY-1001, value=PaymentCreated[paymentId=PAY-1001, amount=250.00], timestamp=null)`,parts:[
   ['partition=null','partition','Not chosen by you → the producer hashes the key.','spring'],
   ['__TypeId__','Type header','Added by Spring\'s JsonSerializer so the consumer knows the class.','spring'],
   ['key=PAY-1001','key','Same key → same partition → ordered per payment.','public']]},
  res:{raw:`payments.events-1@17`,parts:[['payments.events-1@17','RecordMetadata','topic-partition@offset: partition 1, offset 17.','info']]},
  next:'Consumers in group "notifications" read partition 1.',spring:'<code>KafkaTemplate</code>, <code>JsonSerializer</code>.',config:'<code>spring.kafka.producer.*</code>'},
 {from:'Kafka broker',to:'Consumer',ch:'back',title:'Consumer receives it',
  f:{who:'listener container', where:'@KafkaListener(topics="payments.events")', carries:'ConsumerRecord (bytes → object)', checks:'Deserializer; your listener logic', returns:'success → offset committed'},
  req:{raw:`ConsumerRecord(topic = payments.events, partition = 1, leaderEpoch = 0, offset = 17, CreateTime = @@T0@@000, serialized key size = 8, serialized value size = 52, headers = RecordHeaders(…), key = PAY-1001, value = PaymentCreated[…])`,parts:[['offset = 17','offset','Position in the partition; committed after success.','info']]},
  res:{raw:`listener returns normally → offset 18 committed for group "notifications"`,parts:[]},
  next:'If the listener throws → error handler.',spring:'<code>KafkaMessageListenerContainer</code>.',config:'<code>spring.kafka.consumer.*</code>'},
 {from:'Consumer',to:'DLT',ch:'back',title:'Fails 4 times (1 + 3 retries) → dead-letter topic',
  f:{who:'DefaultErrorHandler', where:'topic payments.events-dlt', carries:'original record + failure headers', checks:'Retries exhausted (FixedBackOff)', returns:'record parked, offset moves on'},
  req:{raw:`new DefaultErrorHandler(new DeadLetterPublishingRecoverer(template), new FixedBackOff(1000L, 3))`,parts:[['FixedBackOff(1000L, 3)','Back-off','1 s apart, 3 retries after the first try.','spring']]},
  res:{raw:`topic: payments.events-dlt
headers:
  kafka_dlt-exception-fqcn     = org.springframework.kafka.listener.ListenerExecutionFailedException
  kafka_dlt-exception-message  = Listener method 'public void …onPaymentCreated(…)' threw exception; <cause message>
  kafka_dlt-original-topic     = payments.events
  kafka_dlt-original-partition = 1
  kafka_dlt-original-offset    = 17`,parts:[['kafka_dlt-original-offset','DLT headers','Tell you exactly which record failed and why.','spring']]},
  next:'Fix, then replay from the DLT.',spring:'<code>DeadLetterPublishingRecoverer</code>.',config:'An error-handler bean.'}
 ]},

// ======================= OBSERVABILITY =======================
{id:'obs', g:'Observability (if you add tracing)', name:'One traceId across A → B', goal:'Not in your project yet (needs actuator + micrometer-tracing). Shows what travels and one real trap in your WebClientConfig.',
 actors:['Postman','Service A :8080','Service B :8081'],
 links:[['obs',1,'Explorer: one trace across services'],['obs',4,'Explorer: why the trace breaks']],
 hops:[
 {from:'Postman',to:'Service A :8080',ch:'front',title:'A starts a trace',
  f:{who:'Postman (no trace header)', where:'A', carries:'no traceparent', checks:'ServerHttpObservationFilter: no incoming trace → start one', returns:'traceId + spanId in every A log line'},
  req:{raw:`POST /payments HTTP/1.1   (no traceparent header)`,parts:[]},
  res:{raw:`2026-09-27T19:40:11.120-04:00  INFO 20411 --- [PaymentA] [nio-8080-exec-1] [4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7] c.e.P.Controller.PaymentController       : creating payment PAY-1001`,parts:[
   ['[4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7]','[traceId-spanId]','Boot\'s log correlation: 32-hex traceId, 16-hex spanId.','spring']]},
  next:'A calls B.',spring:'<code>ServerHttpObservationFilter</code>, Micrometer Tracing.',config:'actuator + <code>micrometer-tracing-bridge-otel</code>.'},
 {from:'Service A :8080',to:'Service B :8081',ch:'back',title:'A → B: does the trace travel?',
  f:{who:'A\'s WebClient', where:'B', carries:'traceparent header — ONLY if the WebClient is instrumented', checks:'Your WebClientConfig uses WebClient.builder() (static) → not instrumented → no header', returns:'B starts a NEW traceId → trace broken'},
  req:{raw:`Today:   WebClient.builder()                 → no traceparent
Fix:     inject Boot's WebClient.Builder     → traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-a3ce929d0e0e4736-01`,parts:[
   ['WebClient.builder()','Static builder','Not Boot\'s auto-configured builder → no observation.','info'],
   ['00-4bf92f3577b34da6a3ce929d0e0e4736-a3ce929d0e0e4736-01','traceparent','W3C format: version-traceId-parentSpanId-flags. Same traceId, new parent span. Flags 01 = sampled (Boot samples 10% by default; use management.tracing.sampling.probability=1.0 while learning).','public']]},
  res:{raw:`B log: [payment-service-b] [nio-8081-exec-3] [4bf92f3577b34da6a3ce929d0e0e4736-7d2c91e0b4a5f613] …`,parts:[['4bf92f3577b34da6a3ce929d0e0e4736','Same traceId','grep this id in A and B logs = the whole request.','spring']]},
  next:'Metrics are recorded per request too.',spring:'<code>WebClient.Builder</code> customized by Boot (observation registry).',config:'<code>public WebClient webClient(WebClient.Builder builder)</code>'},
 {from:'Service B :8081',to:'Service B :8081',ch:'jvm',title:'Metrics + health',
  f:{who:'Prometheus / Kubernetes', where:'/actuator/prometheus, /actuator/health', carries:'—', checks:'exposure settings; health details default never', returns:'text metrics / {"status":"UP"}'},
  req:{raw:`GET /actuator/prometheus
GET /actuator/health`,parts:[]},
  res:{raw:`http_server_requests_seconds_count{error="none",exception="none",method="POST",outcome="SUCCESS",status="200",uri="/payments"} 1

{"status":"UP"}`,parts:[
   ['uri="/payments"','Tags','uri is the mapping pattern (not /payments/PAY-1001) to keep cardinality low.','spring'],
   ['{"status":"UP"}','Health','Details hidden by default (show-details=never).','spring']]},
  next:'Your /actuator/health permitAll in SecurityConfig becomes useful once actuator is added.',spring:'Micrometer, Actuator.',config:'<code>management.endpoints.web.exposure.include=health,prometheus</code>'}
 ]}
];
