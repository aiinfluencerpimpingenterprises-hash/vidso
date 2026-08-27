import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  decryptRecord,
  encryptRecord,
  googleAuthUrl,
  isYoutubeSidecarName,
  mcpTools,
  normalizePrivacy,
  publicYoutubeStatus,
  signPayload,
  verifyPayload,
  youtubeConfigured,
  youtubeOauthVerified,
  youtubeRedirectUri,
  YT_OAUTH_FILENAME,
  YT_SCOPES,
} from '../lib/youtube.js'
import { isHistorySidecarName } from '../lib/image-gen.js'
import { mcpConfigJson } from '../lib/youtube-client.js'
import { publicMcpTools, VERIFIED_MCP_CLIENTS } from '../lib/mcp-registry.js'
import { YT_DAILY_UPLOAD_CAP, isYoutubeQuotaError, publicQuotaView, youtubeQuotaDay } from '../lib/youtube-uploads.js'

const env = {
  GOOGLE_YOUTUBE_CLIENT_ID: 'cid.apps.googleusercontent.com',
  GOOGLE_YOUTUBE_CLIENT_SECRET: 'csecret',
  YOUTUBE_TOKEN_SECRET: 'unit-test-token-secret',
}

test('youtubeConfigured requires both Google client values', () => {
  assert.equal(youtubeConfigured({}), false)
  assert.equal(youtubeConfigured({ GOOGLE_YOUTUBE_CLIENT_ID: 'x' }), false)
  assert.equal(youtubeConfigured(env), true)
})

test('OAuth state round-trips and expires', () => {
  const token = signPayload({ u: 'user-1', exp: Date.now() + 60000 }, env)
  const got = verifyPayload(token, env)
  assert.equal(got.u, 'user-1')
  assert.throws(() => verifyPayload(token + 'x', env))
  const stale = signPayload({ u: 'user-1', exp: Date.now() - 1000 }, env)
  assert.throws(() => verifyPayload(stale, env))
})

test('token records encrypt and decrypt', () => {
  const rec = { refresh_token: 'rt', channel_id: 'UC123', auto_upload: true, privacy: 'unlisted' }
  const wrapped = encryptRecord(rec, env)
  assert.equal(wrapped.v, 1)
  assert.ok(wrapped.data)
  assert.equal(wrapped.refresh_token, undefined)
  assert.deepEqual(decryptRecord(wrapped, env), rec)
})

test('public status never includes tokens', () => {
  const st = publicYoutubeStatus({
    refresh_token: 'secret',
    access_token: 'secret2',
    channel_id: 'UCabc',
    channel_title: 'Faceless Lab',
    auto_upload: true,
    privacy: 'private',
  }, { headers: { host: 'vidso.pro', 'x-forwarded-proto': 'https' } }, { configured: true })
  const dump = JSON.stringify(st)
  assert.equal(st.connected, true)
  assert.equal(st.channel.title, 'Faceless Lab')
  assert.equal(st.privacy, 'private')
  assert.equal(st.mcpUrl, 'https://vidso.pro/api/mcp')
  assert.equal(dump.includes('secret'), false)
  assert.equal(dump.includes('refresh'), false)
})

test('google auth URL asks for offline consent and upload scope', () => {
  const url = googleAuthUrl({
    clientId: env.GOOGLE_YOUTUBE_CLIENT_ID,
    redirectUri: 'https://vidso.pro/api/youtube/callback',
    state: 'abc',
  })
  const u = new URL(url)
  assert.equal(u.searchParams.get('access_type'), 'offline')
  assert.equal(u.searchParams.get('prompt'), 'consent')
  assert.ok(u.searchParams.get('scope').includes('youtube.upload'))
  assert.equal(YT_SCOPES.includes('youtube.readonly'), true)
})

test('redirect URI prefers env then request host', () => {
  assert.equal(
    youtubeRedirectUri({ headers: {} }, { YOUTUBE_REDIRECT_URI: 'https://vidso.pro/api/youtube/callback' }),
    'https://vidso.pro/api/youtube/callback',
  )
  assert.equal(
    youtubeRedirectUri({ headers: { host: 'localhost:3000', 'x-forwarded-proto': 'http' } }, {}),
    'http://localhost:3000/api/youtube/callback',
  )
})

test('privacy falls back to unlisted', () => {
  assert.equal(normalizePrivacy('public'), 'public')
  assert.equal(normalizePrivacy('weird'), 'unlisted')
})

test('oauth sidecar is hidden from My Files', () => {
  assert.equal(isYoutubeSidecarName(YT_OAUTH_FILENAME), true)
  assert.equal(isHistorySidecarName(YT_OAUTH_FILENAME), true)
  assert.equal(isHistorySidecarName('vidso-mcp.json'), true)
  assert.equal(isHistorySidecarName('Thumbnail-demo-abcd.jpg'), false)
})

test('MCP tool list covers status connect and upload', () => {
  const names = mcpTools().map((t) => t.name)
  assert.deepEqual(names, ['youtube_status', 'youtube_connect_url', 'youtube_upload'])
})

test('MCP config JSON points at the Vidso MCP server', () => {
  const json = JSON.parse(mcpConfigJson('https://vidso.pro/api/mcp', 'tok_123'))
  assert.equal(json.mcpServers.vidso.url, 'https://vidso.pro/api/mcp')
  assert.equal(json.mcpServers.vidso.headers.Authorization, 'Bearer tok_123')
})

test('live MCP catalog matches youtube tools and lists no unverified clients', () => {
  assert.deepEqual(publicMcpTools().map((t) => t.name), mcpTools().map((t) => t.name))
  assert.deepEqual(VERIFIED_MCP_CLIENTS, [])
})

test('YouTube daily cap is the default Data API upload budget', () => {
  assert.equal(YT_DAILY_UPLOAD_CAP, 6)
  assert.equal(youtubeQuotaDay(new Date('2026-08-27T18:00:00Z')).length, 10)
  const view = publicQuotaView([{ quotaDay: youtubeQuotaDay(), status: 'published' }])
  assert.equal(view.platformRemainingUnknown, true)
  assert.equal(view.dailyCap, 6)
})

test('quota errors are detected from Google messages', () => {
  assert.equal(isYoutubeQuotaError({ message: 'quotaExceeded' }), true)
  assert.equal(isYoutubeQuotaError({ message: 'not found' }), false)
})

test('new connections do not treat auto-upload as on by default', () => {
  const st = publicYoutubeStatus({
    refresh_token: 'x',
    channel_id: 'UC1',
  }, { headers: { host: 'vidso.pro', 'x-forwarded-proto': 'https' } })
  assert.equal(st.autoUpload, false)
})

test('OAuth published flag is off unless env says otherwise', () => {
  assert.equal(youtubeOauthVerified({}), false)
  assert.equal(youtubeOauthVerified({ YOUTUBE_OAUTH_VERIFIED: 'true' }), true)
})
