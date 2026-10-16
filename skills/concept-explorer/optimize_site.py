"""Site-wide finishing pass for site/*.html. Safe to run any number of times.

Run from the repo root:   python3 skills/concept-explorer/optimize_site.py
build_site.py also runs it at the end, so rebuilt pages keep these fixes.

What it does to every page:
  - <html lang="en"> (screen readers and search engines)
  - a meta description and Open Graph tags (search results and link previews)
  - one CSS rule that stops grid/flex layouts from stretching wider than the
    screen when they hold a wide diagram or table (the phone sideways-scroll bug)
  - preconnect to Google Fonts' file host (fonts start downloading sooner)
  - service worker registration (offline support on every page, not just some)
  - a footer listing every page, so no page is a dead end or an orphan
And for the site: rebuilds sw.js's file list from the real pages and bumps its
version when anything changed, and writes a 404 page.
"""
import hashlib, html, os, re, sys

SITE = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "../../site")
SITE = os.path.normpath(SITE)
BASE_URL = "https://nithin900.github.io/PaymentSecurityJourney/"

# Order = order in the footer. (file, short label, description)
PAGES = [
    ("index.html", "Explorer", "Click through how Spring Security, Spring Core, Boot, MVC, JPA, Cloud, Kafka and observability work inside one request, box by box."),
    ("payment-journey.html", "Payment Journey", "One real payment traced hop by hop through four Spring Boot services secured with OAuth 2.0 and JWT."),
    ("securepay.html", "Build SecurePay", "Build the SecurePay payment system step by step: guess, build, verify, across six phases."),
    ("wire.html", "Dissect a request", "See exactly what travels on the wire for each request in the payment system, header by header."),
    ("levels.html", "Security levels", "Spring Security in seven levels, from the default login page to service-to-service tokens."),
    ("guide.html", "Spring Security Guide", "Spring Security end to end: filter chain, authentication, SecurityContext, sessions, authorization, JWT, OAuth2, microservices, testing and production."),
    ("cards.html", "Decision Cards", "Every Spring Security choice as a card: why it exists, options and trade-offs, what fails in production, and a hypothesis to test."),
    ("decisions.html", "Decision Map", "Which Spring Security option to pick for a given situation, as a decision map."),
    ("sky.html", "Security Sky", "Spring Security concepts laid out as one map you can explore."),
    ("pictures.html", "Security in Pictures", "Each Spring Security concept drawn as app screens and flows."),
    ("poster.html", "Authentication poster", "The Spring Security authentication flow on one poster."),
    ("learn.html", "Study guide", "Spring interview study guide with questions, answers and practice."),
    ("dev.html", "Build it", "The developer view: how to build each part of the payment system in code."),
    ("compare.html", "Java vs Spring vs Boot", "What plain Java, the Spring Framework and Spring Boot each do for the same task."),
    ("reflection.html", "Reflection Workbench", "Java reflection in practice: runnable programs that show how frameworks like Spring use it."),
]
KNOWN = {p for p, _, _ in PAGES}

FIX_CSS = ('<style id="site-fix">'
           ':where(body *){min-width:0}'          # grid/flex items may shrink; explicit min-widths still win
           ':where(body){overflow-wrap:break-word}'  # long JSON, URLs and property names wrap instead of widening the page
           ':where(img,video){max-width:100%}'
           '.site-foot{max-width:1180px;margin:40px auto 0;padding:18px 16px 28px;border-top:1px solid #232327;'
           'font:13px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif;color:#8f8f98}'
           '.site-foot h2{font-size:11px;letter-spacing:.1em;text-transform:uppercase;margin:0 0 8px;color:#8f8f98}'
           '.site-foot ul{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:6px 16px}'
           '.site-foot a{color:#c9c9cf;text-decoration:none}.site-foot a:hover{color:#fff;text-decoration:underline}'
           '.site-foot a[aria-current]{color:#f0a35c}'
           '</style>')
SW = ('<script id="site-sw">if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost") '
      '&& !/claude\\.ai$/.test(location.hostname)) { navigator.serviceWorker.register("sw.js").catch(function(){}); }</script>')


def footer(current):
    cur = ' aria-current="page"'
    items = "".join(
        f'<li><a href="{f}"{cur if f == current else ""}>{html.escape(label)}</a></li>'
        for f, label, _ in PAGES)
    return f'<footer class="site-foot" id="site-foot"><h2>All pages</h2><ul>{items}</ul></footer>'


def head_tags(name, title, desc):
    d = html.escape(desc, quote=True)
    t = html.escape(title, quote=True)
    return (f'<meta name="description" content="{d}">\n'
            f'<meta property="og:type" content="website">\n'
            f'<meta property="og:title" content="{t}">\n'
            f'<meta property="og:description" content="{d}">\n'
            f'<meta property="og:url" content="{BASE_URL}{"" if name == "index.html" else name}">\n'
            f'<meta property="og:image" content="{BASE_URL}icon-512.png">\n')


def process(name, desc):
    path = os.path.join(SITE, name)
    s = open(path, encoding="utf-8").read()
    orig = s

    # 1. lang
    if not re.search(r"<html\b[^>]*\blang=", s, re.I):
        if re.search(r"<html\b", s, re.I):
            s = re.sub(r"<html\b", '<html lang="en"', s, count=1, flags=re.I)
        elif s.lower().startswith("<!doctype html>"):
            s = s[:15] + '\n<html lang="en">' + s[15:]
        else:
            s = '<!doctype html>\n<html lang="en">\n' + s

    # 2. description + Open Graph, right before <title>
    title_m = re.search(r"<title>(.*?)</title>", s, re.S)
    title = html.unescape(title_m.group(1)).strip() if title_m else name
    if 'name="description"' not in s and title_m:
        s = s.replace(title_m.group(0), head_tags(name, title, desc) + title_m.group(0), 1)

    # 3. font preconnect
    if "fonts.googleapis.com/css" in s and "fonts.gstatic.com" not in s:
        s = re.sub(r'(<link rel="stylesheet" href="https://fonts\.googleapis\.com/css)',
                   r'<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n\1', s, count=1)

    # 4. layout fix CSS, before the page's own styles so page rules still win
    s = re.sub(r'<style id="site-fix">.*?</style>\n?', "", s, flags=re.S)
    if True:
        m = re.search(r"<style\b", s)
        if m:
            s = s[:m.start()] + FIX_CSS + "\n" + s[m.start():]
        else:
            s = s.replace("</title>", "</title>\n" + FIX_CSS, 1)

    # 5. footer (replace an older one so labels stay current) + service worker
    s = re.sub(r'<footer class="site-foot" id="site-foot">.*?</footer>', "", s, flags=re.S)
    s = re.sub(r'<script id="site-sw">.*?</script>', "", s, flags=re.S)
    has_sw = "serviceWorker" in s
    tail = footer(name) + ("" if has_sw else SW)
    if re.search(r"</body>", s, re.I):
        s = re.sub(r"\s*</body>", lambda m: "\n" + tail + "\n</body>", s, count=1, flags=re.I)
    else:
        s = s.rstrip() + "\n" + tail + "\n"

    if s != orig:
        open(path, "w", encoding="utf-8").write(s)
    return s != orig


def write_404():
    path = os.path.join(SITE, "404.html")
    links = "".join(f'<li><a href="{f}">{html.escape(l)}</a></li>' for f, l, _ in PAGES)
    page = f'''<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>Page not found</title>
<style>
:root{{color-scheme:dark}}
body{{background:#000;color:#f2f2f2;font:16px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif;margin:0;padding-inline:16px;padding-block:48px}}
main{{max-width:640px;margin:0 auto}}
h1{{font-size:28px;margin:0 0 8px}}p{{color:#8f8f98;margin:0 0 20px}}
ul{{list-style:none;padding:0;margin:0;display:grid;gap:6px}}a{{color:#5cc8f0}}
</style>
<main>
<h1>Page not found</h1>
<p>That page does not exist or has moved. Pick one of the pages below.</p>
<ul>{links}</ul>
</main>
'''
    old = open(path, encoding="utf-8").read() if os.path.exists(path) else ""
    if old != page:
        open(path, "w", encoding="utf-8").write(page)
        return True
    return False


def write_sw():
    path = os.path.join(SITE, "sw.js")
    pages = sorted(f for f in os.listdir(SITE) if f.endswith(".html") and f != "404.html")
    assets = [f for f in ("manifest.webmanifest", "icon-192.png", "icon-512.png", "apple-touch-icon.png") if os.path.exists(os.path.join(SITE, f))]
    files = ["./"] + ["./" + f for f in pages + assets]
    h = hashlib.sha256()
    for f in pages + assets:
        h.update(open(os.path.join(SITE, f), "rb").read())
    version = "jie-" + h.hexdigest()[:10]
    js = f"""// Offline cache for the Java Internals Explorer. Generated by skills/concept-explorer/optimize_site.py;
// the version is a hash of the site files, so it changes whenever a page changes.
const VERSION = '{version}';
const FILES = {files!r};
self.addEventListener('install', e => {{ e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); }});
self.addEventListener('activate', e => {{ e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); }});
// Network first (fresh when online), cache as fallback (offline).
self.addEventListener('fetch', e => {{
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(r => {{ const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); return r; }})
    .catch(() => caches.match(e.request, {{ignoreSearch: true}}).then(r => r || caches.match('./index.html'))));
}});
"""
    old = open(path, encoding="utf-8").read() if os.path.exists(path) else ""
    if old != js:
        open(path, "w", encoding="utf-8").write(js)
        return True
    return False


if __name__ == "__main__":
    present = {f for f in os.listdir(SITE) if f.endswith(".html") and f != "404.html"}
    missing = present - KNOWN
    if missing:
        print("WARNING: pages not listed in PAGES (no footer entry):", ", ".join(sorted(missing)))
    changed = [n for n, _, d in PAGES if n in present and process(n, d)]
    if write_404():
        changed.append("404.html")
    if write_sw():
        changed.append("sw.js")
    print("optimized:", ", ".join(changed) if changed else "nothing to change")
