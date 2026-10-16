"""Generate site/build.html (Build path) and site/lab.html (Lab log) from path_data.py.
Usage: python3 skills/concept-explorer/learn/build_path.py [site_dir]
"""
import html, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from path_data import STEPS, LAB, QUEUED  # noqa: E402

SITE = os.path.normpath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "../../../site"))
e = lambda s: html.escape(str(s), quote=True)

HEAD = '''<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="manifest" href="manifest.webmanifest">
<meta name="theme-color" content="#000000">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<title>{title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;600;800&family=JetBrains+Mono:wght@400;600&display=swap">
<style>
:root{{color-scheme:dark;--bg:#000;--ink:#f2f2f2;--muted:#8f8f98;--line:#232327;--panel:#0b0b0d;--here:#f0a35c;--link:#5cc8f0;--ok:#5fd38d}}
html,body{{background:var(--bg)}}
body{{color:var(--ink);font:15px/1.6 Figtree,system-ui,-apple-system,"Segoe UI",sans-serif;margin:0}}
a{{color:var(--link)}}a:focus-visible{{outline:2px solid var(--here);outline-offset:2px}}
.top{{position:sticky;top:0;z-index:5;background:rgba(0,0,0,.94);border-bottom:1px solid var(--line);backdrop-filter:blur(6px)}}
.bar{{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center;padding:10px 16px}}
.brand{{font-weight:800}}
.path{{display:flex;gap:6px;flex-wrap:wrap;margin-left:auto;font-size:13px}}
.path a{{text-decoration:none;color:var(--muted);border:1px solid #33333a;border-radius:999px;padding:3px 12px}}
.path a[aria-current]{{color:#000;background:var(--here);border-color:var(--here);font-weight:700}}
.wrap{{max-width:880px;margin:0 auto;padding-inline:16px;padding-block:22px 40px;display:grid;gap:18px}}
h1{{margin:0;font-size:clamp(28px,5vw,38px);font-weight:800;line-height:1.1;text-wrap:balance}}
.sub{{color:var(--muted);margin:0;max-width:68ch}}
code{{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:.86em;background:#141418;border:1px solid #24242a;border-radius:4px;padding:0 4px}}
{extra}
</style>
<header class="top"><div class="bar"><span class="brand">{brand}</span>
<nav class="path" aria-label="Understand, Build, Prove">
<a href="guide.html">1 Understand</a><a href="build.html"{b}>2 Build</a><a href="lab.html"{l}>3 Prove</a></nav></div></header>
'''

BUILD_CSS = '''
.summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
.summary div{border:1px solid var(--line);border-radius:10px;background:var(--panel);padding:10px 12px}
.summary b{display:block;font-size:24px;font-variant-numeric:tabular-nums}
.summary span{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}
.now-box{border:1px solid var(--here);background:#140f08;border-radius:12px;padding:14px 16px;display:grid;gap:4px}
.now-box .k{font-size:11.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--here);font-weight:700}
ol.steps{list-style:none;margin:0;padding:0;display:grid;gap:0;position:relative}
ol.steps li{display:grid;grid-template-columns:40px minmax(0,1fr);gap:14px;padding-bottom:16px;position:relative}
ol.steps li::before{content:"";position:absolute;left:19px;top:34px;bottom:0;width:2px;background:var(--line)}
ol.steps li:last-child::before{display:none}
.dot{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;font:700 13px "JetBrains Mono",monospace;border:2px solid #3a3a42;color:var(--muted);background:#000;position:relative;z-index:1}
.done .dot{background:var(--ok);border-color:var(--ok);color:#000}
.now .dot{background:var(--here);border-color:var(--here);color:#000;box-shadow:0 0 0 5px rgba(240,163,92,.18)}
.step{border:1px solid var(--line);border-radius:12px;background:var(--panel);padding:12px 14px;display:grid;gap:6px;min-width:0}
.now .step{border-color:var(--here)}
.done .step{opacity:.78}
.step h2{margin:0;font-size:17px;display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}
.tag{font:700 10.5px "JetBrains Mono",monospace;text-transform:uppercase;letter-spacing:.05em;border-radius:4px;padding:1px 6px;border:1px solid}
.tag.done{color:var(--ok);border-color:var(--ok)}.tag.now{color:#000;background:var(--here);border-color:var(--here)}
.tag.next{color:var(--link);border-color:var(--link)}.tag.later{color:var(--muted);border-color:#44444c}
.step p{margin:0}
.proof{font-size:14px;color:#d9d9de}.proof b{color:var(--ok)}
.note{font-size:13.5px;color:#e8dccb;border-left:3px solid var(--here);padding-left:10px}
.links{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:13px}
.rule{border:1px dashed #44444c;border-radius:10px;padding:10px 14px;color:var(--muted);font-size:14px}
.rule b{color:var(--ink)}
@media (max-width:560px){.summary{grid-template-columns:repeat(2,minmax(0,1fr))}}
'''

LAB_CSS = '''
.entry{border:1px solid var(--line);border-radius:12px;background:var(--panel);padding:12px 14px;display:grid;gap:8px}
.entry h2{margin:0;font-size:17px}
.meta{font-size:12.5px;color:var(--muted);font-variant-numeric:tabular-nums}
.grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.grid3 div{border-top:2px solid var(--c);padding-top:6px}
.grid3 b{display:block;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--c)}
.empty{border:1px dashed #44444c;border-radius:12px;padding:16px;color:var(--muted)}
.empty pre{margin:10px 0 0;background:#070709;border:1px solid #1f1f24;border-radius:8px;padding:10px;overflow-x:auto;font:12.5px/1.6 "JetBrains Mono",monospace;color:#e2e2e6}
h2.sec{font-size:13px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin:10px 0 0}
ul.q{list-style:none;margin:0;padding:0;display:grid;gap:8px}
ul.q li{border:1px solid var(--line);border-radius:10px;padding:10px 12px;background:var(--panel)}
ul.q b{display:block}
ul.q span{color:#c9c9cf;font-size:14px}
@media (max-width:640px){.grid3{grid-template-columns:minmax(0,1fr)}}
'''


def build_page():
    counts = {k: sum(1 for s in STEPS if s["status"] == k) for k in ("done", "now", "next", "later")}
    now = [s for s in STEPS if s["status"] == "now"]
    items = []
    for s in STEPS:
        links = list(s["links"])
        if s.get("level"):
            links.append((f"Level {s['level'][1:]} detail", f"levels.html#{s['level']}"))
        lk = "".join(f'<a href="{e(h)}">{e(t)}</a>' for t, h in links)
        note = f'<p class="note">{e(s["note"])}</p>' if s.get("note") else ""
        label = {"done": "Done", "now": "Now", "next": "Next", "later": "Later"}[s["status"]]
        items.append(f'''<li class="{s['status']}" id="step-{s['n']}"><span class="dot" aria-hidden="true">{s['n']}</span>
<div class="step"><h2>{e(s['title'])} <span class="tag {s['status']}">{label}</span></h2>
<p>{e(s['goal'])}</p><p class="proof"><b>Done when:</b> {e(s['proof'])}</p>{note}
<div class="links">{lk}</div></div></li>''')
    now_html = "".join(f'<a href="#step-{s["n"]}">{s["n"]}. {e(s["title"])}</a>' for s in now) or "Nothing in progress."
    body = f'''<main class="wrap">
<div><h1>Build path</h1>
<p class="sub">One ordered list of real code tasks in the PaymentSecurityJourney repo. A step is done only when its proof passes on your machine. Each step links to where the concept is explained.</p></div>
<div class="summary"><div><b>{counts['done']}</b><span>Done</span></div><div><b>{counts['now']}</b><span>In progress</span></div><div><b>{counts['next']}</b><span>Next</span></div><div><b>{counts['later']}</b><span>Later</span></div></div>
<div class="now-box"><span class="k">You are here</span>{now_html}</div>
<p class="rule"><b>One rule:</b> a new concept goes into its existing home (a Guide section or a Decision Card), never a new page. New effort goes into Build steps and Lab log entries.</p>
<ol class="steps">{"".join(items)}</ol>
<p class="sub">To update this page, edit <code>skills/concept-explorer/learn/path_data.py</code> and run <code>python3 skills/concept-explorer/learn/build_path.py</code>.</p>
</main>
'''
    page = HEAD.format(title="Build path", brand="Build path", extra=BUILD_CSS, b=' aria-current="page"', l="") + body
    open(os.path.join(SITE, "build.html"), "w", encoding="utf-8").write(page)


def lab_page():
    titles = {s["n"]: s["title"] for s in STEPS}
    if LAB:
        entries = "".join(f'''<article class="entry"><h2>{e(x['title'])}</h2>
<p class="meta">{e(x['date'])}{f' · Build step <a href="build.html#step-{x["step"]}">{x["step"]}. {e(titles.get(x["step"], ""))}</a>' if x.get('step') else ''}</p>
<div class="grid3"><div style="--c:#5cc8f0"><b>Predicted</b>{e(x['predicted'])}</div><div style="--c:#f0a35c"><b>Saw</b>{e(x['saw'])}</div><div style="--c:#5fd38d"><b>Learned</b>{e(x['learned'])}</div></div></article>'''
                          for x in LAB)
    else:
        entries = '''<div class="empty"><b>No entries yet.</b> After every experiment, drill or surprise, add one entry to <code>LAB</code> in <code>skills/concept-explorer/learn/path_data.py</code>:
<pre>dict(date="2026-10-17", step=6,
     title="Stored password after moving users to the DB",
     predicted="It starts with {bcrypt}$2a$10$",
     saw="...",
     learned="...")</pre></div>'''
    queued = "".join(f'<li><b>{e(t)}</b><span>{e(d)}</span></li>' for t, d in QUEUED)
    body = f'''<main class="wrap">
<div><h1>Lab log</h1>
<p class="sub">Evidence, not notes: what I predicted, what my own system actually did, and what that taught me. Three lines per entry, newest first.</p></div>
<h2 class="sec">Entries ({len(LAB)})</h2>
{entries}
<h2 class="sec">Waiting to run ({len(QUEUED)})</h2>
<ul class="q">{queued}</ul>
</main>
'''
    page = HEAD.format(title="Lab log", brand="Lab log", extra=LAB_CSS, b="", l=' aria-current="page"') + body
    open(os.path.join(SITE, "lab.html"), "w", encoding="utf-8").write(page)


if __name__ == "__main__":
    build_page()
    lab_page()
    print("build.html + lab.html written")
