"""Builds wire.html: "Dissect a request" — real HTTP messages hop by hop, every piece explained,
how each hop's output becomes the next hop's input, and a dissector for your own URLs / JWTs / headers.
Usage: python3 build_wire.py [OUT]"""
import base64, hashlib, json, os, sys, datetime

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../site/wire.html')


def b64u(b):
    return base64.urlsafe_b64encode(b).decode().rstrip('=')


def jwt(header, payload, sig_seed):
    h = b64u(json.dumps(header, separators=(',', ':')).encode())
    p = b64u(json.dumps(payload, separators=(',', ':')).encode())
    s = b64u(hashlib.sha512(sig_seed.encode()).digest() * 4)[:342]
    return h + '.' + p + '.' + s


CID = '1234567890-abc123def456.apps.googleusercontent.com'
SECRET = 'GOCSPX-demo-secret'
STATE_RAW = 'Zk3rQ9vX2mT8bL1pW7yN4cJ6hD0sA5eF3gK9uR2iO8o='
STATE_URL = STATE_RAW.replace('=', '%3D')
NONCE_HASH = b64u(hashlib.sha256(b'raw-nonce-kept-in-session').digest())
CODE_RAW = '4/0AeanS0bX7kLm2pQ9rTz5vW1yB3nC8dF6gH0jK4lM'
CODE_URL = CODE_RAW.replace('/', '%2F')
T0 = int(datetime.datetime(2026, 9, 27, 22, 40, 0, tzinfo=datetime.timezone.utc).timestamp())
BASIC_G = base64.b64encode((CID + ':' + SECRET).encode()).decode()
BASIC_A = base64.b64encode(b'service-a:secret').decode()

GOOGLE_IDT = jwt({'alg': 'RS256', 'kid': 'a1b2c3d4e5f6', 'typ': 'JWT'},
                 {'iss': 'https://accounts.google.com', 'azp': CID, 'aud': CID, 'sub': '110248495921238986420',
                  'email': 'demo.user@gmail.com', 'email_verified': True, 'at_hash': 'HK6E_P6Dh8Y93mRNtsDB1Q',
                  'nonce': NONCE_HASH, 'name': 'Demo User', 'given_name': 'Demo', 'family_name': 'User',
                  'iat': T0, 'exp': T0 + 3600}, 'google')
SAS_JWT = jwt({'kid': '3f9c2e1a-7b4d-4e8a-9c21-5d6e7f809a1b', 'alg': 'RS256'},
              {'sub': 'service-a', 'aud': 'service-a', 'nbf': T0, 'scope': ['payments.write'],
               'iss': 'http://localhost:9000', 'exp': T0 + 300, 'iat': T0, 'jti': '9b1e6c2a-44d0-4f3b-8e57-0c2a9d1f7e63'}, 'sas')
SAS_SHORT = SAS_JWT[:24] + '…' + SAS_JWT[-10:]

REP = {'@@CID@@': CID, '@@SECRET@@': SECRET, '@@STATE_RAW@@': STATE_RAW, '@@STATE@@': STATE_URL, '@@NONCE@@': NONCE_HASH,
       '@@CODE_RAW@@': CODE_RAW, '@@CODE@@': CODE_URL, '@@BASIC_G@@': BASIC_G, '@@BASIC_A@@': BASIC_A,
       '@@GIDT@@': GOOGLE_IDT, '@@SASJWT@@': SAS_JWT, '@@SASSHORT@@': SAS_SHORT, '@@T0@@': str(T0),
       '@@EXP@@': datetime.datetime.fromtimestamp(T0 + 300, datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}

PAGE = r'''<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Dissect a Request</title>
<style>
:root{color-scheme:dark;--bg:#000;--ink:#fff;--muted:#a3a3a3;--faint:#6b6b6b;--line:#2a2a2a;--panel:#0c0e11;--active:#f0a35c;--link:#5cc8f0;
--public:#5cc8f0;--secret:#ff6b6b;--onetime:#f2c14e;--signed:#b58cff;--spring:#5fd38d;--internal:#8a8f98;--info:#d8d8d8}
html{background:var(--bg);scroll-padding-top:120px}
body{background:var(--bg);color:var(--ink);font:15px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;margin:0}
a{color:var(--link)}
.top{position:sticky;top:0;z-index:5;background:rgba(0,0,0,.94);border-bottom:1px solid var(--line);padding:10px 16px;display:flex;gap:14px;flex-wrap:wrap;align-items:center}
.top b{margin-right:auto}
.top a{text-decoration:none;font-size:14px}
.wrap{max-width:980px;margin:0 auto;padding:16px 16px 60px;display:grid;gap:14px}
.wrap>*{min-width:0}
h1{margin:6px 0 0;font-size:26px}
.sub{color:var(--muted);margin:4px 0 0}
.card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px 16px;display:grid;gap:10px}
.card>*{min-width:0}
.card h2{margin:0;font-size:19px}
.card h3{margin:0;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--active)}
.card p{margin:0}
.tabs{display:flex;flex-wrap:wrap;gap:6px}
.tab{border:1px solid #3a414b;background:#15181d;color:var(--ink);border-radius:8px;padding:7px 11px;font:inherit;font-size:14px;cursor:pointer}
.tab.on{border-color:var(--active);background:#2a2012}
.lanes{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.lane{border:1px solid var(--line);border-radius:999px;padding:3px 10px;font-size:13px;color:var(--muted)}
.lane.from{border-color:var(--active);color:#000;background:var(--active);font-weight:700}
.lane.to{border-color:var(--active);color:var(--active);font-weight:700}
.arrow{color:var(--active);font-weight:700}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.chip{min-width:30px;height:30px;border-radius:8px;border:1px solid #3a414b;background:#15181d;color:var(--ink);font:inherit;font-size:13px;cursor:pointer}
.chip.on{background:var(--active);color:#000;border-color:var(--active);font-weight:700}
.ch{display:inline-block;font-size:11px;font-weight:700;border-radius:4px;padding:1px 7px;margin-left:6px;vertical-align:2px}
.ch.front{background:#0f2230;color:var(--public)}.ch.back{background:#2b1414;color:var(--secret)}.ch.jvm{background:#10261a;color:var(--spring)}.ch.user{background:#1a1c20;color:var(--internal)}
.nav{display:flex;gap:8px}
.btn{border:1px solid #3a414b;background:#15181d;color:var(--ink);border-radius:8px;padding:7px 12px;font:inherit;font-size:14px;cursor:pointer}
.btn:disabled{opacity:.4;cursor:default}
.btn.primary{border-color:var(--active)}
pre.raw{margin:0;background:#050608;border:1px solid var(--line);border-radius:8px;padding:10px 12px;overflow-x:auto;font:12.5px/1.6 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#e8e8e8;white-space:pre-wrap;word-break:break-all}
.tk{border-radius:3px;cursor:pointer;border-bottom:2px solid}
.tk.public{border-color:var(--public)}.tk.secret{border-color:var(--secret)}.tk.onetime{border-color:var(--onetime)}.tk.signed{border-color:var(--signed)}.tk.spring{border-color:var(--spring)}.tk.internal{border-color:var(--internal)}.tk.info{border-color:#555}
.tk.hl{background:#3a2a10}
.parts{display:grid;gap:6px;margin:0;padding:0;list-style:none}
.pt{display:grid;grid-template-columns:minmax(120px,190px) 1fr;gap:4px 12px;border:1px solid var(--line);border-radius:8px;padding:7px 10px;background:#07090b;cursor:pointer}
.pt.hl{border-color:var(--active)}
.pt .nm{font-weight:600;font-size:14px;overflow-wrap:anywhere}
.pt .mn{color:#d8d8d8;font-size:14px}
.kd{display:inline-block;font-size:10.5px;font-weight:700;letter-spacing:.04em;border-radius:4px;padding:0 6px;margin-top:3px}
.kd.public{background:#0f2230;color:var(--public)}.kd.secret{background:#2b1414;color:var(--secret)}.kd.onetime{background:#2a2410;color:var(--onetime)}.kd.signed{background:#1e1630;color:var(--signed)}.kd.spring{background:#10261a;color:var(--spring)}.kd.internal{background:#1a1c20;color:var(--internal)}.kd.info{background:#1a1c20;color:var(--info)}
@media (max-width:640px){.pt{grid-template-columns:1fr}}
body.practice .pt:not(.open) .mn{filter:blur(6px)}
.box{border-left:3px solid var(--active);padding:6px 10px;background:#0a0c0f;border-radius:0 8px 8px 0}
.box b{color:var(--active)}
.meta{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.meta>*{min-width:0}
@media (max-width:640px){.meta{grid-template-columns:1fr}}
code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.88em;color:#e6d3b8;overflow-wrap:anywhere}
.legend{display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:13px;color:var(--muted)}
.toggle{display:inline-flex;gap:8px;align-items:center;border:1px solid #3a414b;border-radius:8px;padding:6px 10px;background:#15181d;cursor:pointer;font-size:14px}
.go{display:inline-block;border:1px solid #3a414b;border-radius:6px;padding:5px 10px;text-decoration:none;font-size:13.5px;background:#15181d;color:var(--ink)}
.links{display:flex;flex-wrap:wrap;gap:8px}
textarea{width:100%;box-sizing:border-box;min-height:110px;background:#050608;color:#e8e8e8;border:1px solid #3a414b;border-radius:8px;padding:10px;font:12.5px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
ol.steps{margin:0;padding-left:20px;display:grid;gap:4px}
.hidden{display:none!important}
</style>
<nav class="top"><b>Dissect a Request</b><a href="index.html">Explorer</a><a href="learn.html">Study guide</a><a href="dev.html">Build it</a></nav>
<main class="wrap">
 <header><h1>Dissect a request</h1><p class="sub">Real messages on the wire, hop by hop. <b>Observe</b> the raw request → <b>dissect</b> every piece → <b>follow</b> what it turns into at the next hop → <b>map</b> it to your config and Spring class. Tap any underlined piece.</p></header>
 <section class="card">
  <div class="tabs" id="tabs"></div>
  <div class="legend"><label class="toggle"><input type="checkbox" id="practice"> Practice: hide meanings</label>
   <span class="kd public">PUBLIC</span><span class="kd secret">SECRET</span><span class="kd onetime">ONE-TIME</span><span class="kd signed">SIGNED</span><span class="kd spring">SET BY SPRING</span><span class="kd internal">PROVIDER-INTERNAL</span></div>
 </section>
 <section id="flowView" class="card"></section>
 <section id="own" class="card hidden"></section>
</main>
<script>
const FLOWS = [
{id:'google', name:'1 · Login with Google', goal:'Your Spring Boot app (like Zomato) lets a user log in with Google. OAuth2 authorization code flow + OpenID Connect, done by spring-boot-starter-oauth2-client.',
 actors:['Browser','Your app :8080','Google'],
 links:[['security',12,'Inside: /oauth2/authorize → code'],['security',13,'Inside: /oauth2/token code → JWT']],
 hops:[
 {from:'Browser',to:'Your app :8080',ch:'front',title:'User clicks "Login with Google"',
  req:{raw:`GET /oauth2/authorization/google HTTP/1.1
Host: localhost:8080`,parts:[
   ['/oauth2/authorization/google','Login link','Spring\'s default start URL: /oauth2/authorization/{registrationId}. "google" is the registration id from your yml.','spring'],
   ['Host: localhost:8080','Host','Which site the browser is talking to.','info']]},
  res:{raw:`HTTP/1.1 302
Location: https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=@@CID@@&scope=openid%20profile%20email&state=@@STATE@@&redirect_uri=http://localhost:8080/login/oauth2/code/google&nonce=@@NONCE@@
Set-Cookie: JSESSIONID=8C1D5E2F90; Path=/; HttpOnly`,parts:[
   ['302','302 redirect','"Go to this other URL instead." The browser follows Location automatically. (Tomcat sends no reason phrase after the number.)','info'],
   ['Location: https://accounts.google.com/o/oauth2/v2/auth','Location','The full Google authorization URL that Spring just built. Dissected in hop 2.','spring'],
   ['JSESSIONID=8C1D5E2F90','New session cookie','First visit, so a new session is created. Spring saved the authorization request (state, raw nonce, redirect_uri) in the HTTP session. This cookie is how it finds it again in hop 4.','spring']]},
  next:'The browser follows <code>Location</code> → hop 2 is a GET to Google with those query params.',
  spring:'<code>OAuth2AuthorizationRequestRedirectFilter</code> → <code>DefaultOAuth2AuthorizationRequestResolver</code> builds the URL; <code>HttpSessionOAuth2AuthorizationRequestRepository</code> saves it.',
  config:'<code>spring.security.oauth2.client.registration.google.client-id</code> (scopes and Google URLs come from Spring\'s built-in Google preset).'},

 {from:'Browser',to:'Google',ch:'front',title:'Authorization request (the URL in the video)',
  req:{raw:`GET /o/oauth2/v2/auth?response_type=code&client_id=@@CID@@&scope=openid%20profile%20email&state=@@STATE@@&redirect_uri=http://localhost:8080/login/oauth2/code/google&nonce=@@NONCE@@ HTTP/1.1
Host: accounts.google.com`,parts:[
   ['/o/oauth2/v2/auth','Authorization endpoint','Google\'s login + consent page. = authorization-uri in the provider config.','info'],
   ['response_type=code','response_type','"Give me a one-time code" = authorization code flow. The token comes later, server-to-server.','public'],
   ['client_id=@@CID@@','client_id','Your app\'s public id at Google. Anyone can see it (it\'s in the URL). It is NOT the secret.','public'],
   ['scope=openid%20profile%20email','scope','What you ask for. %20 is a space. "openid" makes it OpenID Connect → you get an id_token (who the user is).','public'],
   ['state=@@STATE@@','state','Random value Spring stored in the session. Google sends it back unchanged; Spring compares → stops CSRF / forged callbacks. %3D is "=".','spring'],
   ['redirect_uri=http://localhost:8080/login/oauth2/code/google','redirect_uri','Where Google sends the user back. Must exactly match a URI registered in Google Cloud Console, else "redirect_uri_mismatch".','public'],
   ['nonce=@@NONCE@@','nonce','SHA-256 hash of a random value kept in the session. Google copies it into the id_token → Spring checks it → a stolen old id_token can\'t be replayed.','spring']]},
  res:{raw:`HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8

<html> Google "Choose an account" page </html>`,parts:[
   ['Content-Type: text/html','HTML page','Google shows its own sign-in page. From here Google adds its own internal params (flowName, dsh, gsiwebsdk… like in the video) — not part of OAuth.','internal']]},
  next:'Your app is out of the picture until Google redirects back. No client_secret anywhere in the browser.',
  spring:'Nothing — the browser is talking to Google directly.',config:'Register <code>http://localhost:8080/login/oauth2/code/google</code> as an authorized redirect URI in Google Cloud Console.'},

 {from:'Browser',to:'Google',ch:'user',title:'User signs in and clicks Allow',
  req:{raw:`(Google's own pages: password or passkey, 2-step, consent)
"Your app wants: name, email address, profile picture"  [Allow]`,parts:[
   ['password or passkey','Credentials','Go only to Google. Your app never sees the password — the whole point of OAuth.','internal'],
   ['[Allow]','Consent','User agrees to the requested scopes.','internal']]},
  res:{raw:`HTTP/1.1 302 Found
Location: http://localhost:8080/login/oauth2/code/google?state=@@STATE@@&code=@@CODE@@&scope=email%20profile%20openid%20https://www.googleapis.com/auth/userinfo.email%20https://www.googleapis.com/auth/userinfo.profile&authuser=0&prompt=consent`,parts:[
   ['http://localhost:8080/login/oauth2/code/google','Back to redirect_uri','Google sends the browser back to the exact redirect_uri from hop 2.','public'],
   ['state=@@STATE@@','state (echo)','Same value as hop 2. Spring will compare it with the one in the session.','spring'],
   ['code=@@CODE@@','code','ONE-TIME authorization code, valid for minutes. Useless alone: exchanging it needs the client_secret (hop 5). %2F is "/".','onetime'],
   ['scope=email%20profile%20openid','scope (granted)','What the user actually granted. Google expands profile/email into full URL names.','public'],
   ['authuser=0&prompt=consent','Google extras','Google-specific params. Spring ignores them.','internal']]},
  next:'The browser follows this Location → hop 4 hits your app with the code.',spring:'—',config:'—'},

 {from:'Browser',to:'Your app :8080',ch:'front',title:'Callback with the code',
  req:{raw:`GET /login/oauth2/code/google?state=@@STATE@@&code=@@CODE@@&scope=email%20profile%20openid%20...&authuser=0&prompt=consent HTTP/1.1
Host: localhost:8080
Cookie: JSESSIONID=8C1D5E2F90`,parts:[
   ['/login/oauth2/code/google','Callback path','Default redirect template {baseUrl}/login/oauth2/code/{registrationId}. Spring\'s login filter listens on /login/oauth2/code/*.','spring'],
   ['state=@@STATE@@','state check','Spring removes the saved request from the session only if its state equals this state. No session or a different state → error [authorization_request_not_found].','spring'],
   ['code=@@CODE@@','code','Taken out of the URL and sent to Google in hop 5.','onetime'],
   ['JSESSIONID=8C1D5E2F90','Session cookie','Same session as hop 1 → finds the saved authorization request.','spring']]},
  res:{raw:`(no response yet — before answering the browser, Spring makes
 three server-to-server calls to Google: hops 5, 6, 7)`,parts:[]},
  next:'The code leaves the browser world. Everything until hop 8 is back channel (server → Google).',
  spring:'<code>OAuth2LoginAuthenticationFilter</code> → <code>OidcAuthorizationCodeAuthenticationProvider</code>.',config:'—'},

 {from:'Your app :8080',to:'Google',ch:'back',title:'Exchange code for tokens (the "token in exchange" part)',
  req:{raw:`POST /oauth2/v4/token HTTP/1.1
Host: www.googleapis.com
Authorization: Basic @@BASIC_G@@
Content-Type: application/x-www-form-urlencoded;charset=UTF-8
Accept: application/json;charset=UTF-8

grant_type=authorization_code&code=@@CODE@@&redirect_uri=http%3A%2F%2Flocalhost%3A8080%2Flogin%2Foauth2%2Fcode%2Fgoogle`,parts:[
   ['/oauth2/v4/token','Token endpoint','= token-uri. The browser never calls this; only your server does.','info'],
   ['Basic @@BASIC_G@@','client_id:client_secret','Base64 of "client_id:client_secret" (client_secret_basic, Spring\'s default). Base64 is encoding, NOT encryption — decode it in the Dissect tab. Only HTTPS protects it. THIS is where the secret travels.','secret'],
   ['grant_type=authorization_code','grant_type','"I\'m trading a code for tokens."','public'],
   ['code=@@CODE@@','code','The one-time code from hop 3. Google marks it used.','onetime'],
   ['redirect_uri=http%3A%2F%2Flocalhost%3A8080%2Flogin%2Foauth2%2Fcode%2Fgoogle','redirect_uri','Form-encoded (%3A = ":", %2F = "/"). Must be the same as in hop 2 — Google checks.','public']]},
  res:{raw:`HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
Cache-Control: no-cache, no-store, max-age=0, must-revalidate

{
  "access_token": "ya29.a0AfB_byC3demoAccessToken",
  "expires_in": 3599,
  "scope": "openid https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email",
  "token_type": "Bearer",
  "id_token": "@@GIDT@@"
}`,parts:[
   ['"access_token": "ya29.a0AfB_byC3demoAccessToken"','access_token','Key for calling Google APIs (userinfo in hop 7). Opaque to you — not a JWT here. Keep it secret.','secret'],
   ['"expires_in": 3599','expires_in','Seconds until the access token expires (~1 hour).','info'],
   ['"token_type": "Bearer"','token_type','Use it as "Authorization: Bearer …". Whoever holds it can use it.','info'],
   ['"id_token": "','id_token','A JWT that says WHO the user is. header.payload.signature — decoded in hop 6. No refresh_token: Google only sends one with access_type=offline.','signed']]},
  next:'Spring must verify the id_token signature before trusting it → needs Google\'s public keys (hop 6).',
  spring:'Token response client inside <code>OidcAuthorizationCodeAuthenticationProvider</code>.',
  config:'<code>client-secret</code>; token-uri from the Google preset; <code>client-authentication-method</code> defaults to <code>client_secret_basic</code>.'},

 {from:'Your app :8080',to:'Google',ch:'back',title:'Fetch Google\'s public keys and verify the id_token',
  req:{raw:`GET /oauth2/v3/certs HTTP/1.1
Host: www.googleapis.com`,parts:[['/oauth2/v3/certs','JWKS endpoint','Google\'s public keys (JSON Web Key Set) = jwk-set-uri. Cached — not fetched on every login.','public']]},
  res:{raw:`HTTP/1.1 200 OK
Content-Type: application/json; charset=UTF-8

{ "keys": [ { "kid": "a1b2c3d4e5f6", "kty": "RSA", "alg": "RS256", "use": "sig",
              "n": "0vx7agoebGcQSuu…", "e": "AQAB" } ] }`,parts:[
   ['"kid": "a1b2c3d4e5f6"','kid','Key id. The id_token header says which kid signed it → Spring picks this key.','public'],
   ['"n": "0vx7agoebGcQSuu…", "e": "AQAB"','RSA public key','Can only VERIFY signatures. Google keeps the private key that signs.','public']]},
  dec:{title:'id_token decoded',raw:`HEADER   {"alg":"RS256","kid":"a1b2c3d4e5f6","typ":"JWT"}
PAYLOAD  {"iss":"https://accounts.google.com",
          "azp":"@@CID@@",
          "aud":"@@CID@@",
          "sub":"110248495921238986420",
          "email":"demo.user@gmail.com","email_verified":true,
          "nonce":"@@NONCE@@",
          "name":"Demo User","iat":@@T0@@,"exp":@@T0@@+3600}
SIGNATURE (RS256 over header.payload — checked with the kid key)`,parts:[
   ['"iss":"https://accounts.google.com"','iss','Who issued it. Must equal the provider issuer-uri.','signed'],
   ['"aud":"@@CID@@"','aud','Who it is for. Must contain YOUR client_id — a token made for another app is rejected.','signed'],
   ['"sub":"110248495921238986420"','sub','Google\'s stable user id. Use this (not email) as the key for the user in your DB.','signed'],
   ['"nonce":"@@NONCE@@"','nonce','Must equal the hash of the nonce saved in hop 1.','signed'],
   ['"exp":@@T0@@+3600','exp','Expiry (epoch seconds). Expired → rejected.','signed'],
   ['SIGNATURE','Signature','If one character of header or payload changes, the check fails. That\'s why the payload can be readable yet trusted.','signed']]},
  next:'id_token is now trusted, and it already contains name, email and picture. Hop 7 (userinfo) is optional.',
  spring:'<code>OidcIdTokenDecoderFactory</code> → <code>NimbusJwtDecoder</code> + <code>OidcIdTokenValidator</code>.',config:'jwk-set-uri, issuer-uri from the Google preset.'},

 {from:'Your app :8080',to:'Google',ch:'back',title:'(Optional) Load user info — skipped by default for Google',
  req:{raw:`GET /oauth2/v3/userinfo HTTP/1.1
Host: www.googleapis.com
Authorization: Bearer ya29.a0AfB_byC3demoAccessToken`,parts:[
   ['/oauth2/v3/userinfo','UserInfo endpoint','= user-info-uri. OidcUserService calls it only if the token response scopes contain profile/email/address/phone exactly. Google returns full URL scope names (hop 5), so by default Spring SKIPS this call. It runs only if you configure it, e.g. oidcUserService.setAccessibleScopes(Set.of()).','spring'],
   ['Bearer ya29.a0AfB_byC3demoAccessToken','Bearer token','The access_token from hop 5 is used for the first (and here only) time.','secret']]},
  res:{raw:`HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{ "sub": "110248495921238986420", "name": "Demo User", "given_name": "Demo",
  "family_name": "User", "picture": "https://lh3.googleusercontent.com/a/demo",
  "email": "demo.user@gmail.com", "email_verified": true }`,parts:[
   ['"sub": "110248495921238986420"','sub','Must match the id_token sub, else Spring rejects.','public'],
   ['"picture": "https://lh3.googleusercontent.com/a/demo"','Profile fields','Merged with the id_token claims into one OidcUser.','public']]},
  next:'With or without hop 7, Spring now has a logged-in user: DefaultOidcUser (id_token claims [+ userinfo] + authorities OIDC_USER, SCOPE_…).',
  spring:'<code>OidcUserService</code> → <code>DefaultOidcUser</code>.',config:'Customise by declaring your own <code>OAuth2UserService&lt;OidcUserRequest, OidcUser&gt;</code> bean (e.g. to save the user in your DB).'},

 {from:'Your app :8080',to:'Browser',ch:'front',title:'Logged in: new session, redirect home',
  req:{raw:`(answer to the hop 4 request)`,parts:[]},
  res:{raw:`HTTP/1.1 302
Location: http://localhost:8080/
Set-Cookie: JSESSIONID=E77B03A6C2; Path=/; HttpOnly`,parts:[
   ['Location: http://localhost:8080/','Location','The page the user wanted before login (saved request), or "/".','spring'],
   ['JSESSIONID=E77B03A6C2','New session id','Changed after login (session fixation protection). The session now holds the SecurityContext with OAuth2AuthenticationToken(DefaultOidcUser).','spring']]},
  dec:{title:'Every next request',raw:`GET /orders HTTP/1.1
Host: localhost:8080
Cookie: JSESSIONID=E77B03A6C2`,parts:[
   ['Cookie: JSESSIONID=E77B03A6C2','Only the cookie','Google is not involved any more. Google tokens stay on the server (OAuth2AuthorizedClientService, in memory by default), never in the browser.','spring']]},
  next:'Done. Front channel carried: client_id, state, nonce, code. Back channel carried: client_secret, tokens.',
  spring:'<code>SavedRequestAwareAuthenticationSuccessHandler</code>, <code>ChangeSessionIdAuthenticationStrategy</code>, <code>HttpSessionSecurityContextRepository</code>.',config:'—'}
 ]},

{id:'token', name:'2 · Get a token (SecurePay :9000)', goal:'Postman or Service A asks the SecurePay Auth Server for an access token. client_credentials = no user, the service itself is the caller.',
 actors:['Postman / Service A','Auth Server :9000'],
 links:[['security',14,'Inside: client credentials (no user)']],
 hops:[
 {from:'Postman / Service A',to:'Auth Server :9000',ch:'back',title:'Token request',
  req:{raw:`POST /oauth2/token HTTP/1.1
Host: localhost:9000
Authorization: Basic @@BASIC_A@@
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials&scope=payments.write`,parts:[
   ['/oauth2/token','Token endpoint','Spring Authorization Server\'s default token URL.','spring'],
   ['Basic @@BASIC_A@@','client_id:client_secret','Base64 of "service-a:secret". Decode it in the Dissect tab — that\'s why it must only travel over HTTPS in real systems.','secret'],
   ['grant_type=client_credentials','grant_type','No user and no browser. The client proves itself with its secret and gets a token for itself.','public'],
   ['scope=payments.write','scope','Must be one of the scopes registered for this client, else 400 invalid_scope.','public']]},
  res:{raw:`HTTP/1.1 200
Content-Type: application/json;charset=UTF-8
Cache-Control: no-cache, no-store, max-age=0, must-revalidate
Pragma: no-cache
Expires: 0

{"access_token":"@@SASJWT@@","scope":"payments.write","token_type":"Bearer","expires_in":299}`,parts:[
   ['no-store','no-store','Spring Security\'s default cache headers (HeaderWriterFilter). The OAuth spec requires no-store on token responses.','spring'],
   ['"access_token":"','access_token','A JWT signed by the Auth Server. Decoded below.','signed'],
   ['"expires_in":299','expires_in','Default access token lifetime is 5 minutes (tokenSettings accessTokenTimeToLive). No refresh_token for client_credentials — just ask again.','info']]},
  dec:{title:'access_token decoded',raw:`HEADER   {"kid":"3f9c2e1a-7b4d-4e8a-9c21-5d6e7f809a1b","alg":"RS256"}
PAYLOAD  {"sub":"service-a","aud":"service-a","nbf":@@T0@@,
          "scope":["payments.write"],"iss":"http://localhost:9000",
          "exp":@@T0@@+300,"iat":@@T0@@,"jti":"9b1e6c2a-44d0-4f3b-8e57-0c2a9d1f7e63"}`,parts:[
   ['"kid":"3f9c2e1a-7b4d-4e8a-9c21-5d6e7f809a1b"','kid','Which key signed it. Service B finds this kid in the JWKS.','signed'],
   ['"sub":"service-a"','sub','No user, so the subject is the client id.','signed'],
   ['"scope":["payments.write"]','scope','Service B turns each scope into an authority: SCOPE_payments.write.','signed'],
   ['"iss":"http://localhost:9000"','iss','Must exactly equal Service B\'s issuer-uri (same host, port, no trailing slash difference).','signed'],
   ['"exp":@@T0@@+300','exp','iat + 300 seconds.','signed'],
   ['"jti":"9b1e6c2a-44d0-4f3b-8e57-0c2a9d1f7e63"','jti','Unique token id.','signed']]},
  fail:{raw:`Wrong secret →   HTTP/1.1 401   {"error":"invalid_client"}
Unknown scope →  HTTP/1.1 400   {"error":"invalid_scope"}`,parts:[
   ['{"error":"invalid_client"}','invalid_client','Client authentication failed (wrong id or secret).','info'],
   ['{"error":"invalid_scope"}','invalid_scope','Asked for a scope the client isn\'t registered for.','info']]},
  next:'The client puts the token in <code>Authorization: Bearer …</code> when calling Service B (flow 3).',
  spring:'<code>OAuth2ClientAuthenticationFilter</code> (checks id + secret) → <code>OAuth2TokenEndpointFilter</code> → <code>OAuth2ClientCredentialsAuthenticationProvider</code> (scope check in <code>OAuth2ClientCredentialsAuthenticationValidator</code>) → <code>JwtGenerator</code>.',
  config:'A <code>RegisteredClient</code> (client-id, secret, grant type client_credentials, scope payments.write) — a <code>RegisteredClientRepository</code> bean or <code>spring.security.oauth2.authorizationserver.client.*</code> properties.'}
 ]},

{id:'callb', name:'3 · Call Service B with the token', goal:'The client sends POST /payments to Service B (:8081) with the JWT. B checks the token itself — it only talks to the Auth Server to get its public key.',
 actors:['Postman / Service A','Service B :8081','Auth Server :9000'],
 links:[['security',7,'Inside: JWT accepted (201)'],['security',8,'Inside: JWT rejected (401)'],['security',9,'Inside: missing scope (403)']],
 hops:[
 {from:'Postman / Service A',to:'Service B :8081',ch:'front',title:'The API call',
  req:{raw:`POST /payments HTTP/1.1
Host: localhost:8081
Authorization: Bearer @@SASSHORT@@
Content-Type: application/json
Idempotency-Key: 7f3c9a10-2b8e-4d61-a0f5-3c9e1b2d4a77
Content-Length: 65

{"amount":100.00,"currency":"CAD","merchantReference":"ORD-1001"}`,parts:[
   ['Bearer @@SASSHORT@@','Bearer token','The JWT from flow 2. "Bearer" = whoever holds it may use it.','signed'],
   ['Content-Type: application/json','Content-Type','Tells Spring MVC which converter reads the body (Jackson). Missing or wrong → 415.','info'],
   ['Idempotency-Key: 7f3c9a10-2b8e-4d61-a0f5-3c9e1b2d4a77','Idempotency-Key','Your own header: same key twice = same payment, not two.','public'],
   ['{"amount":100.00,"currency":"CAD","merchantReference":"ORD-1001"}','JSON body','Becomes a CreatePaymentRequest record (flow 4).','info']]},
  res:{raw:`(B must verify the token first. On the FIRST request it needs the Auth Server's
 metadata and public keys — hops 2 and 3. After that they are cached.)`,parts:[]},
  next:'<code>BearerTokenAuthenticationFilter</code> extracts the token and asks the JwtDecoder to verify it.',
  spring:'<code>BearerTokenAuthenticationFilter</code> → <code>DefaultBearerTokenResolver</code>.',config:'—'},

 {from:'Service B :8081',to:'Auth Server :9000',ch:'back',title:'Discover the Auth Server (first request only)',
  req:{raw:`GET /.well-known/openid-configuration HTTP/1.1
Host: localhost:9000`,parts:[['/.well-known/openid-configuration','Discovery','Standard metadata URL built from issuer-uri. Boot creates the JwtDecoder lazily, so this happens on the first request.','spring']]},
  res:{raw:`HTTP/1.1 200
Content-Type: application/json

{"issuer":"http://localhost:9000",
 "authorization_endpoint":"http://localhost:9000/oauth2/authorize",
 "token_endpoint":"http://localhost:9000/oauth2/token",
 "jwks_uri":"http://localhost:9000/oauth2/jwks", ... }`,parts:[
   ['"issuer":"http://localhost:9000"','issuer','Must equal your issuer-uri exactly, otherwise the decoder can\'t be created.','public'],
   ['"jwks_uri":"http://localhost:9000/oauth2/jwks"','jwks_uri','Where the public keys are → hop 3.','public']]},
  next:'B now knows where the keys live.',spring:'<code>NimbusJwtDecoder.withIssuerLocation(issuerUri)</code> inside a <code>SupplierJwtDecoder</code> (Boot\'s lazy wrapper).',config:'<code>spring.security.oauth2.resourceserver.jwt.issuer-uri=http://localhost:9000</code>'},

 {from:'Service B :8081',to:'Auth Server :9000',ch:'back',title:'Fetch public keys (cached)',
  req:{raw:`GET /oauth2/jwks HTTP/1.1
Host: localhost:9000`,parts:[['/oauth2/jwks','JWKS','Public keys only. Fetched again when a token arrives with an unknown kid (key rotation).','spring']]},
  res:{raw:`HTTP/1.1 200
Content-Type: application/json

{"keys":[{"kty":"RSA","e":"AQAB","kid":"3f9c2e1a-7b4d-4e8a-9c21-5d6e7f809a1b","n":"xGOr-H7A…"}]}`,parts:[
   ['"kid":"3f9c2e1a-7b4d-4e8a-9c21-5d6e7f809a1b"','kid','Same kid as the token header → this key verifies the signature.','public']]},
  next:'From now on B verifies every token locally: no call to :9000 per request.',spring:'Nimbus JWK source inside <code>NimbusJwtDecoder</code>.',config:'—'},

 {from:'Service B :8081',to:'Service B :8081',ch:'jvm',title:'Token → Authentication → access check',
  req:{raw:`NimbusJwtDecoder.decode(token)
  signature  ✓ (kid 3f9c…)      exp/nbf ✓ (60 s clock skew)      iss ✓
JwtAuthenticationConverter
  → JwtAuthenticationToken  name=service-a  authorities=[SCOPE_payments.write]
AuthorizationFilter
  POST /payments requires SCOPE_payments.write → ✓`,parts:[
   ['signature  ✓ (kid 3f9c…)','Signature','Checked with the public key from hop 3. Tampered or foreign token → 401.','signed'],
   ['exp/nbf ✓ (60 s clock skew)','Time checks','Default validators allow 60 seconds of clock difference.','spring'],
   ['authorities=[SCOPE_payments.write]','Authorities','Each scope claim → "SCOPE_" + scope. This is what your rules check.','spring'],
   ['requires SCOPE_payments.write','Your rule','From your SecurityFilterChain: hasAuthority("SCOPE_payments.write").','spring']]},
  res:{raw:`(passes → the request goes on to DispatcherServlet → PaymentController — see flow 4)`,parts:[]},
  fail:{raw:`HTTP/1.1 401
WWW-Authenticate: Bearer error="invalid_token", error_description="An error occurred while attempting to decode the Jwt: Jwt expired at @@EXP@@", error_uri="https://tools.ietf.org/html/rfc6750#section-3.1"

HTTP/1.1 403
WWW-Authenticate: Bearer error="insufficient_scope", error_description="The request requires higher privileges than provided by the access token.", error_uri="https://tools.ietf.org/html/rfc6750#section-3.1"`,parts:[
   ['error="invalid_token"','401 invalid_token','Token bad: expired, wrong signature, wrong issuer. The body is empty; the reason is in this header.','info'],
   ['error="insufficient_scope"','403 insufficient_scope','Token fine, but it lacks the scope your rule needs.','info']]},
  next:'Controller runs with <code>@AuthenticationPrincipal Jwt</code> available.',
  spring:'<code>JwtAuthenticationProvider</code>, <code>JwtAuthenticationConverter</code>, <code>AuthorizationFilter</code>; errors: <code>BearerTokenAuthenticationEntryPoint</code>, <code>BearerTokenAccessDeniedHandler</code>.',config:'Your <code>SecurityFilterChain</code> rules.'},

 {from:'Service B :8081',to:'Postman / Service A',ch:'front',title:'The response',
  req:{raw:`(answer to hop 1)`,parts:[]},
  res:{raw:`HTTP/1.1 201
Location: /payments/42
X-Content-Type-Options: nosniff
X-XSS-Protection: 0
Cache-Control: no-cache, no-store, max-age=0, must-revalidate
Pragma: no-cache
Expires: 0
X-Frame-Options: DENY
Content-Type: application/json
Transfer-Encoding: chunked
Date: Sun, 27 Sep 2026 22:40:11 GMT

{"id":42,"status":"CREATED","amount":100.00,"currency":"CAD","createdAt":"2026-09-27T22:40:11Z"}`,parts:[
   ['HTTP/1.1 201','201 Created','From ResponseEntity.created(uri) in your controller.','info'],
   ['Location: /payments/42','Location','URL of the new resource, copied as-is from ResponseEntity.created(uri). (If CORS were configured you would also see Vary: Origin headers.)','info'],
   ['X-Content-Type-Options: nosniff','Security headers','nosniff, X-XSS-Protection 0, Cache-Control no-store, X-Frame-Options DENY — all added by Spring Security\'s HeaderWriterFilter by default.','spring'],
   ['Transfer-Encoding: chunked','chunked','Tomcat streamed the body without knowing its length upfront.','info'],
   ['{"id":42,"status":"CREATED"','JSON body','Your PaymentResponse record written by Jackson.','info']]},
  next:'Done. The token was checked locally; the Auth Server was only asked for its keys once.',spring:'<code>HeaderWriterFilter</code>, Jackson converter.',config:'—'}
 ]},

{id:'inside', name:'4 · Inside Service B: bytes → Java → SQL → bytes', goal:'The same POST /payments, followed inside one JVM. What form the data has at each layer.',
 actors:['Tomcat','Security','Spring MVC','Service + JPA','Database'],
 links:[['journey',1,'Explorer: full request journey'],['mvc',3,'Explorer: POST @RequestBody + @Valid'],['jpa',3,'Explorer: dirty checking']],
 hops:[
 {from:'Tomcat',to:'Tomcat',ch:'jvm',title:'1. Bytes arrive on port 8081',
  req:{raw:`POST /payments HTTP/1.1\\r\\n
Host: localhost:8081\\r\\n
Authorization: Bearer eyJraWQiOiIzZjljMmUxYS…\\r\\n
Content-Type: application/json\\r\\n
Content-Length: 65\\r\\n
(empty line)\\r\\n
{"amount":100.00,"currency":"CAD","merchantReference":"ORD-1001"}`,parts:[
   ['POST /payments HTTP/1.1','Request line','Method, path, protocol. Parsed first.','info'],
   ['Content-Length: 65','Content-Length','How many body bytes to read.','info'],
   ['(empty line)','Empty line','Every line ends with \\r\\n (CRLF). An empty line ends the headers; everything after it is the body.','info']]},
  res:{raw:`HttpServletRequest (Tomcat's Request object)
  getMethod()        = "POST"
  getRequestURI()    = "/payments"
  getHeader("Authorization") = "Bearer eyJraWQi…"
  getContentType()   = "application/json"
  getInputStream()   = 65 bytes, NOT read yet`,parts:[
   ['getInputStream()   = 65 bytes, NOT read yet','Body not parsed','Tomcat parses only request line + headers. The body is read later by Jackson.','info']]},
  next:'Tomcat hands the request to the filter chain on a worker thread (http-nio-8081-exec-N).',spring:'Tomcat <code>NioEndpoint</code> → <code>Http11Processor</code> → <code>CoyoteAdapter</code>.',config:'<code>server.port=8081</code>'},

 {from:'Security',to:'Security',ch:'jvm',title:'2. Header → Authentication in a ThreadLocal',
  req:{raw:`"Authorization: Bearer eyJ…"   (a String header)`,parts:[['Bearer eyJ…','Header text','Just text until Security decodes it (flow 3, hop 4).','signed']]},
  res:{raw:`SecurityContextHolder.getContext().getAuthentication() =
  JwtAuthenticationToken {
    principal   = Jwt{sub=service-a, scope=[payments.write], …}
    authorities = [SCOPE_payments.write]
    authenticated = true }`,parts:[
   ['SecurityContextHolder','ThreadLocal','Stored per thread for this request; cleared when the response is done.','spring'],
   ['principal   = Jwt{sub=service-a','Principal','What @AuthenticationPrincipal Jwt jwt gives your controller.','spring']]},
  next:'Filter chain done → <code>DispatcherServlet</code>.',spring:'<code>BearerTokenAuthenticationFilter</code>.',config:'—'},

 {from:'Spring MVC',to:'Spring MVC',ch:'jvm',title:'3. JSON text → Java record',
  req:{raw:`{"amount":100.00,"currency":"CAD","merchantReference":"ORD-1001"}   (bytes)`,parts:[]},
  res:{raw:`HandlerMapping → PaymentController#create(CreatePaymentRequest, Jwt)
MappingJackson2HttpMessageConverter.read(...)
  → CreatePaymentRequest[amount=100.00, currency=CAD, merchantReference=ORD-1001]
@Valid → OK`,parts:[
   ['PaymentController#create','Handler','Chosen by method + path (@PostMapping on @RequestMapping("/payments")).','spring'],
   ['MappingJackson2HttpMessageConverter.read','Jackson','Chosen because Content-Type is application/json. Reads the input stream into your record.','spring'],
   ['@Valid → OK','Validation','If it fails → MethodArgumentNotValidException → 400, service never runs.','spring']]},
  next:'Controller calls <code>paymentService.create(request, jwt)</code> — through the @Transactional proxy.',spring:'<code>RequestMappingHandlerAdapter</code> → <code>RequestResponseBodyMethodProcessor</code>.',config:'—'},

 {from:'Service + JPA',to:'Database',ch:'jvm',title:'4. Java object → SQL',
  req:{raw:`Payment{id=null, amount=100.00, currency=CAD, merchantId=service-a, status=CREATED, version=null}
paymentRepository.save(payment)`,parts:[
   ['id=null','New entity','No id yet → save() calls persist().','info'],
   ['merchantId=service-a','From the token','Copied from jwt.getSubject() in your service.','info']]},
  res:{raw:`insert into payment (amount,created_at,currency,merchant_id,status,version) values (?,?,?,?,?,?)
binding parameter (1:NUMERIC) <- [100.00]
binding parameter (2:TIMESTAMP_UTC) <- [2026-09-27T22:40:11Z]
binding parameter (3:VARCHAR) <- [CAD]
binding parameter (4:VARCHAR) <- [service-a]
binding parameter (5:VARCHAR) <- [CREATED]
binding parameter (6:BIGINT) <- [0]
→ generated id = 42      → COMMIT when the @Transactional method returns`,parts:[
   ['values (?,?,?,?,?,?)','Prepared statement','Values are bound separately, never glued into SQL → no SQL injection.','info'],
   ['(6:BIGINT) <- [0]','version','@Version starts at 0 and is checked on every update.','spring'],
   ['generated id = 42','IDENTITY id','With IDENTITY the INSERT runs right at save() to get the id.','info'],
   ['COMMIT','Commit','TransactionInterceptor commits; the connection goes back to Hikari.','spring']]},
  next:'Service maps the entity to <code>PaymentResponse</code> and returns.',spring:'Hibernate <code>SessionImpl.persist</code> → JDBC <code>PreparedStatement</code>.',config:'See it yourself: <code>logging.level.org.hibernate.SQL=DEBUG</code>, <code>logging.level.org.hibernate.orm.jdbc.bind=TRACE</code>.'},

 {from:'Spring MVC',to:'Tomcat',ch:'jvm',title:'5. Java record → JSON → bytes',
  req:{raw:`ResponseEntity.created(URI.create("/payments/42"))
  .body(PaymentResponse[id=42, status=CREATED, amount=100.00, currency=CAD, createdAt=2026-09-27T22:40:11Z])`,parts:[
   ['ResponseEntity.created','Status + Location','201 and the Location header.','info']]},
  res:{raw:`HTTP/1.1 201
Location: /payments/42
Content-Type: application/json
... security headers ...

{"id":42,"status":"CREATED","amount":100.00,"currency":"CAD","createdAt":"2026-09-27T22:40:11Z"}`,parts:[
   ['{"id":42','JSON','Jackson writes the record. Instant → ISO-8601 text (Boot disables timestamps-as-numbers).','spring']]},
  next:'Bytes go back on the same TCP connection. The SecurityContext ThreadLocal is cleared; the thread returns to Tomcat\'s pool.',spring:'Jackson converter, <code>HeaderWriterFilter</code>, Tomcat <code>Http11OutputBuffer</code>.',config:'See it yourself: <code>logging.level.org.springframework.web=DEBUG</code> + <code>spring.mvc.log-request-details=true</code>.'}
 ]}
];

// ---------- dictionary for the "Dissect your own" tool ----------
const DICT = {
 client_id:['Public id of the app at the provider. Not a secret.','public'],
 client_secret:['The app\'s password. Must never appear in a browser URL.','secret'],
 redirect_uri:['Where the provider sends the user back. Must match a registered URI.','public'],
 response_type:['code = authorization code flow; token/id_token = implicit (legacy).','public'],
 scope:['Permissions requested/granted. Space separated (%20 or +).','public'],
 state:['Random anti-CSRF value; must come back unchanged.','public'],
 nonce:['Random value echoed inside the id_token; stops replay.','public'],
 code:['One-time authorization code. Exchanged server-side for tokens.','onetime'],
 code_challenge:['PKCE: hash of a secret code_verifier. Proves the same client finishes the flow.','public'],
 code_challenge_method:['PKCE hash method, normally S256.','public'],
 code_verifier:['PKCE secret sent only in the token request.','secret'],
 grant_type:['Which OAuth2 flow: authorization_code, client_credentials, refresh_token…','public'],
 refresh_token:['Long-lived token to get new access tokens.','secret'],
 access_token:['Key to call APIs. Whoever holds it can use it.','secret'],
 id_token:['JWT saying who the user is (OpenID Connect).','signed'],
 token_type:['Usually Bearer.','info'], expires_in:['Seconds until the access token expires.','info'],
 prompt:['none / login / consent / select_account — how the provider should prompt.','public'],
 access_type:['Google: offline = also give a refresh_token.','internal'],
 login_hint:['Pre-fill the account/email.','public'], display:['page / popup — how the login UI is shown.','public'],
 authuser:['Google: which signed-in account index.','internal'], hd:['Google: hint to prefer accounts from a Workspace domain. Not enforced; verify the hd claim in the id_token.','internal'],
 flowName:['Google-internal flow name.','internal'], dsh:['Google-internal.','internal'], gsiwebsdk:['Google Identity Services SDK marker.','internal'],
 o2v:['Google-internal OAuth version marker.','internal'], ddm:['Google-internal.','internal'], opparams:['Google-internal: original params, URL-encoded inside.','internal'],
 error:['Error code (e.g. invalid_client, access_denied).','info'], error_description:['Human-readable error.','info'],
 iss:['Issuer: who created the token.','signed'], sub:['Subject: stable id of the user or client.','signed'], aud:['Audience: who the token is for.','signed'],
 exp:['Expiry, epoch seconds.','signed'], iat:['Issued at, epoch seconds.','signed'], nbf:['Not valid before, epoch seconds.','signed'],
 jti:['Unique token id.','signed'], azp:['Authorized party: client the token was issued to.','signed'], at_hash:['Hash of the access_token, ties both tokens together.','signed'],
 email:['User email (from the email scope).','signed'], email_verified:['Provider verified the email.','signed'],
 alg:['Signature algorithm (RS256 = RSA + SHA-256).','signed'], kid:['Key id: which public key verifies the signature.','signed'], typ:['Token type, usually JWT.','signed'],
 authorization:['Credentials header: Basic (id:secret in base64) or Bearer (token).','secret'],
 'content-type':['Format of the body.','info'], cookie:['Cookies the browser sends back (e.g. session id).','secret'],
 'set-cookie':['Server asks the browser to store a cookie.','info'], location:['Redirect target.','info'],
 'www-authenticate':['Why authentication failed (401) / what is required.','info'], host:['Target site.','info']
};

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const KL = {public:'PUBLIC',secret:'SECRET',onetime:'ONE-TIME',signed:'SIGNED',spring:'SET BY SPRING',internal:'PROVIDER-INTERNAL',info:'INFO'};
let cur = {f:0, h:0};

function tokenize(raw, parts, pid){
  let out = '', pos = 0; const marks = [];
  parts.forEach((p, i) => { const at = raw.indexOf(p[0], pos); if (at >= 0){ marks.push([at, at + p[0].length, i]); pos = at + p[0].length; } });
  pos = 0;
  marks.forEach(([a, b, i]) => { out += esc(raw.slice(pos, a)) + `<span class="tk ${parts[i][3]}" data-p="${pid}-${i}">` + esc(raw.slice(a, b)) + '</span>'; pos = b; });
  return out + esc(raw.slice(pos));
}
function block(title, b, pid){
  if (!b) return '';
  const rows = b.parts.map((p, i) => `<li class="pt" data-p="${pid}-${i}"><div><div class="nm">${esc(p[1])}</div><span class="kd ${p[3]}">${KL[p[3]]}</span></div><div class="mn">${p[2]}</div></li>`).join('');
  return `<h3>${title}</h3><pre class="raw">${tokenize(b.raw, b.parts, pid)}</pre>${rows ? '<ul class="parts">' + rows + '</ul>' : ''}`;
}
function renderFlow(){
  const F = FLOWS[cur.f], H = F.hops[cur.h];
  const lanes = F.actors.map((a, i) => { const c = a === H.from ? 'from' : (a === H.to ? 'to' : ''); return `<span class="lane ${c}">${esc(a)}</span>`; }).join('');
  const chips = F.hops.map((h, i) => `<button class="chip ${i === cur.h ? 'on' : ''}" data-h="${i}" title="${esc(h.title)}">${i + 1}</button>`).join('');
  const chName = {front:'front channel', back:'back channel (server → server)', jvm:'inside the JVM', user:'user ↔ provider'}[H.ch];
  const links = F.links.map(l => `<a class="go" href="index.html#${l[0]}/${l[1]}/1">▶ ${esc(l[2])}</a>`).join('');
  $('#flowView').innerHTML = `
   <p>${esc(F.goal)}</p>
   <div class="chips">${chips}</div>
   <div class="lanes">${lanes}</div>
   <h2>Hop ${cur.h + 1} of ${F.hops.length} · ${esc(H.title)} <span class="ch ${H.ch}">${chName}</span></h2>
   <div class="lanes"><span class="lane from">${esc(H.from)}</span><span class="arrow">→</span><span class="lane to">${esc(H.to)}</span></div>
   ${block(H.from === H.to ? 'What comes in' : 'Request', H.req, 'q')}
   ${block(H.from === H.to ? 'What goes out' : 'Response', H.res, 'r')}
   ${H.dec ? block(H.dec.title, H.dec, 'd') : ''}
   ${H.fail ? block('When it fails', H.fail, 'x') : ''}
   <div class="box"><b>Carries to the next hop:</b> ${H.next}</div>
   <div class="meta"><div class="box"><b>Spring class:</b> ${H.spring}</div><div class="box"><b>Your config / code:</b> ${H.config}</div></div>
   <div class="nav"><button class="btn" id="prev" ${cur.f === 0 && cur.h === 0 ? 'disabled' : ''}>← Back</button><button class="btn primary" id="next" ${cur.f === FLOWS.length - 1 && cur.h === F.hops.length - 1 ? 'disabled' : ''}>${cur.h === F.hops.length - 1 ? 'Next flow →' : 'Next hop →'}</button></div>
   <div class="links">${links}</div>`;
  $('#prev').onclick = () => { if (cur.h > 0) cur.h--; else if (cur.f > 0){ cur.f--; cur.h = FLOWS[cur.f].hops.length - 1; } go(); };
  $('#next').onclick = () => { if (cur.h < F.hops.length - 1) cur.h++; else if (cur.f < FLOWS.length - 1){ cur.f++; cur.h = 0; } go(); };
  document.querySelectorAll('.chip').forEach(c => c.onclick = () => { cur.h = +c.dataset.h; go(); });
}
function renderTabs(){
  const own = location.hash === '#own';
  $('#tabs').innerHTML = FLOWS.map((F, i) => `<button class="tab ${!own && i === cur.f ? 'on' : ''}" data-f="${i}">${esc(F.name)}</button>`).join('') + `<button class="tab ${own ? 'on' : ''}" data-f="own">5 · Dissect your own</button>`;
  document.querySelectorAll('.tab').forEach(t => t.onclick = () => { if (t.dataset.f === 'own'){ location.hash = 'own'; } else { cur = {f:+t.dataset.f, h:0}; go(); } });
}
function go(){ location.hash = FLOWS[cur.f].id + '/' + (cur.h + 1); }
function route(){
  const h = location.hash.slice(1);
  if (h === 'own'){ $('#flowView').classList.add('hidden'); $('#own').classList.remove('hidden'); renderTabs(); return; }
  const [fid, hn] = h.split('/'); const fi = FLOWS.findIndex(F => F.id === fid);
  if (fi >= 0){ cur.f = fi; cur.h = Math.min(Math.max((+hn || 1) - 1, 0), FLOWS[fi].hops.length - 1); }
  $('#own').classList.add('hidden'); $('#flowView').classList.remove('hidden');
  renderTabs(); renderFlow();
}
document.addEventListener('click', e => {
  const t = e.target.closest('[data-p]'); if (!t) return;
  const id = t.dataset.p;
  if (t.classList.contains('pt') && document.body.classList.contains('practice')) t.classList.toggle('open');
  document.querySelectorAll('.hl').forEach(x => x.classList.remove('hl'));
  document.querySelectorAll(`[data-p="${id}"]`).forEach(x => x.classList.add('hl'));
  if (t.classList.contains('tk')){ const row = document.querySelector(`.pt[data-p="${id}"]`); if (row) row.scrollIntoView({block:'nearest', behavior:'smooth'}); }
});
$('#practice').onchange = e => { document.body.classList.toggle('practice', e.target.checked); document.querySelectorAll('.pt.open').forEach(x => x.classList.remove('open')); };

// ---------- Dissect your own ----------
const SAMPLES = {
 url:'https://accounts.google.com/v3/signin/identifier?opparams=%253Foriginal%253Dhttps%25253A%25252F%25252Faccounts.zomato.com&dsh=S-954021551%3A1730057133646066&client_id=442739719837.apps.googleusercontent.com&ddm=0&display=popup&flowName=GeneralOAuthFlow&gsiwebsdk=gis_attributes&o2v=1&prompt=select_account&redirect_uri=https%3A%2F%2Faccounts.zomato.com&response_type=code&scope=openid%20email%20profile&state=demo-state',
 jwt:'@@SASJWT@@',
 basic:'Authorization: Basic @@BASIC_A@@',
 http:'POST /oauth2/token HTTP/1.1\nHost: localhost:9000\nAuthorization: Basic @@BASIC_A@@\nContent-Type: application/x-www-form-urlencoded\n\ngrant_type=client_credentials&scope=payments.write'
};
$('#own').innerHTML = `
 <h2>Dissect your own</h2>
 <p>Paste a URL, a JWT, an <code>Authorization</code> header, a form body, JSON, or a whole raw HTTP request. Everything runs in this page — nothing is sent anywhere. Still: never paste real production secrets.</p>
 <div class="links"><button class="btn" data-s="url">Sample: URL from the video</button><button class="btn" data-s="jwt">Sample: JWT</button><button class="btn" data-s="basic">Sample: Basic header</button><button class="btn" data-s="http">Sample: raw request</button></div>
 <textarea id="inp" spellcheck="false" placeholder="Paste here…"></textarea>
 <div><button class="btn primary" id="dis">Dissect</button></div>
 <div id="outp" style="display:grid;gap:10px"></div>
 <h3>How to capture real requests</h3>
 <ol class="steps">
  <li><b>Browser (front channel):</b> Chrome → F12 → Network → tick <b>Preserve log</b> → do the login → click a request → Headers / Payload tabs. Right-click → Copy → Copy URL or Copy as cURL → paste here.</li>
  <li><b>Server-to-server (back channel):</b> never visible in the browser. Make the call yourself in Postman and open the Postman Console (raw request + response), or turn on <code>logging.level.org.springframework.security=TRACE</code> in your app.</li>
  <li><b>Inside your Spring app:</b> <code>logging.level.org.springframework.web=DEBUG</code> + <code>spring.mvc.log-request-details=true</code>; SQL: <code>logging.level.org.hibernate.SQL=DEBUG</code> and <code>logging.level.org.hibernate.orm.jdbc.bind=TRACE</code>.</li>
  <li><b>For every piece ask:</b> What is it? Who set it? Public, secret or one-time? Where does it go next? Which line of my config or code?</li>
 </ol>`;
document.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { $('#inp').value = SAMPLES[b.dataset.s]; dissect(); });
$('#dis').onclick = dissect;

function b64dec(s){ s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; const bin = atob(s); return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0))); }
function dec(s){ try { return decodeURIComponent(s.replace(/\+/g, ' ')); } catch(e){ return s; } }
function row(name, value, meaning, kind){ return `<li class="pt"><div><div class="nm">${esc(name)}</div>${kind ? `<span class="kd ${kind}">${KL[kind]}</span>` : ''}</div><div class="mn"><code>${esc(value)}</code>${meaning ? '<br>' + esc(meaning) : ''}</div></li>`; }
function known(k){ return DICT[k] || DICT[k.toLowerCase()] || null; }
function paramsTable(q, depth){
  let html = '';
  q.split('&').filter(Boolean).forEach(kv => {
    const i = kv.indexOf('='); const k = dec(i < 0 ? kv : kv.slice(0, i)); let v = i < 0 ? '' : kv.slice(i + 1);
    let d = dec(v), layers = 1; while (/%[0-9A-Fa-f]{2}/.test(d) && layers < 4){ const d2 = dec(d); if (d2 === d) break; d = d2; layers++; }
    const kn = known(k);
    html += row(k, d, (kn ? kn[0] : 'Not in the dictionary — custom or provider-specific.') + (layers > 1 ? ` (was URL-encoded ${layers}×)` : ''), kn ? kn[1] : 'info');
    if (depth < 2 && /^[a-z]+:\/\/|^\?|[?&][^=]+=/.test(d) && d.includes('=')){ const inner = d.includes('?') ? d.split('?').slice(1).join('?') : d; html += `<li style="list-style:none;padding-left:16px">${'<ul class="parts">' + paramsTable(inner, depth + 1) + '</ul>'}</li>`; }
  });
  return html;
}
function dissectJwt(t){
  const [h, p, s] = t.trim().split('.'); let H, P;
  try { H = JSON.parse(b64dec(h)); P = JSON.parse(b64dec(p)); } catch(e){ return '<p>Not a valid JWT (header/payload are not base64url JSON).</p>'; }
  const rowsFor = o => Object.entries(o).map(([k, v]) => { const kn = known(k); let val = typeof v === 'object' ? JSON.stringify(v) : String(v); if (['exp','iat','nbf'].includes(k) && typeof v === 'number') val += '  →  ' + new Date(v * 1000).toISOString(); return row(k, val, kn ? kn[0] : 'Custom claim.', kn ? kn[1] : 'info'); }).join('');
  return `<h3>JWT header (base64url → JSON)</h3><ul class="parts">${rowsFor(H)}</ul><h3>JWT payload (readable by anyone!)</h3><ul class="parts">${rowsFor(P)}</ul>
   <div class="box"><b>Signature:</b> ${esc((s || '').slice(0, 24))}… — can't be checked here. It needs the issuer's public key (JWKS, matching kid). Readable ≠ trusted: trust comes from the signature check.</div>`;
}
function dissectHeaders(lines){
  return lines.map(l => { const i = l.indexOf(':'); if (i < 0) return ''; const k = l.slice(0, i).trim(), v = l.slice(i + 1).trim(); const kn = known(k.toLowerCase());
    let extra = ''; const m = /^Basic\s+(\S+)/i.exec(v); if (m){ try { const d = b64dec(m[1]); extra = ` Decoded Basic → "${d}" (client_id:secret). Base64 is NOT encryption.`; } catch(e){} }
    if (/^Bearer\s+eyJ/i.test(v)) extra = ' Bearer JWT — paste the token alone to decode it.';
    return row(k, v, (kn ? kn[0] : 'Header.') + extra, kn ? kn[1] : 'info'); }).join('');
}
function dissect(){
  const s = $('#inp').value.trim(); let out = '';
  if (!s){ $('#outp').innerHTML = ''; return; }
  if (/^eyJ[\w-]*\.[\w-]*\.[\w-]*$/.test(s)) out = '<h3>Type: JWT</h3>' + dissectJwt(s);
  else if (/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+\S+\s+HTTP\//.test(s) || /^HTTP\/\d/.test(s)){
    const [head, ...bodyParts] = s.replace(/\r/g, '').split(/\n\s*\n/); const body = bodyParts.join('\n\n'); const lines = head.split('\n');
    const first = lines.shift(); out = `<h3>Type: raw HTTP message</h3><ul class="parts">${row('Start line', first, /^HTTP/.test(first) ? 'Status line: protocol + status code.' : 'Request line: method, path (+ query), protocol.', 'info')}</ul>`;
    const pq = first.split(' ')[1] || ''; if (pq.includes('?')) out += `<h3>Query string</h3><ul class="parts">${paramsTable(pq.split('?').slice(1).join('?'), 0)}</ul>`;
    out += `<h3>Headers</h3><ul class="parts">${dissectHeaders(lines)}</ul>`;
    if (body){ let b = ''; try { b = '<pre class="raw">' + esc(JSON.stringify(JSON.parse(body), null, 2)) + '</pre>'; } catch(e){ b = body.includes('=') ? '<ul class="parts">' + paramsTable(body, 0) + '</ul>' : '<pre class="raw">' + esc(body) + '</pre>'; } out += '<h3>Body</h3>' + b; }
  }
  else if (/^[\w-]+:\s/.test(s)) out = '<h3>Type: header(s)</h3><ul class="parts">' + dissectHeaders(s.split('\n')) + '</ul>';
  else if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s)){
    let u; try { u = new URL(s); } catch(e){ out = '<p>Could not parse this URL.</p>'; }
    if (u){ out = `<h3>Type: URL</h3><ul class="parts">${row('Scheme', u.protocol.replace(':', ''), u.protocol === 'https:' ? 'Encrypted with TLS: query params are hidden from the network, but NOT from browser history, logs or the Referer header.' : 'Plain HTTP: everything visible on the network.', 'info')}${row('Host', u.host, 'Which server.', 'info')}${row('Directory', u.pathname.replace(/[^/]*$/, ''), '', 'info')}${row('Path', u.pathname, 'Which endpoint on that server.', 'info')}</ul>`;
      if (u.search) out += `<h3>Query string (${u.search.slice(1).split('&').length} params)</h3><ul class="parts">${paramsTable(u.search.slice(1), 0)}</ul>`;
      if (u.hash) out += `<h3>Fragment</h3><ul class="parts">${row('#', u.hash, 'Never sent to the server; stays in the browser.', 'info')}</ul>`;
      if (/client_secret=/.test(s)) out += '<div class="box"><b>Warning:</b> a client_secret in a URL is a leak — it ends up in history and logs.</div>'; }
  }
  else if (/^[\[{]/.test(s)){ try { const o = JSON.parse(s); out = '<h3>Type: JSON</h3><ul class="parts">' + Object.entries(o).map(([k, v]) => { const kn = known(k); const val = typeof v === 'object' ? JSON.stringify(v) : String(v); return row(k, val.length > 120 ? val.slice(0, 120) + '…' : val, kn ? kn[0] : '', kn ? kn[1] : 'info'); }).join('') + '</ul>'; if (o.id_token) out += '<h3>id_token inside</h3>' + dissectJwt(o.id_token); else if (typeof o.access_token === 'string' && o.access_token.startsWith('eyJ')) out += '<h3>access_token inside</h3>' + dissectJwt(o.access_token); } catch(e){ out = '<p>Looks like JSON but does not parse.</p>'; } }
  else if (s.includes('=')) out = '<h3>Type: query string / form body</h3><ul class="parts">' + paramsTable(s.replace(/^\?/, ''), 0) + '</ul>';
  else out = '<p>Not recognised. Try a URL, a JWT (eyJ…), a header line like "Authorization: Basic …", JSON, or a raw HTTP request.</p>';
  $('#outp').innerHTML = out;
}
window.addEventListener('hashchange', route);
if (!location.hash) location.replace('#google/1'); route();
</script>
'''

page = PAGE
for k, v in REP.items():
    page = page.replace(k, v)
assert '@@' not in page, page[page.index('@@') - 40: page.index('@@') + 40]
open(OUT, 'w').write(page)
print('wire.html written:', OUT, len(page))
