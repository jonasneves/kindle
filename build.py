#!/usr/bin/env python3
"""Regenerate the static Kindle reader from saved articles.

Source of truth: docs/a/<slug>.json  (one file per saved article)
Outputs (overwritten every run, never hand-edit):
  docs/index.html        -- the reading list
  docs/a/<slug>.html     -- one clean e-ink page per article

Stdlib only, so it always runs. No runtime JS/fetch: everything is plain
static HTML so the Kindle's ~2012 WebKit just renders it.
"""
import glob
import html
import json
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
ADIR = os.path.join(ROOT, "docs", "a")

# --- e-ink baseline: black/white, big serif, block layout, no flex/grid ---
CSS = """
  html,body{margin:0;padding:0;background:#fff;color:#000}
  body{font-family:Georgia,"Times New Roman",serif;font-size:26px;
       line-height:1.55;padding:40px;-webkit-text-size-adjust:100%}
  a{color:#000}
  h1{font-size:42px;line-height:1.2;margin:0 0 6px 0}
  .site{font-size:20px;color:#555}
  hr{border:0;border-top:2px solid #000;margin:26px 0}
  /* list */
  .item{display:block;border-bottom:1px solid #999;padding:22px 0;text-decoration:none}
  .item .t{font-size:30px;font-weight:bold}
  .item .m{font-size:19px;color:#555;margin-top:4px}
  .empty{color:#555}
  /* article */
  article{font-size:27px}
  article p{margin:0 0 1em 0}
  article img{max-width:100%;height:auto}
  article h2,article h3,article h4{font-weight:bold;line-height:1.25;margin:1.1em 0 .25em}
  article h2{font-size:32px}
  article h3{font-size:29px}
  article h4{font-size:27px}
  .nav{font-size:20px;margin-bottom:24px}
  .foot{font-size:18px;color:#555;margin-top:48px}
"""

def page(title, body):
    return (
        "<!doctype html><html lang=en><head><meta charset=utf-8>"
        '<meta name=viewport content="width=device-width,initial-scale=1">'
        "<title>" + html.escape(title) + "</title><style>" + CSS +
        "</style></head><body>" + body + "</body></html>\n"
    )

def load():
    arts = []
    for p in glob.glob(os.path.join(ADIR, "*.json")):
        with open(p, encoding="utf-8") as f:
            d = json.load(f)
        d["slug"] = os.path.splitext(os.path.basename(p))[0]
        arts.append(d)
    # newest first; 'added' is an ISO-ish string so lexical sort works
    arts.sort(key=lambda d: d.get("added", ""), reverse=True)
    return arts

def build():
    arts = load()

    # per-article reader pages
    for a in arts:
        url = a.get("url", "")
        src = ('<a href="' + html.escape(url) + '">source</a> &middot; ') if url else ""
        body = (
            '<div class=nav><a href="../index.html">&larr; reading list</a></div>'
            "<h1>" + html.escape(a["title"]) + "</h1>"
            '<div class=site>' + html.escape(a.get("site", "")) + "</div>"
            "<hr><article>" + a.get("html", "") + "</article>"
            '<div class=foot>' + src + "saved " + html.escape(a.get("added", "")[:10]) + "</div>"
        )
        with open(os.path.join(ADIR, a["slug"] + ".html"), "w", encoding="utf-8") as f:
            f.write(page(a["title"], body))

    # the list
    if arts:
        rows = ""
        for a in arts:
            rows += (
                '<a class=item href="a/' + a["slug"] + '.html">'
                '<div class=t>' + html.escape(a["title"]) + "</div>"
                '<div class=m>' + html.escape(a.get("site", "")) +
                " &middot; " + html.escape(a.get("added", "")[:10]) + "</div></a>"
            )
    else:
        rows = '<p class=empty>Nothing saved yet. Run <b>kindle-add &lt;url&gt;</b>.</p>'

    body = (
        "<h1>read</h1>"
        '<div class=site>neves.cloud/kindle &middot; ' + str(len(arts)) + " saved</div>"
        "<hr>" + rows
    )
    with open(os.path.join(ROOT, "docs", "index.html"), "w", encoding="utf-8") as f:
        f.write(page("read", body))

    print("built: %d article(s)" % len(arts))

if __name__ == "__main__":
    build()
