export const config = { maxDuration: 30 }

const UPSTREAM = process.env.UPSTREAM_API || 'https://vibrant-patience-production-a7f0.up.railway.app'

export function send(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

export function cors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, MCP-Protocol-Version, Accept, mcp-session-id, Last-Event-ID')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS')
  res.setHeader('Access-Control-Expose-Headers', 'MCP-Protocol-Version, WWW-Authenticate')
}

export async function readJson(req) {
  // On Vercel, reading req.body throws on malformed JSON; treat that as an empty body, not a 500.
  let parsed
  try { parsed = req.body } catch (_) { return {} }
  if (parsed && typeof parsed === 'object' && !Buffer.isBuffer(parsed)) return parsed
  const chunks = []
  for await (const c of req) chunks.push(c)
  if (!chunks.length) return {}
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') } catch { return {} }
}

export function bearer(req) {
  return String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim()
}

// Image/video polls call this every couple of seconds; a short cache keeps a busy
// Railway (recording narration) from turning each poll into a slow lookup or a 504.
const ME_TTL_MS = 15000
const meCache = globalThis.__vidsoMeCache || (globalThis.__vidsoMeCache = new Map())

export async function requireUser(req, tokenOverride) {
  const token = tokenOverride || bearer(req)
  if (!token) {
    const err = new Error('Missing token')
    err.status = 401
    throw err
  }
  const hit = meCache.get(token)
  if (hit && Date.now() - hit.at < ME_TTL_MS) return { user: hit.user, token }
  let res
  try {
    res = await fetch(UPSTREAM + '/api/user/me', { headers: { Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(8000) })
  } catch (e) {
    const err = new Error('TubeOps is busy right now. Try again in a moment.')
    err.status = 503
    throw err
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.message || data.error || 'Unauthorized')
    err.status = res.status
    err.body = data
    throw err
  }
  if (meCache.size > 200) meCache.delete(meCache.keys().next().value)
  meCache.set(token, { at: Date.now(), user: data })
  return { user: data, token }
}
