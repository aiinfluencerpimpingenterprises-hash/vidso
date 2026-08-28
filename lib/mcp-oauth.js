/** OAuth 2.1 + DCR so Claude custom connectors can paste a Vidso MCP URL. */

import { createHash } from 'node:crypto'
import { parseCookies, requestOrigin, signPayload, verifyPayload } from './youtube.js'

const UPSTREAM = process.env.UPSTREAM_API || 'https://vibrant-patience-production-a7f0.up.railway.app'
const ACCESS_MS = 55 * 60 * 1000
const CODE_MS = 5 * 60 * 1000
const CLIENT_MS = 400 * 24 * 60 * 60 * 1000
const REFRESH_MS = 30 * 24 * 60 * 60 * 1000

export const MCP_CONNECTOR_PATH = '/mcp'
export const MCP_LEGACY_PATH = '/api/youtube/mcp'

export function canonicalMcpUrl(origin) {
  return String(origin || '').replace(/\/+$/, '') + MCP_CONNECTOR_PATH
}

export function mcpResourceFromReq(req) {
  const origin = requestOrigin(req)
  const path = String(req?.url || '').split('?')[0]
  if (path === MCP_LEGACY_PATH || path.startsWith(MCP_LEGACY_PATH + '/')) return origin + MCP_LEGACY_PATH
  return origin + MCP_CONNECTOR_PATH
}

export function protectedResourceMetadataPath(_resourceUrl) {
  // Vercel 404s `/.well-known/oauth-protected-resource/mcp` (extra path after
  // the rewrite). Claude only needs the document; `resource` inside it is /mcp.
  return '/.well-known/oauth-protected-resource'
}

export function wantsBrowserPage(req) {
  if (String(req?.method || 'GET').toUpperCase() !== 'GET') return false
  if (req?.headers?.['mcp-protocol-version']) return false
  const accept = String(req?.headers?.accept || '')
  if (accept.includes('text/event-stream')) return false
  if (accept.includes('application/json') && !accept.includes('text/html')) return false
  return accept.includes('text/html') || accept.includes('*/*') || !accept
}

export function mcpConnectorPageHtml(origin) {
  const url = canonicalMcpUrl(origin)
  const safe = url.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Vidso YouTube · Claude connector</title>
<style>
html,body{margin:0;min-height:100%;background:#0B0B0C;color:#F5F5F4;font:16px/1.5 Inter,system-ui,sans-serif}
body{display:grid;place-items:center;padding:28px}
.card{width:min(560px,100%);background:#18181B;border:1px solid rgba(245,245,244,.12);border-radius:18px;padding:28px 24px;display:flex;flex-direction:column;gap:14px}
h1{margin:0;font-size:1.35rem;letter-spacing:-.03em}
p,ol{margin:0;color:rgba(245,245,244,.68);font-size:.92rem}
ol{padding-left:1.2em;display:flex;flex-direction:column;gap:8px}
code,pre{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
pre{margin:0;padding:12px 14px;border-radius:10px;background:#111;color:#F5F5F4;overflow:auto;font-size:.82rem}
button{height:40px;border:0;border-radius:10px;background:linear-gradient(135deg,#F0606C,#B31D2C);color:#fff;font:inherit;font-weight:700;cursor:pointer}
a{color:#E94B58}
</style>
</head>
<body>
<div class="card">
  <h1>Add Vidso YouTube in Claude</h1>
  <p>This address is for Claude Connectors. Paste it there — opening it in a browser is not the login.</p>
  <ol>
    <li>In Claude go to <strong>Settings → Connectors → Add custom connector</strong></li>
    <li>Name it <strong>Vidso YouTube</strong></li>
    <li>Paste this URL, then Connect and sign in to Vidso</li>
  </ol>
  <pre id="u">${safe}</pre>
  <button type="button" id="c">Copy link</button>
  <p><a href="/video-generation">Back to Vidso</a></p>
</div>
<script>
const u = ${JSON.stringify(url)}
document.getElementById('c').onclick = async () => {
  try { await navigator.clipboard.writeText(u); document.getElementById('c').textContent = 'Copied' } catch (e) {}
}
</script>
</body>
</html>`
}

export function wwwAuthenticate(resourceMetadataUrl) {
  return 'Bearer ' + 'resource_metadata="' + String(resourceMetadataUrl || '') + '", error="invalid_token"'
}

export function protectedResourceMetadata(origin, resourceUrl) {
  const resource = resourceUrl || canonicalMcpUrl(origin)
  return {
    resource,
    authorization_servers: [origin],
    bearer_methods_supported: ['header'],
    scopes_supported: ['mcp'],
    resource_name: 'Vidso YouTube',
  }
}

export function authorizationServerMetadata(origin) {
  return {
    issuer: origin,
    authorization_endpoint: origin + '/oauth/authorize',
    token_endpoint: origin + '/oauth/token',
    registration_endpoint: origin + '/oauth/register',
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: ['mcp'],
    revocation_endpoint_auth_methods_supported: ['none'],
  }
}

export function oauthApiSubpath(req) {
  const fromQuery = [].concat(req?.query?.path || []).filter(Boolean).join('/')
  if (fromQuery) return fromQuery.replace(/\/+$/, '')
  const pathOnly = String(req?.url || '').split('?')[0]
  const well = pathOnly.match(/\/\.well-known\/(oauth-protected-resource|oauth-authorization-server|openid-configuration)\/?(.*)$/i)
  if (well) {
    const kind = well[1].toLowerCase()
    const rest = String(well[2] || '').replace(/\/+$/, '')
    if (kind === 'oauth-protected-resource') return rest ? 'protected-resource/' + rest : 'protected-resource'
    return 'authorization-server'
  }
  const oauth = pathOnly.match(/\/(?:api\/)?oauth\/?(.*)$/i)
  return String(oauth?.[1] || '').replace(/\/+$/, '')
}

export function resourceFromMetadataSubpath(sub, origin) {
  const rest = String(sub || '').replace(/^protected-resource\/?/, '')
  if (!rest) return canonicalMcpUrl(origin)
  return origin + '/' + rest.replace(/^\/+/, '')
}

export function pkceS256(verifier) {
  return createHash('sha256').update(String(verifier || '')).digest('base64url')
}

export function verifyPkce(verifier, challenge, method = 'S256') {
  if (!verifier || !challenge) return false
  if (String(method || 'S256').toUpperCase() === 'PLAIN') return verifier === challenge
  return pkceS256(verifier) === challenge
}

export function registerClient(body, env = process.env) {
  const redirectUris = (Array.isArray(body?.redirect_uris) ? body.redirect_uris : [])
    .map((u) => String(u || '').trim())
    .filter(Boolean)
  if (!redirectUris.length) {
    const err = new Error('redirect_uris is required')
    err.status = 400
    err.body = { error: 'invalid_client_metadata', error_description: 'redirect_uris is required' }
    throw err
  }
  const issuedAt = Math.floor(Date.now() / 1000)
  const clientId = signPayload({
    typ: 'mcp_oauth_client',
    redirect_uris: redirectUris,
    client_name: String(body?.client_name || 'Claude').slice(0, 80),
    exp: Date.now() + CLIENT_MS,
  }, env)
  return {
    client_id: clientId,
    client_id_issued_at: issuedAt,
    client_name: String(body?.client_name || 'Claude').slice(0, 80),
    redirect_uris: redirectUris,
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
  }
}

export function readClient(clientId, env = process.env) {
  const payload = verifyPayload(clientId, env)
  if (payload.typ !== 'mcp_oauth_client') throw new Error('Unknown OAuth client')
  return payload
}

export function assertRedirect(client, redirectUri) {
  const uri = String(redirectUri || '')
  if (!uri || !Array.isArray(client.redirect_uris) || !client.redirect_uris.includes(uri)) {
    const err = new Error('redirect_uri mismatch')
    err.status = 400
    err.body = { error: 'invalid_request', error_description: 'redirect_uri mismatch' }
    throw err
  }
}

export function issueAuthCode({ access, refresh, clientId, redirectUri, codeChallenge, resource }, env = process.env) {
  return signPayload({
    typ: 'mcp_oauth_code',
    access,
    refresh: refresh || '',
    client_id: clientId,
    redirect_uri: redirectUri,
    code_challenge: codeChallenge,
    resource,
    exp: Date.now() + CODE_MS,
  }, env)
}

export function issueAccessToken({ access, refresh, resource }, env = process.env) {
  return signPayload({
    typ: 'mcp_oauth_access',
    token: access,
    refresh: refresh || '',
    aud: resource,
    exp: Date.now() + ACCESS_MS,
  }, env)
}

export function issueRefreshToken({ refresh, clientId, resource }, env = process.env) {
  return signPayload({
    typ: 'mcp_oauth_refresh',
    refresh,
    client_id: clientId,
    resource,
    exp: Date.now() + REFRESH_MS,
  }, env)
}

export function tokenResponse({ access, refresh, clientId, resource }, env = process.env) {
  const accessToken = issueAccessToken({ access, refresh, resource }, env)
  const refreshToken = refresh ? issueRefreshToken({ refresh, clientId, resource }, env) : ''
  return {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: Math.floor(ACCESS_MS / 1000),
    scope: 'mcp',
    ...(refreshToken ? { refresh_token: refreshToken } : {}),
  }
}

export function unwrapMcpBearer(token, env = process.env) {
  const raw = String(token || '')
  if (!raw || !raw.includes('.')) return { kind: 'vidso', token: raw }
  try {
    const payload = verifyPayload(raw, env)
    if (payload.typ === 'mcp_oauth_access' && payload.token) {
      return { kind: 'mcp', token: payload.token, refresh: payload.refresh || '', aud: payload.aud || '' }
    }
  } catch {
    return { kind: 'vidso', token: raw }
  }
  return { kind: 'vidso', token: raw }
}

export async function refreshVidsoSession(refreshToken) {
  const res = await fetch(UPSTREAM + '/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })
  const data = await res.json().catch(() => ({}))
  const session = data.session || data.data?.session || data
  if (!res.ok || !session?.access_token) {
    const err = new Error(data.message || data.error || 'Could not refresh Vidso session')
    err.status = 400
    err.body = { error: 'invalid_grant', error_description: err.message }
    throw err
  }
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token || refreshToken,
  }
}

export async function vidsoSessionFromCookies(req) {
  const cookies = parseCookies(req)
  const access = String(cookies.clipzo_token || '').trim()
  const refresh = String(cookies.clipzo_refresh || '').trim()
  if (!access && !refresh) return null
  if (access) {
    const me = await fetch(UPSTREAM + '/api/user/me', { headers: { Authorization: 'Bearer ' + access } })
    if (me.ok) return { access, refresh }
  }
  if (!refresh) return null
  const session = await refreshVidsoSession(refresh)
  return { access: session.access_token, refresh: session.refresh_token }
}

export function parseForm(raw) {
  const out = {}
  const text = String(raw || '')
  if (!text) return out
  if (text.trim().startsWith('{')) {
    try { return JSON.parse(text) } catch { return out }
  }
  for (const part of text.split('&')) {
    const i = part.indexOf('=')
    const k = decodeURIComponent((i < 0 ? part : part.slice(0, i)).replace(/\+/g, ' '))
    const v = decodeURIComponent((i < 0 ? '' : part.slice(i + 1)).replace(/\+/g, ' '))
    if (k) out[k] = v
  }
  return out
}

export function safeAuthNext(value) {
  const next = String(value || '')
  if (!next.startsWith('/oauth/') && !next.startsWith('/api/oauth/')) return ''
  if (next.startsWith('//') || next.includes('://')) return ''
  return next
}

/** Login may resume Claude authorize only after a Vidso session exists. */
export function shouldResumeAuthorize(next, hasSession) {
  return Boolean(safeAuthNext(next) && hasSession)
}

export function authorizeHtml(message) {
  const copy = String(message || 'Connecting Claude to Vidso…')
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Vidso · Connect Claude</title><style>html,body{margin:0;min-height:100%;background:#0B0B0C;color:#F5F5F4;font:15px/1.45 Inter,system-ui,sans-serif;display:grid;place-items:center}p{opacity:.72}</style></head><body><p>${copy.replace(/[<>]/g, '')}</p></body></html>`
}
