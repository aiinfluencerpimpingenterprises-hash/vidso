import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  authorizationServerMetadata,
  canonicalMcpUrl,
  issueAuthCode,
  mcpConnectorPageHtml,
  oauthApiSubpath,
  parseForm,
  pkceS256,
  protectedResourceMetadata,
  protectedResourceMetadataPath,
  readClient,
  registerClient,
  resourceFromMetadataSubpath,
  safeAuthNext,
  shouldResumeAuthorize,
  tokenResponse,
  unwrapMcpBearer,
  verifyPkce,
  wantsBrowserPage,
  wwwAuthenticate,
} from '../lib/mcp-oauth.js'

const env = { YOUTUBE_TOKEN_SECRET: 'unit-test-mcp-oauth' }

test('Claude connector URL is origin plus /mcp', () => {
  assert.equal(canonicalMcpUrl('https://www.vidso.pro'), 'https://www.vidso.pro/mcp')
  assert.equal(protectedResourceMetadataPath('https://www.vidso.pro/mcp'), '/.well-known/oauth-protected-resource')
  assert.equal(
    protectedResourceMetadataPath('https://www.vidso.pro/api/youtube/mcp'),
    '/.well-known/oauth-protected-resource',
  )
})

test('protected resource metadata names TubeOps YouTube and the authorization server', () => {
  const meta = protectedResourceMetadata('https://www.vidso.pro', 'https://www.vidso.pro/mcp')
  assert.equal(meta.resource, 'https://www.vidso.pro/mcp')
  assert.deepEqual(meta.authorization_servers, ['https://www.vidso.pro'])
  const as = authorizationServerMetadata('https://www.vidso.pro')
  assert.equal(as.authorization_endpoint, 'https://www.vidso.pro/oauth/authorize')
  assert.equal(as.registration_endpoint, 'https://www.vidso.pro/oauth/register')
  assert.ok(as.code_challenge_methods_supported.includes('S256'))
})

test('WWW-Authenticate points Claude at resource metadata', () => {
  const header = wwwAuthenticate('https://www.vidso.pro/.well-known/oauth-protected-resource')
  assert.equal(
    header.includes('resource_metadata="https://www.vidso.pro/.well-known/oauth-protected-resource"'),
    true,
  )
})

test('browser GET to /mcp is a connector page; JSON MCP clients are not', () => {
  assert.equal(wantsBrowserPage({ method: 'GET', headers: { accept: 'text/html' } }), true)
  assert.equal(wantsBrowserPage({ method: 'GET', headers: { accept: 'application/json, text/event-stream' } }), false)
  assert.equal(wantsBrowserPage({ method: 'POST', headers: { accept: 'text/html' } }), false)
  const html = mcpConnectorPageHtml('https://www.vidso.pro')
  assert.equal(html.includes('https://www.vidso.pro/mcp'), true)
  assert.equal(html.includes('Add custom connector'), true)
  assert.equal(html.includes('href="/agents"'), true) // Account settings live in the app
  assert.equal(html.includes('/connectors'), false)
})

test('DCR client ids round-trip redirect URIs', () => {
  const client = registerClient({
    client_name: 'Claude',
    redirect_uris: ['https://claude.ai/api/mcp/auth_callback'],
  }, env)
  assert.ok(client.client_id)
  const got = readClient(client.client_id, env)
  assert.equal(got.typ, 'mcp_oauth_client')
  assert.deepEqual(got.redirect_uris, ['https://claude.ai/api/mcp/auth_callback'])
})

test('PKCE S256 verifies the code_verifier', () => {
  const verifier = 'a'.repeat(43)
  const challenge = pkceS256(verifier)
  assert.equal(verifyPkce(verifier, challenge), true)
  assert.equal(verifyPkce('nope', challenge), false)
})

test('OAuth access tokens unwrap to the TubeOps JWT; raw JWTs still pass through', () => {
  const tokens = tokenResponse({
    access: 'vidso-jwt',
    refresh: 'vidso-rt',
    clientId: 'cid',
    resource: 'https://www.vidso.pro/mcp',
  }, env)
  const inner = unwrapMcpBearer(tokens.access_token, env)
  assert.equal(inner.kind, 'mcp')
  assert.equal(inner.token, 'vidso-jwt')
  const raw = unwrapMcpBearer('plain-vidso-jwt', env)
  assert.equal(raw.kind, 'vidso')
  assert.equal(raw.token, 'plain-vidso-jwt')
})

test('auth codes bind PKCE and the Claude redirect', () => {
  const code = issueAuthCode({
    access: 'jwt',
    refresh: 'rt',
    clientId: 'cid',
    redirectUri: 'https://claude.ai/cb',
    codeChallenge: 'abc',
    resource: 'https://www.vidso.pro/mcp',
  }, env)
  assert.ok(code.includes('.'))
})

test('well-known and oauth paths parse from the request URL', () => {
  assert.equal(oauthApiSubpath({ url: '/.well-known/oauth-protected-resource' }), 'protected-resource')
  assert.equal(oauthApiSubpath({ url: '/.well-known/oauth-protected-resource/mcp' }), 'protected-resource/mcp')
  assert.equal(oauthApiSubpath({ url: '/oauth/authorize?x=1' }), 'authorize')
  assert.equal(oauthApiSubpath({ url: '/api/oauth/token' }), 'token')
  assert.equal(resourceFromMetadataSubpath('protected-resource', 'https://www.vidso.pro'), 'https://www.vidso.pro/mcp')
  assert.equal(resourceFromMetadataSubpath('protected-resource/mcp', 'https://www.vidso.pro'), 'https://www.vidso.pro/mcp')
})

test('login next only returns to the OAuth authorize URL', () => {
  assert.equal(safeAuthNext('/oauth/authorize?x=1'), '/oauth/authorize?x=1')
  assert.equal(safeAuthNext('https://evil.test'), '')
  assert.equal(safeAuthNext('//evil.test'), '')
  assert.equal(safeAuthNext('/video-generation'), '')
})

test('Claude login does not bounce to authorize until the user has a session', () => {
  const next = '/oauth/authorize?client_id=abc'
  assert.equal(shouldResumeAuthorize(next, ''), false)
  assert.equal(shouldResumeAuthorize(next, null), false)
  assert.equal(shouldResumeAuthorize(next, 'access-jwt'), true)
  assert.equal(shouldResumeAuthorize('/video-generation', 'access-jwt'), false)
})

test('token form bodies parse urlencoded and JSON', () => {
  assert.equal(parseForm('grant_type=authorization_code&code=abc').grant_type, 'authorization_code')
  assert.equal(parseForm('{"grant_type":"refresh_token"}').grant_type, 'refresh_token')
})

// --- MCP is live for Claude connectors; landing marketing stays hidden.

import { MCP_ARCHIVED, mcpArchived, mcpPreviewOn } from '../lib/mcp-oauth.js'

function req(url = '/mcp', headers = {}) {
  return { url, headers, method: 'GET' }
}

test('the youtube MCP server is live for connectors', () => {
  assert.equal(MCP_ARCHIVED, false)
  assert.equal(mcpArchived(req('/mcp')), false)
  assert.equal(mcpArchived(req('/api/youtube/mcp')), false)
  assert.equal(mcpArchived(req('/oauth/authorize?client_id=x')), false)
  assert.equal(mcpArchived(req('/.well-known/oauth-authorization-server')), false)
})

test('studio still hides YouTube MCP until Studio is public', () => {
  const shell = readFileSync(new URL('../lib/studio-shell.js', import.meta.url), 'utf8')
  assert.match(shell, /id="fs-yt-mcp"[^>]*hidden/)
})

test('dashboard YouTube connect is reachable from settings and the profile menu', () => {
  const dashboard = readFileSync(new URL('../dashboard/index.html', import.meta.url), 'utf8')
  assert.match(dashboard, /id="nav-yt-mcp-btn"/)
  assert.doesNotMatch(dashboard, /id="nav-yt-mcp-btn"[^>]*\bdata-archived\b/)
  assert.match(dashboard, /id="settings-yt-link"/)
  assert.doesNotMatch(dashboard, /id="settings-yt-link"[^>]*\bdata-archived\b/)
  assert.match(dashboard, /id="fv-yt-upload"/)
  assert.match(dashboard, /id="files-lb-yt"/)
  assert.match(dashboard, /youtubeTitleFromFileName/)
  assert.doesNotMatch(dashboard, /btn\.textContent = .*Connect YouTube/)
})

test('preview flags still work if the server is archived by env', () => {
  assert.equal(mcpPreviewOn(req('/mcp?mcp=1')), true)
  const saved = process.env.VIDSO_MCP_ARCHIVED
  try {
    process.env.VIDSO_MCP_ARCHIVED = '1'
    assert.equal(mcpArchived(req('/mcp')), true)
    assert.equal(mcpArchived(req('/mcp?mcp=1')), false)
    assert.equal(mcpArchived(req('/oauth/token?mcp=1')), false)
    assert.equal(mcpArchived(req('/mcp', { 'x-vidso-mcp-preview': '1' })), false)
  } finally {
    if (saved === undefined) delete process.env.VIDSO_MCP_ARCHIVED
    else process.env.VIDSO_MCP_ARCHIVED = saved
  }
})

test('the archive can be lifted by env without editing code', () => {
  const saved = process.env.VIDSO_MCP_ARCHIVED
  try {
    process.env.VIDSO_MCP_ARCHIVED = '0'
    assert.equal(mcpArchived(req('/mcp')), false)
    process.env.VIDSO_MCP_ARCHIVED = 'false'
    assert.equal(mcpArchived(req('/mcp')), false)
    process.env.VIDSO_MCP_ARCHIVED = '1'
    assert.equal(mcpArchived(req('/mcp')), true)
  } finally {
    if (saved === undefined) delete process.env.VIDSO_MCP_ARCHIVED
    else process.env.VIDSO_MCP_ARCHIVED = saved
  }
})

// --- Security: redirect allow-list, opaque codes and tokens, malformed bodies.

import { allowedRedirectUri, assertRedirect, issueRefreshToken, readOAuthPayload } from '../lib/mcp-oauth.js'
import { signPayload } from '../lib/youtube.js'

test('registration only accepts Claude and loopback redirect URIs', () => {
  for (const ok of [
    'https://claude.ai/api/mcp/auth_callback',
    'https://claude.com/api/mcp/auth_callback',
    'https://app.claude.ai/cb',
    'http://localhost:33418/callback',
    'http://127.0.0.1:6274/oauth/callback',
    'https://localhost/cb',
  ]) assert.equal(allowedRedirectUri(ok), true, ok)
  for (const bad of [
    'https://evil.test/cb',
    'https://claude.ai.evil.test/cb',
    'https://evilclaude.ai/cb',
    'http://claude.ai/cb',
    'javascript:alert(1)',
    'data:text/html,hi',
    'http://localhost.evil.test/cb',
    'http://10.0.0.1/cb',
    'https://user@claude.ai/cb',
  ]) assert.equal(allowedRedirectUri(bad), false, bad)
  assert.throws(
    () => registerClient({ redirect_uris: ['https://claude.ai/cb', 'https://evil.test/steal'] }, env),
    (e) => e.status === 400 && e.body.error === 'invalid_redirect_uri',
  )
  assert.throws(
    () => registerClient({ redirect_uris: ['javascript:alert(1)'] }, env),
    (e) => e.status === 400 && e.body.error === 'invalid_redirect_uri',
  )
})

test('an old client id that lists a bad redirect no longer authorizes', () => {
  const legacy = signPayload({ typ: 'mcp_oauth_client', redirect_uris: ['https://evil.test/cb'], exp: Date.now() + 60000 }, env)
  const client = readClient(legacy, env)
  assert.throws(() => assertRedirect(client, 'https://evil.test/cb'), (e) => e.body.error === 'invalid_redirect_uri')
})

test('codes and tokens are opaque: no base64 JSON with the session inside', () => {
  const code = issueAuthCode({
    access: 'secret-supabase-access',
    refresh: 'secret-supabase-refresh',
    clientId: 'cid',
    redirectUri: 'https://claude.ai/cb',
    codeChallenge: 'abc',
    resource: 'https://www.vidso.pro/mcp',
  }, env)
  const tokens = tokenResponse({ access: 'secret-supabase-access', refresh: 'secret-supabase-refresh', clientId: 'cid', resource: 'r' }, env)
  for (const value of [code, tokens.access_token, tokens.refresh_token]) {
    for (const part of value.split('.')) {
      const decoded = Buffer.from(part, 'base64url').toString('utf8')
      assert.equal(decoded.includes('secret-supabase'), false)
      assert.throws(() => JSON.parse(decoded))
    }
  }
  // They still open on the server.
  assert.equal(readOAuthPayload(code, 'mcp_oauth_code', env).access, 'secret-supabase-access')
  assert.equal(readOAuthPayload(tokens.refresh_token, 'mcp_oauth_refresh', env).client_id, 'cid')
  // A sealed value can't be used as another kind of token.
  assert.throws(() => readOAuthPayload(code, 'mcp_oauth_access', env))
  assert.equal(unwrapMcpBearer(code, env).kind, 'vidso')
})

test('access tokens issued in the old signed form keep working; old codes do not', () => {
  const oldAccess = signPayload({ typ: 'mcp_oauth_access', token: 'old-jwt', refresh: '', aud: 'r', exp: Date.now() + 60000 }, env)
  const inner = unwrapMcpBearer(oldAccess, env)
  assert.equal(inner.kind, 'mcp')
  assert.equal(inner.token, 'old-jwt')
  const oldRefresh = signPayload({ typ: 'mcp_oauth_refresh', refresh: 'rt', own: 1, client_id: 'c', exp: Date.now() + 60000 }, env)
  assert.equal(readOAuthPayload(oldRefresh, 'mcp_oauth_refresh', env, { legacy: true }).refresh, 'rt')
  const oldCode = signPayload({ typ: 'mcp_oauth_code', access: 'a', exp: Date.now() + 60000 }, env)
  assert.throws(() => readOAuthPayload(oldCode, 'mcp_oauth_code', env))
  // A tampered sealed token is refused.
  const sealed = tokenResponse({ access: 'a', refresh: 'b', clientId: 'c', resource: 'r' }, env).access_token
  assert.equal(unwrapMcpBearer(sealed.slice(0, -2) + (sealed.endsWith('AA') ? 'BB' : 'AA'), env).kind, 'vidso')
})

async function oauthCall(reqInit) {
  const { default: handler } = await import('../api/oauth/[...path].js')
  const chunks = reqInit.raw != null ? [Buffer.from(reqInit.raw)] : []
  const req = {
    method: reqInit.method || 'GET',
    url: reqInit.url,
    body: reqInit.body,
    headers: { host: 'www.tubeops.pro', 'x-forwarded-proto': 'https', ...(reqInit.headers || {}) },
    query: {},
    async *[Symbol.asyncIterator]() { for (const c of chunks) yield c },
  }
  const res = {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(k, v) { this.headers[k.toLowerCase()] = v },
    getHeader(k) { return this.headers[k.toLowerCase()] },
    end(b) { this.body = b || '' },
  }
  await handler(req, res)
  let json = null
  try { json = JSON.parse(res.body) } catch (_) {}
  return { status: res.statusCode, headers: res.headers, json, body: res.body }
}

test('a malformed token body is a 400, not a crash', async () => {
  const bad = await oauthCall({
    method: 'POST',
    url: '/oauth/token',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    raw: 'grant_type=authorization_code&code=%E0%A4%A',
  })
  assert.equal(bad.status, 400)
  assert.equal(bad.json.error, 'invalid_request')
})

test('register rejects a bad redirect with invalid_redirect_uri', async () => {
  const r = await oauthCall({
    method: 'POST',
    url: '/oauth/register',
    headers: { 'content-type': 'application/json' },
    body: { client_name: 'x', redirect_uris: ['https://evil.test/cb'] },
  })
  assert.equal(r.status, 400)
  assert.equal(r.json.error, 'invalid_redirect_uri')
})

test('authorize with an unregistered redirect shows a page instead of redirecting', async () => {
  const prev = process.env.YOUTUBE_TOKEN_SECRET
  process.env.YOUTUBE_TOKEN_SECRET = env.YOUTUBE_TOKEN_SECRET
  try {
    const { client_id } = registerClient({ redirect_uris: ['https://claude.ai/cb'] })
    const q = new URLSearchParams({ client_id, redirect_uri: 'https://evil.test/cb', response_type: 'token', state: 's' })
    const r = await oauthCall({ url: '/oauth/authorize?' + q })
    assert.equal(r.status, 400)
    assert.equal(r.headers.location, undefined)
    assert.match(String(r.headers['content-type']), /text\/html/)
  } finally {
    if (prev === undefined) delete process.env.YOUTUBE_TOKEN_SECRET
    else process.env.YOUTUBE_TOKEN_SECRET = prev
  }
})

test('a refresh token only works for the client it was issued to', async () => {
  const prev = process.env.YOUTUBE_TOKEN_SECRET
  process.env.YOUTUBE_TOKEN_SECRET = env.YOUTUBE_TOKEN_SECRET
  try {
    const rt = issueRefreshToken({ refresh: 'rt', clientId: 'client-a', resource: 'r' })
    const r = await oauthCall({
      method: 'POST',
      url: '/oauth/token',
      headers: { 'content-type': 'application/json' },
      body: { grant_type: 'refresh_token', refresh_token: rt, client_id: 'client-b' },
    })
    assert.equal(r.status, 400)
    assert.equal(r.json.error, 'invalid_grant')
  } finally {
    if (prev === undefined) delete process.env.YOUTUBE_TOKEN_SECRET
    else process.env.YOUTUBE_TOKEN_SECRET = prev
  }
})

test('the connector page only follows an http(s) redirect from the server', () => {
  const html = readFileSync(new URL('../auth.html', import.meta.url), 'utf8')
  assert.doesNotMatch(html, /location\.replace\(data\.redirect\)/)
  assert.match(html, /dest\.protocol !== 'https:' && dest\.protocol !== 'http:'/)
})
