import { test } from 'node:test'
import assert from 'node:assert/strict'
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

test('protected resource metadata names Vidso YouTube and the authorization server', () => {
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

test('OAuth access tokens unwrap to the Vidso JWT; raw JWTs still pass through', () => {
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
