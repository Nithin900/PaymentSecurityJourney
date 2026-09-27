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

PCBASIC = base64.b64encode(b'payment-client:secret').decode()
PJWT = jwt({'kid': '5d1f0c2a-9e7b-4a61-b3c8-2f4d6e8a0b1c', 'alg': 'RS256'}, {'sub': 'nithin', 'aud': 'payment-client', 'nbf': T0, 'scope': ['payment.read', 'payment.write'], 'iss': 'http://localhost:9000', 'exp': T0 + 300, 'iat': T0, 'jti': 'e41b7c90-2d3a-4f58-9a61-7b0c5d2e8f13'}, 'securepay')
REP = {'@@PCBASIC@@': PCBASIC, '@@PJWT@@': PJWT, '@@PJWTSHORT@@': PJWT[:24] + '…' + PJWT[-10:], '@@CID@@': CID, '@@SECRET@@': SECRET, '@@STATE_RAW@@': STATE_RAW, '@@STATE@@': STATE_URL, '@@NONCE@@': NONCE_HASH,
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
html{background:var(--bg);scroll-padding-top:150px}
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
.formula>*,.fr>*,.pt>*,.meta>*{min-width:0}
.fv,.mn,.nm,.box,.card h2,.chg,.goal,.lane{overflow-wrap:anywhere}
.hidden{display:none!important}
details.card summary{cursor:pointer}
details.card:not([open]){gap:0}
.top{flex-direction:column;flex-wrap:nowrap;align-items:stretch;gap:6px}
.top .row{display:flex;gap:14px;flex-wrap:wrap;align-items:center}
.top .row b{margin-right:auto}
.ctl{gap:8px!important}
.ctl select{flex:1 1 220px;min-width:0;max-width:100%;background:#15181d;color:var(--ink);border:1px solid #3a414b;border-radius:8px;padding:7px 8px;font:inherit;font-size:14px}
.faint{color:var(--faint);font-size:13px}
.goal{color:var(--muted);margin:0}
.formula{border:1px solid var(--active);border-radius:10px;padding:8px 12px;background:#120e08;display:grid;gap:4px}
.fh{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--active);font-weight:700}
.fr{display:grid;grid-template-columns:86px 1fr;gap:8px;font-size:14px}
.fk{font-weight:700;color:var(--active);font-size:12px;padding-top:2px}
body.practice .fr:not(.open) .fv{filter:blur(6px);cursor:pointer}
.tk.new{background:#3a2410}
.tk.carried{background:#10301c}
.kd.newk{background:#3a2410;color:var(--active)}
.kd.carried{background:#10301c;color:var(--spring)}
.chg div{margin-top:3px;font-size:14px}
ol.steps{margin:0;padding-left:20px;display:grid;gap:4px}
.formula>*,.fr>*,.pt>*,.meta>*{min-width:0}
.fv,.mn,.nm,.box,.card h2,.chg,.goal,.lane{overflow-wrap:anywhere}

</style>
<header class="top"><div class="row"><b>Dissect a Request</b><a href="index.html">Explorer</a><a href="learn.html">Study guide</a><a href="dev.html">Build it</a></div>
 <div class="row ctl"><select id="flowSel" aria-label="Flow"></select><span id="hopNo" class="faint"></span><button class="btn" id="tprev">← Back</button><button class="btn primary" id="tnext">Next →</button></div></header>
<main class="wrap">
 <div><h1>Dissect a request</h1><p class="sub">Every Spring concept as a wire flow with your SecurePay code. Per hop: <b>WHO → WHERE → CARRIES → CHECKS → RETURNS</b>. Orange = new, green = carried from an earlier hop.</p></div>
 <details class="card" id="intro"><summary><b>The formula</b> <span class="faint">(tap to open)</span></summary>
  <h3>Works for any question</h3>
  <ol class="steps"><li><b>Find the hop</b> the question is about (which two parties talk?).</li><li>Say <b>WHO</b> sends, <b>WHERE</b> it goes, what it <b>CARRIES</b>, what the receiver <b>CHECKS</b> (name the Spring class), what it <b>RETURNS</b>.</li><li>Finish with <b>what carries to the next hop</b> — or <b>how it fails</b>.</li></ol>
  <p class="faint">Security rules: the browser carries only public or one-time values (client_id, state, code); secrets and tokens go server-to-server. The Auth Server signs tokens; A and B only verify them locally with its public key. Every protected request ends as Authentication → controller, 401 (who are you?) or 403 (not allowed).</p>
 </details>
 <section class="card"><div class="legend"><label class="toggle"><input type="checkbox" id="practice"> Practice: hide answers</label>
   <span class="kd newk">NEW</span><span class="kd carried">FROM HOP n</span><span class="kd public">PUBLIC</span><span class="kd secret">SECRET</span><span class="kd onetime">ONE-TIME</span><span class="kd signed">SIGNED</span><span class="kd spring">SET BY SPRING</span></div>
 </section>
 <section id="flowView" class="card"></section>
 <section id="own" class="card hidden"></section>
</main>
<script>
/*FLOWS*/

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

/*RENDERER*/
// ---------- Dissect your own ----------
const SAMPLES = {
 url:'http://localhost:9000/oauth2/authorize?response_type=code&client_id=payment-client&scope=payment.read%20payment.write&redirect_uri=https%3A%2F%2Foauth.pstmn.io%2Fv1%2Fcallback&state=pm-7c1e9a',
 jwt:'@@PJWT@@',
 basic:'Authorization: Basic @@PCBASIC@@',
 http:'POST /oauth2/token HTTP/1.1\nHost: localhost:9000\nAuthorization: Basic @@PCBASIC@@\nContent-Type: application/x-www-form-urlencoded\n\ngrant_type=authorization_code&code=kP3vQz8mW1xR&redirect_uri=https%3A%2F%2Foauth.pstmn.io%2Fv1%2Fcallback'
};
$('#own').innerHTML = `
 <h2>Dissect your own</h2>
 <p>Paste a URL, a JWT, an <code>Authorization</code> header, a form body, JSON, or a whole raw HTTP request. Everything runs in this page — nothing is sent anywhere. Still: never paste real production secrets.</p>
 <div class="links"><button class="btn" data-s="url">Sample: authorize URL</button><button class="btn" data-s="jwt">Sample: JWT</button><button class="btn" data-s="basic">Sample: Basic header</button><button class="btn" data-s="http">Sample: raw request</button></div>
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
if (!location.hash) location.replace('#login/1'); route();
</script>
'''

HERE = os.path.dirname(os.path.abspath(__file__))
page = PAGE.replace('/*FLOWS*/', open(os.path.join(HERE, 'wire_flows.js')).read()).replace('/*RENDERER*/', open(os.path.join(HERE, 'wire_render.js')).read())
for k, v in REP.items():
    page = page.replace(k, v)
assert '@@' not in page, page[page.index('@@') - 40: page.index('@@') + 40]
open(OUT, 'w').write(page)
print('wire.html written:', OUT, len(page))
