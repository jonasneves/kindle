# kindle

A git-backed read-later for the Kindle experimental browser. Live at **neves.cloud/kindle**.

Wallabag-shaped, but with no server — GitHub Pages is the host, the repo is the database.

```
save:   kindle-add <url>     fetch -> extract -> docs/a/<slug>.json -> build -> commit -> push
build:  build.py             docs/a/*.json  ->  docs/index.html + docs/a/<slug>.html
read:   Kindle browser       Menu (⋮) -> Web Browser -> neves.cloud/kindle
```

## Use
```sh
bin/kindle-add https://example.com/some-article     # live in ~1 min
bin/kindle-add <url> --no-push                       # build locally only
```
"Real-time" = push-to-live latency (~1 min Pages rebuild). You change *what you read*
from your laptop; reload on the Kindle to see it. No always-on server.

## Constraints (why it's built this way)
- **Static only** — GitHub Pages can't run Wallabag (PHP + DB). Repo *is* the store.
- **~2012 WebKit** — pages are server-rendered static HTML, ES5, no fetch/CORS, no flex/grid.
- **E-ink** — pure black/white, large serif, block layout, justified paragraphs.
- **Subpath** — served under `/kindle/`, so asset links stay **relative**.
- Extraction: `trafilatura` -> markdown -> minimal clean HTML (`<p>/<h2>/<a>`).

`docs/index.html` and `docs/a/*.html` are generated — never hand-edit; run `build.py`.
