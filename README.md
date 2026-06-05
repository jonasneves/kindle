# kindle

A serverless read-later for the Kindle experimental browser — the repo is the
database, GitHub Pages is the host, and a WebRTC side-channel lets a laptop tab
stream straight to the device. Live at **neves.cloud/kindle**.

Two ways to put text on the Kindle:

```
durable   kindle-add <url>   fetch -> extract -> docs/a/<slug>.json -> build.py -> commit -> push
          (~1 min Pages rebuild; saved forever, reread anytime)

live      cast.html (laptop) ==WebRTC==> live.html (Kindle)
          (type/paste, or a bookmarklet mirrors any tab; updates in ~1s, nothing saved)
```

`docs/index.html` dispatches by user-agent: a Kindle stays on the reading list,
any other browser is sent to `cast.html`. Override with `?app=reader|cast|live`.

## Save an article
```sh
bin/kindle-add https://example.com/some-article     # live in ~1 min
bin/kindle-add <url> --no-push                       # build locally only
```
You change *what you read* from your laptop; reload on the Kindle to see it.
`trafilatura` extracts the article to markdown, then to minimal `<p>/<h2>/<a>` HTML.

## Cast a tab live
Open `cast.html` on a laptop, type (or drag its bookmarklet onto any page to
mirror that tab); `live.html` on the Kindle receives it over a WebRTC data
channel. Signaling via `signal.neevs.io`; transport vendored as
`docs/vendor/transport.kindle.js` (ES2017 — the Kindle can't parse `?.`/`??`).
Append `?s=<secret>` to both URLs for a private room.

## Constraints (why it's built this way)
- **Static only** — no server to run; the repo *is* the store, Pages serves it.
- **~2012 WebKit** — server-rendered static HTML, no flex/grid; live JS stays ES2017-safe.
- **E-ink** — black/white, large serif, block layout, justified paragraphs.
- **Subpath** — served under `/kindle/`, so asset links stay **relative**.

`docs/index.html` and `docs/a/*.html` are generated — never hand-edit; run `build.py`.
`docs/probe.html` and `docs/pair-diag.html` are throwaway WebRTC diagnostics.
