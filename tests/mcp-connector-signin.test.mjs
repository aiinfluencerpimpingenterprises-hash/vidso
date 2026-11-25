import test from 'node:test'
import assert from 'node:assert/strict'

process.env.YOUTUBE_TOKEN_SECRET = process.env.YOUTUBE_TOKEN_SECRET || 'unit-test-connector-signin'
const { default: handler } = await import('../api/oauth/[...path].js')
const { registerClient, pkceS256, issueRefreshToken } = await import('../lib/mcp-oauth.js')

function fakeReq({ method = 'GET', url, body, headers = {} }) {
  return {
    method,
    url,
    body,
    headers: { host: 'www.tubeops.pro', 'x-forwarded-proto': 'https', ...headers },
    query: {},
  }
}

async function call(reqInit) {
  const res = {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(k, v) { this.headers[k.toLowerCase()] = v },
    end(b) { this.body = b || '' },
  }
  await handler(fakeReq(reqInit), res)
  let json = null
  try { json = JSON.parse(res.body) } catch (_) {}
  return { status: res.statusCode, headers: res.headers, json, body: res.body }
}

const redirectUri = 'https://claude.ai/api/mcp/auth_callback'
const verifier = 'v'.repeat(48)

function authorizeQuery(clientId) {
  return new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    code_challenge: pkceS256(verifier),
    code_challenge_method: 'S256',
    state: 'st8',
  }).toString()
}

function mockBackend(t, { meOk = true } = {}) {
  const real = globalThis.fetch
  const seen = []
  globalThis.fetch = async (url, init) => {
    const u = String(url)
    seen.push(u)
    if (u.endsWith('/api/user/me')) return new Response(JSON.stringify({ id: 'u1' }), { status: meOk ? 200 : 401 })
    if (u.endsWith('/api/auth/refresh')) {
      return new Response(JSON.stringify({ session: { access_token: 'claude-access-2', refresh_token: 'claude-refresh-2' } }), { status: 200 })
    }
    return real(url, init)
  }
  t.after(() => { globalThis.fetch = real })
  return seen
}

test('authorize sends Claude to its own sign-in even when the browser is signed in', async () => {
  const { client_id } = registerClient({ redirect_uris: [redirectUri] })
  const r = await call({
    url: '/oauth/authorize?' + authorizeQuery(client_id),
    headers: { cookie: 'clipzo_token=browser-access; clipzo_refresh=browser-refresh' },
  })
  assert.equal(r.status, 302)
  const loc = new URL(r.headers.location)
  assert.equal(loc.pathname, '/login')
  assert.equal(loc.searchParams.get('connect'), 'claude')
  assert.match(loc.searchParams.get('next'), /^\/oauth\/authorize\?/)
})

test('a fresh sign-in becomes Claude\'s session and the code exchange works', async (t) => {
  const seen = mockBackend(t)
  const { client_id } = registerClient({ redirect_uris: [redirectUri] })
  const next = '/oauth/authorize?' + authorizeQuery(client_id)
  const s = await call({ method: 'POST', url: '/api/oauth/session', body: { access_token: 'claude-access', refresh_token: 'claude-refresh', next } })
  assert.equal(s.status, 200)
  const back = new URL(s.json.redirect)
  assert.equal(back.origin + back.pathname, redirectUri)
  assert.equal(back.searchParams.get('state'), 'st8')
  const tok = await call({
    method: 'POST',
    url: '/oauth/token',
    headers: { 'content-type': 'application/json' },
    body: { grant_type: 'authorization_code', code: back.searchParams.get('code'), redirect_uri: redirectUri, code_verifier: verifier },
  })
  assert.equal(tok.status, 200)
  assert.ok(tok.json.refresh_token)
  const ref = await call({
    method: 'POST',
    url: '/oauth/token',
    headers: { 'content-type': 'application/json' },
    body: { grant_type: 'refresh_token', refresh_token: tok.json.refresh_token },
  })
  assert.equal(ref.status, 200)
  assert.ok(seen.some((u) => u.endsWith('/api/auth/refresh')))
})

test('a sign-in the backend rejects is refused', async (t) => {
  mockBackend(t, { meOk: false })
  const { client_id } = registerClient({ redirect_uris: [redirectUri] })
  const s = await call({ method: 'POST', url: '/api/oauth/session', body: { access_token: 'x', refresh_token: 'y', next: '/oauth/authorize?' + authorizeQuery(client_id) } })
  assert.equal(s.status, 401)
})

test('session handoff only accepts a pending authorize URL', async (t) => {
  mockBackend(t)
  const s = await call({ method: 'POST', url: '/api/oauth/session', body: { access_token: 'a', refresh_token: 'b', next: '/dashboard' } })
  assert.equal(s.status, 400)
})

test('old connector tokens that shared the browser session must reconnect', async (t) => {
  const seen = mockBackend(t)
  const legacy = issueRefreshToken({ refresh: 'browser-refresh', clientId: 'c', resource: 'r', own: false })
  const r = await call({
    method: 'POST',
    url: '/oauth/token',
    headers: { 'content-type': 'application/json' },
    body: { grant_type: 'refresh_token', refresh_token: legacy },
  })
  assert.equal(r.status, 400)
  assert.equal(r.json.error, 'invalid_grant')
  assert.ok(!seen.some((u) => u.endsWith('/api/auth/refresh')), 'must not rotate the browser token')
})
