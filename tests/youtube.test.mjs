import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  clampMaxResults,
  decryptRecord,
  encryptRecord,
  googleAuthUrl,
  isYoutubeSidecarName,
  mapPlaylistItems,
  mcpInitializeResult,
  MCP_PROTOCOL,
  mcpTools,
  normalizePrivacy,
  parseMcpToolArgs,
  publicVideo,
  publicYoutubeStatus,
  runMcpTool,
  signPayload,
  verifyPayload,
  youtubeConfigured,
  youtubeDedicatedOAuth,
  youtubeRedirectUri,
  supabaseGoogleYoutubeUrl,
  youtubeApiSubpath,
  SIGNIN_GOOGLE_CLIENT_ID,
  YT_OAUTH_FILENAME,
  YT_SCOPES,
} from '../lib/youtube.js'
import { isHistorySidecarName } from '../lib/image-gen.js'
import { mcpConfigJson, claudeDesktopMcpConfigJson, claudeCodeMcpConfigJson } from '../lib/youtube-client.js'

const env = {
  GOOGLE_YOUTUBE_CLIENT_ID: 'cid.apps.googleusercontent.com',
  GOOGLE_YOUTUBE_CLIENT_SECRET: 'csecret',
  YOUTUBE_TOKEN_SECRET: 'unit-test-token-secret',
}

test('YouTube Connect can reuse Google sign-in OAuth', () => {
  assert.equal(youtubeDedicatedOAuth({}), false)
  assert.equal(youtubeConfigured({}), true)
  assert.equal(youtubeDedicatedOAuth(env), true)
  assert.equal(youtubeConfigured({ YOUTUBE_OAUTH: '0' }), false)
  const url = supabaseGoogleYoutubeUrl('https://www.vidso.pro/video-generation')
  const u = new URL(url)
  assert.equal(u.origin + u.pathname, 'https://ymtmgpgcmrazqeklixwf.supabase.co/auth/v1/authorize')
  assert.equal(u.searchParams.get('provider'), 'google')
  assert.ok(u.searchParams.get('scopes').includes('youtube.upload'))
  assert.ok(SIGNIN_GOOGLE_CLIENT_ID.endsWith('.apps.googleusercontent.com'))
})

test('YouTube API subpath is read from the URL when Vercel omits query.path', () => {
  assert.equal(youtubeApiSubpath({ query: { path: 'connect' } }), 'connect')
  assert.equal(youtubeApiSubpath({ query: { path: ['mcp'] } }), 'mcp')
  assert.equal(youtubeApiSubpath({ url: '/api/youtube/connect' }), 'connect')
  assert.equal(youtubeApiSubpath({ url: '/api/youtube/status?x=1' }), 'status')
  assert.equal(youtubeApiSubpath({ url: '/mcp' }), 'mcp')
  assert.equal(youtubeApiSubpath({ url: '/api/youtube/import' }), 'import')
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
  assert.equal(st.mcpUrl, 'https://vidso.pro/mcp')
  assert.equal(dump.includes('secret'), false)
  assert.equal(dump.includes('refresh'), false)
})

test('google auth URL asks for offline consent and channel manage scope', () => {
  const url = googleAuthUrl({
    clientId: env.GOOGLE_YOUTUBE_CLIENT_ID,
    redirectUri: 'https://vidso.pro/api/youtube/callback',
    state: 'abc',
  })
  const u = new URL(url)
  const scope = u.searchParams.get('scope')
  const scopes = scope.split(' ')
  assert.equal(u.searchParams.get('access_type'), 'offline')
  assert.equal(u.searchParams.get('prompt'), 'consent')
  assert.equal(scope, YT_SCOPES)
  assert.equal(scopes.includes('https://www.googleapis.com/auth/youtube.upload'), true)
  assert.equal(scopes.includes('https://www.googleapis.com/auth/youtube'), true)
})

test('redirect URI prefers env then canonical production host', () => {
  assert.equal(
    youtubeRedirectUri({ headers: {} }, { YOUTUBE_REDIRECT_URI: 'https://vidso.pro/api/youtube/callback' }),
    'https://vidso.pro/api/youtube/callback',
  )
  assert.equal(
    youtubeRedirectUri({ headers: { host: 'localhost:3000', 'x-forwarded-proto': 'http' } }, {}),
    'http://localhost:3000/api/youtube/callback',
  )
  assert.equal(
    youtubeRedirectUri({ headers: { host: 'vidso.pro', 'x-forwarded-proto': 'https' } }, {}),
    'https://www.vidso.pro/api/youtube/callback',
  )
  assert.equal(
    youtubeRedirectUri({ headers: { host: 'www.vidso.pro', 'x-forwarded-proto': 'https' } }, {}),
    'https://www.vidso.pro/api/youtube/callback',
  )
})

test('privacy falls back to unlisted', () => {
  assert.equal(normalizePrivacy('public'), 'public')
  assert.equal(normalizePrivacy('weird'), 'unlisted')
})

test('oauth sidecar is hidden from My Files', () => {
  assert.equal(isYoutubeSidecarName(YT_OAUTH_FILENAME), true)
  assert.equal(isHistorySidecarName(YT_OAUTH_FILENAME), true)
  assert.equal(isHistorySidecarName('Thumbnail-demo-abcd.jpg'), false)
})

test('MCP tool list covers channel inspect upload and update', () => {
  const names = mcpTools().map((t) => t.name)
  assert.deepEqual(names, [
    'youtube_status',
    'youtube_connect_url',
    'youtube_list_videos',
    'youtube_get_video',
    'youtube_update_video',
    'youtube_upload',
  ])
  const init = mcpInitializeResult()
  assert.equal(init.protocolVersion, MCP_PROTOCOL)
  assert.equal(init.serverInfo.name, 'vidso-youtube')
  assert.ok(init.instructions.includes('youtube_status'))
})

test('MCP tool arguments accept objects or JSON strings', () => {
  assert.deepEqual(parseMcpToolArgs({ arguments: { video_id: 'abc' } }), { video_id: 'abc' })
  assert.deepEqual(parseMcpToolArgs({ arguments: '{"title":"Oak Ridge"}' }), { title: 'Oak Ridge' })
  assert.deepEqual(parseMcpToolArgs({ arguments: 'not-json' }), {})
  assert.deepEqual(parseMcpToolArgs({}), {})
})

test('playlist and video mappers stay public-safe', () => {
  assert.equal(clampMaxResults(100), 25)
  assert.equal(clampMaxResults('nope'), 10)
  const videos = mapPlaylistItems([
    {
      contentDetails: { videoId: 'vid1' },
      snippet: { title: 'Tiger 1', description: 'x'.repeat(400), publishedAt: '2026-01-01T00:00:00Z' },
    },
    { snippet: { title: 'missing id' } },
  ])
  assert.equal(videos.length, 1)
  assert.equal(videos[0].videoId, 'vid1')
  assert.equal(videos[0].url, 'https://www.youtube.com/watch?v=vid1')
  assert.equal(videos[0].description.length, 280)
  const video = publicVideo({
    id: 'vid1',
    snippet: { title: 'Tiger 1', description: 'hello', tags: ['vidso'], categoryId: '22' },
    status: { privacyStatus: 'unlisted' },
    statistics: { viewCount: '3' },
    contentDetails: { duration: 'PT4M13S' },
  })
  assert.equal(video.studioUrl, 'https://studio.youtube.com/video/vid1/edit')
  assert.equal(video.privacy, 'unlisted')
  assert.equal(publicVideo(null), null)
})

test('unknown MCP tool is rejected without calling YouTube', async () => {
  await assert.rejects(
    () => runMcpTool('youtube_hack', {}, { token: 'tok', req: { headers: {} } }),
    (err) => err.code === -32601,
  )
  const connect = await runMcpTool('youtube_connect_url', {}, {
    token: 'tok',
    req: { headers: { host: 'vidso.pro', 'x-forwarded-proto': 'https' } },
  })
  assert.equal(connect.isError, undefined)
  assert.match(connect.content[0].text, /vidso\.pro\/video-generation\?youtube=connect/)
})

test('MCP config JSON points at the Vidso YouTube server', () => {
  const json = JSON.parse(mcpConfigJson('https://vidso.pro/api/youtube/mcp', 'tok_123'))
  assert.equal(json.mcpServers['vidso-youtube'].url, 'https://vidso.pro/api/youtube/mcp')
  assert.equal(json.mcpServers['vidso-youtube'].headers.Authorization, 'Bearer tok_123')
  assert.ok(json.mcpServers['vidso-youtube'].headers.Accept.includes('application/json'))
})

test('Claude Desktop MCP uses mcp-remote so stdio can reach the HTTP server', () => {
  const json = JSON.parse(claudeDesktopMcpConfigJson('https://vidso.pro/api/youtube/mcp', 'tok_123'))
  const srv = json.mcpServers['vidso-youtube']
  assert.equal(srv.command, 'npx')
  assert.ok(srv.args.includes('mcp-remote'))
  assert.ok(srv.args.includes('https://vidso.pro/api/youtube/mcp'))
  assert.equal(srv.env.VIDSO_AUTH, 'Bearer tok_123')
})

test('Claude Code MCP uses streamable HTTP with a Bearer header', () => {
  const json = JSON.parse(claudeCodeMcpConfigJson('https://vidso.pro/api/youtube/mcp', 'tok_123'))
  const srv = json.mcpServers['vidso-youtube']
  assert.equal(srv.type, 'http')
  assert.equal(srv.url, 'https://vidso.pro/api/youtube/mcp')
  assert.equal(srv.headers.Authorization, 'Bearer tok_123')
})

test('MCP initialize accepts Claude protocol versions', () => {
  assert.equal(mcpInitializeResult('2025-06-18').protocolVersion, '2025-06-18')
  assert.equal(mcpInitializeResult('2025-03-26').protocolVersion, '2025-03-26')
  assert.equal(mcpInitializeResult('nope').protocolVersion, MCP_PROTOCOL)
})
