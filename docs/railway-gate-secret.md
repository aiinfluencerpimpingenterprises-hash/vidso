# Railway: only accept paid calls that came through the TubeOps gate

The Vercel gate (`api/gate`, `lib/gate-run.js`) checks the user's plan and
credits before it forwards a paid call to Railway. Railway itself doesn't check,
so anyone with a TubeOps login can call these routes on the Railway URL directly
and skip the plan check.

Since this change, the gate sends a shared secret on every call it forwards:

    X-TubeOps-Gate: <TUBEOPS_GATE_SECRET>

## 1. Set the same secret in both places

Generate one long random value, e.g. `openssl rand -hex 32`, then set it as:

- **Vercel** (TubeOps project → Settings → Environment Variables, Production):
  `TUBEOPS_GATE_SECRET`
- **Railway** (backend service → Variables): `TUBEOPS_GATE_SECRET`

Set Vercel first and redeploy, then Railway. The order doesn't break anything:
the gate sends the header whether or not Railway checks it yet.

## 2. Add this check to the Railway backend (Express)

Put it before the route handlers:

```js
const crypto = require('crypto')

// Paid routes the TubeOps gate checks; keep in sync with ruleFor() in lib/gate-run.js.
const GATED = [
  ['POST', /^\/api\/faceless\/script\/?$/],
  ['POST', /^\/api\/faceless\/media\/?$/],
  ['POST', /^\/api\/faceless\/render\/?$/],
  ['POST', /^\/api\/download\/analyze\/?$/],
  ['POST', /^\/api\/autoclip(\/.*)?$/],
]

function sameSecret(a, b) {
  const x = Buffer.from(String(a || ''))
  const y = Buffer.from(String(b || ''))
  return x.length === y.length && crypto.timingSafeEqual(x, y)
}

app.use((req, res, next) => {
  const secret = process.env.TUBEOPS_GATE_SECRET
  if (!secret) return next() // not configured yet: behave as before
  const gated = GATED.some(([m, re]) => req.method === m && re.test(req.path))
  if (!gated) return next()
  if (sameSecret(req.get('x-tubeops-gate'), secret)) return next()
  return res.status(403).json({ error: 'Use TubeOps to start this.', code: 'gate_required' })
})
```

## 3. Check it

- A normal video made in the app still works (it goes through the gate).
- A direct call is refused with 403:

```bash
curl -s -X POST https://vibrant-patience-production-a7f0.up.railway.app/api/faceless/render -H "Authorization: Bearer <a user token>" -H "Content-Type: application/json" -d '{}'
```

`/rapi/api/faceless/{script,media,render}`, `/rapi/api/download/analyze` and
`/rapi/api/autoclip` on the TubeOps domain already go through the gate (see the
first rewrites in `vercel.json`). The secret closes the direct Railway URL too.
