# AGENTS.md

## Cursor Cloud specific instructions

### What this repo is
Vidso is a **static frontend** (marketing landing site + a client-side dashboard SPA) deployed on **Vercel**. There is **no `package.json`, no build step, and no server-side code** in this repo. Routing is defined entirely in `vercel.json` (`rewrites`, `redirects`, `trailingSlash`, `headers`). The backend API is **external** (Railway, see `BASE` in `api.js`) and is not part of this repo.

Key paths:
- `landing/index.html` — the marketing landing page (self-contained, uses inline scripts + vendored GSAP in `vendor/gsap/`). Served at `/landing`.
- `dashboard/index.html` — the dashboard SPA. Served at `/overview`, `/clipping`, `/login`, `/signup`, etc. via `vercel.json` rewrites.
- `api.js` — API client pointing at the external backend.
- Static routes `/privacy`, `/terms`, `/refund` map to their folder `index.html`.

### Running it locally (dev)
There is no dependency install and nothing to build. Node/npm and Python 3 are preinstalled. The `vercel` CLI is **not** installed, and `vercel dev` would require an interactive Vercel login, so use the bundled dev server which replays `vercel.json` routing:

```
python3 scripts/dev-server.py --port 3000
```

Then open `http://localhost:3000/` (auto-redirects to `/landing`). Because pages use root-relative asset paths (e.g. `/vendor/gsap/gsap.min.js`), you must serve from the repo root — a plain `python3 -m http.server` will NOT apply the `vercel.json` rewrites (e.g. `/overview` → `dashboard/index.html`), so prefer `scripts/dev-server.py`.

### Non-obvious gotchas
- **The dashboard requires the external backend + auth.** Visiting `/overview`, `/login`, `/signup`, `/clipping`, etc. loads the dashboard SPA, which shows a full-screen loading animation (a spinning 3D cube) while it tries to authenticate against the external Railway API. Without valid credentials / a reachable backend it will stay on that loader or redirect to `/login`. This is expected locally — it is not a crash of the site. The fully exercisable part locally is the **landing page**.
- Since it's static, "hot reload" is just editing the HTML/CSS/JS and refreshing the browser; the dev server serves files fresh each request (no caching layer).
- `script.js` / `styles.css` at the repo root belong to an older/root marketing page; the current landing page (`landing/index.html`) is self-contained and does not load them.
