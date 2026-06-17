# kindle

A serverless read-later for the Kindle experimental browser. The repo **is** the
database, GitHub Pages is the host: you add text, a static site rebuilds, and it's
live at **neves.cloud/kindle** in ~1 min. Nothing runs — the push-to-live latency
*is* the "real-time" here.

Built mostly for **Claude-generated text** — a long answer, a synthesis, a draft —
piped straight onto the device to read on e-ink instead of in a terminal. Saving a
web article works too.

## Add something to read
```sh
… | bin/kindle-add --stdin --title "On focus"   # pipe markdown in (the main path)
bin/kindle-add --md notes.md                      # a local markdown file
bin/kindle-add https://example.com/article        # fetch + extract a web page
bin/kindle-add <…> --no-push                       # build locally, don't publish
```
Text forms take markdown directly; a leading `# H1` becomes the title (else
`--title`, else the filename) and is dropped from the body so it isn't repeated.
The URL form uses `trafilatura` to extract the article to markdown. All three write
`docs/a/<slug>.json`, rebuild, commit, and push. Reload on the Kindle to see it.

## How it renders
`build.py` turns each `docs/a/<slug>.json` into a clean e-ink page and regenerates
`docs/index.html` (the reading list). No runtime JS or fetch — plain static HTML the
Kindle's ~2012 WebKit just renders.

## Constraints (why it's built this way)
- **Static only** — no server; the repo is the store, Pages serves it.
- **~2012 WebKit** — server-rendered static HTML, no flex/grid.
- **E-ink** — black/white, large serif, block layout, justified paragraphs.
- **Subpath** — served under `/kindle/`, so asset links stay **relative**.

`docs/index.html` and `docs/a/*.html` are generated — never hand-edit; run `build.py`.
