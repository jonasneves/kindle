# kindle

Custom content for the Kindle experimental browser. Live at **neves.cloud/kindle**.

- E-ink constraints: pure black/white, large serif, block layout (no flex/grid), ES5-only JS.
- Plain HTTP/HTTPS via GitHub Pages — old WebKit chokes on exotic TLS, GH Pages certs are fine.
- Single self-contained `docs/index.html`. Asset links must stay **relative** (served under a subpath).
- Deploy: push to `main`; Pages serves `main:/docs`.

On the Kindle: **Menu (⋮) → Web Browser** → address bar → `neves.cloud/kindle`.
