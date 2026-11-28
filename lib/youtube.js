/** YouTube Data API helpers for TubeOps. Server-only (Node crypto + Railway token store).
 *
 * Env (Vercel), optional when reusing Google sign-in:
 *   GOOGLE_YOUTUBE_CLIENT_ID
 *   GOOGLE_YOUTUBE_CLIENT_SECRET
 *   YOUTUBE_TOKEN_SECRET          optional; defaults to the client secret
 *   YOUTUBE_REDIRECT_URI          optional; defaults to {origin}/api/youtube/callback
 *
 * If those are unset, Connect YouTube reuses the same Google OAuth client as
 * TubeOps sign-in (Supabase).
 */

import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual as tse } from 'node:crypto'
import { fetchJsonUrl, railwayDelete, railwayList, railwayUpload } from './railway-files.js'
import { safeFetch } from './safe-fetch.js'
import { runVidsoMcpTool, vidsoMcpTools, VIDSO_MCP_INSTRUCTIONS } from './vidso-mcp.js'

export const YT_OAUTH_FILENAME = 'vidso-yt-oauth.json'
export const YT_BRIDGE_COOKIE = 'vidso_yt_bridge'
export const YT_SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube',
].join(' ')
export const MCP_PROTOCOL = '2025-03-26'
export const MCP_PROTOCOLS = ['2025-06-18', '2025-03-26']
export const YT_PRIVACY = ['unlisted', 'private', 'public']
export const YT_MAX_SERVER_BYTES = 96 * 1024 * 1024
export const SUPABASE_AUTH_URL = 'https://ymtmgpgcmrazqeklixwf.supabase.co'
export const SIGNIN_GOOGLE_CLIENT_ID = '715298595148-v01b90t5fvsjeqsbcvme9u69318a89gj.apps.googleusercontent.com'
const YT_RECORD_SECRET_FALLBACK = 'vidso-yt-record-v1'
export const YT_RECONNECT_MESSAGE = 'Your YouTube connection expired. Connect your channel again.'

/** Google refused the saved grant (expired or revoked): only connecting again fixes it. */
export function youtubeReconnectError(message = YT_RECONNECT_MESSAGE) {
  const err = new Error(message)
  err.status = 401
  err.code = 'reconnect'
  return err
}

const UPSTREAM = process.env.UPSTREAM_API || 'https://vibrant-patience-production-a7f0.up.railway.app'

/**
 * The key for signing and sealing (OAuth codes and tokens, connect tickets, refund handles, stored
 * YouTube records). It must never be a value from this file: the source is public. Set
 * YOUTUBE_TOKEN_SECRET; until then it is derived from a server-only secret that is always set
 * (the fal key, else the gate secret or Supabase service key). The built-in constant is for
 * local development only.
 */
function serverOnlySecret(env) {
  const base = String(env.FAL_KEY || env.FAL_API_KEY || env.TUBEOPS_GATE_SECRET || env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  return base ? createHash('sha256').update('tubeops-token-secret-v2\u0000').update(base).digest('base64url') : ''
}
const isProductionEnv = (env) => env.VERCEL_ENV === 'production' || env.NODE_ENV === 'production'

export function youtubeSecrets(env = process.env) {
  const clientId = String(env.GOOGLE_YOUTUBE_CLIENT_ID || SIGNIN_GOOGLE_CLIENT_ID).trim()
  const clientSecret = String(env.GOOGLE_YOUTUBE_CLIENT_SECRET || '').trim()
  const tokenSecret = String(env.YOUTUBE_TOKEN_SECRET || clientSecret || serverOnlySecret(env) || (isProductionEnv(env) ? '' : YT_RECORD_SECRET_FALLBACK)).trim()
  return { clientId, clientSecret, tokenSecret }
}

export function youtubeDedicatedOAuth(env = process.env) {
  return !!(String(env.GOOGLE_YOUTUBE_CLIENT_ID || '').trim() && String(env.GOOGLE_YOUTUBE_CLIENT_SECRET || '').trim())
}

export function youtubeConfigured(env = process.env) {
  return youtubeDedicatedOAuth(env) || String(env.YOUTUBE_OAUTH || '').trim() !== '0'
}

export function supabaseGoogleYoutubeUrl(redirectTo, env = process.env) {
  const base = String(env.SUPABASE_URL || SUPABASE_AUTH_URL).replace(/\/$/, '')
  const u = new URL(base + '/auth/v1/authorize')
  u.searchParams.set('provider', 'google')
  u.searchParams.set('scopes', 'email profile ' + YT_SCOPES)
  u.searchParams.set('redirect_to', String(redirectTo || ''))
  // Already-signed-in Google users otherwise bounce with a TubeOps session and
  // no provider_token, which looks like "Google did not return YouTube access".
  u.searchParams.set('prompt', 'consent')
  u.searchParams.set('access_type', 'offline')
  u.searchParams.set('query_params[access_type]', 'offline')
  u.searchParams.set('query_params[prompt]', 'consent')
  u.searchParams.set('query_params[include_granted_scopes]', 'true')
  return u.toString()
}

const YT_CONNECT_MS = 15 * 60 * 1000

/** Google / Supabase URL the user's browser must open to attach a channel. */
export function buildYoutubeConnect({ token, req, returnTo, env = process.env }) {
  if (!youtubeConfigured(env)) {
    const err = new Error('YouTube publishing is turned off on this deployment.')
    err.status = 501
    throw err
  }
  const ret = String(returnTo || '/video-generation').slice(0, 160)
  if (youtubeDedicatedOAuth(env)) {
    const { clientId } = youtubeSecrets(env)
    const redirectUri = youtubeRedirectUri(req, env)
    const nonce = randomBytes(16).toString('base64url')
    // The bridge cookie carries the bearer token too, so it is sealed.
    const bridge = sealPayload({
      token,
      ret,
      n: nonce,
      exp: Date.now() + YT_CONNECT_MS,
    }, env)
    const url = googleAuthUrl({
      clientId,
      redirectUri,
      state: sealPayload({ n: nonce, exp: Date.now() + YT_CONNECT_MS }, env),
    })
    return { url, bridge, mode: 'dedicated' }
  }
  const { clientId } = youtubeSecrets(env)
  return {
    url: '',
    mode: 'gis',
    clientId,
    scopes: YT_SCOPES,
  }
}

// Sealed, not just signed: the ticket rides in a URL and carries the user's bearer token.
export function issueYoutubeConnectTicket({ token, returnTo, env = process.env }) {
  return sealPayload({
    typ: 'yt_connect',
    token: String(token || ''),
    ret: String(returnTo || '/video-generation').slice(0, 160),
    exp: Date.now() + YT_CONNECT_MS,
  }, env)
}

export function youtubeConnectStartUrl(origin, ticket) {
  return String(origin || '').replace(/\/+$/, '') + '/api/youtube/connect-start?ticket=' + encodeURIComponent(ticket)
}

export function readYoutubeConnectTicket(ticket, env = process.env) {
  const payload = openPayload(ticket, env)
  if (payload.typ !== 'yt_connect' || !payload.token) throw new Error('Invalid YouTube connect ticket')
  return payload
}

export const YT_PROD_REDIRECT = 'https://www.tubeops.pro/api/youtube/callback'

export function youtubeApiSubpath(req) {
  const fromQuery = [].concat(req?.query?.path || []).filter(Boolean).join('/')
  if (fromQuery) return fromQuery.replace(/\/+$/, '')
  const pathOnly = String(req?.url || '').split('?')[0]
  if (pathOnly === '/mcp' || pathOnly.startsWith('/mcp/')) return 'mcp'
  const m = pathOnly.match(/\/api\/youtube\/?(.*)$/i)
  return String(m?.[1] || '').replace(/\/+$/, '')
}

export function requestOrigin(req) {
  const xfHost = String(req?.headers?.['x-forwarded-host'] || '').split(',')[0].trim()
  const host = xfHost || String(req?.headers?.host || 'www.tubeops.pro').split(',')[0].trim()
  const proto = String(req?.headers?.['x-forwarded-proto'] || 'https').split(',')[0].trim()
  return proto + '://' + host
}

export function youtubeRedirectUri(req, env = process.env) {
  const explicit = String(env.YOUTUBE_REDIRECT_URI || '').trim()
  if (explicit) return explicit
  const host = String(req?.headers?.['x-forwarded-host'] || req?.headers?.host || '').split(',')[0].trim().toLowerCase()
  if (!host || host === 'vidso.pro' || host === 'www.vidso.pro') return YT_PROD_REDIRECT
  return requestOrigin(req) + '/api/youtube/callback'
}

export function normalizePrivacy(value) {
  const v = String(value || '').toLowerCase()
  // Nothing chosen means private: a video never goes public by default.
  return YT_PRIVACY.includes(v) ? v : 'private'
}

export function isYoutubeSidecarName(name) {
  const n = String(name || '')
  return n === YT_OAUTH_FILENAME || n.startsWith('vidso-yt-')
}

function keyBuf(env = process.env) {
  const { tokenSecret } = youtubeSecrets(env)
  if (!tokenSecret) throw new Error('YouTube token secret is not configured')
  return createHash('sha256').update(tokenSecret).digest()
}

export function signPayload(payload, env = process.env) {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const sig = createHmac('sha256', keyBuf(env)).update(body).digest('base64url')
  return body + '.' + sig
}

export function verifyPayload(token, env = process.env) {
  const raw = String(token || '')
  const dot = raw.lastIndexOf('.')
  if (dot < 1) throw new Error('Invalid signed payload')
  const body = raw.slice(0, dot)
  const sig = raw.slice(dot + 1)
  const expected = createHmac('sha256', keyBuf(env)).update(body).digest('base64url')
  if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) {
    throw new Error('Invalid signed payload')
  }
  const json = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  if (json.exp && Number(json.exp) < Date.now()) throw new Error('Signed payload expired')
  return json
}

// Sealed payloads: AES-256-GCM, so the contents (bearer tokens) can't be read
// by whoever sees the string. The key is derived with its own label, so it is
// never the same key as the HMAC in signPayload.
const SEAL_PREFIX = 'tos1.'

function sealKey(env = process.env) {
  const { tokenSecret } = youtubeSecrets(env)
  if (!tokenSecret) throw new Error('YouTube token secret is not configured')
  return createHash('sha256').update('tubeops-seal-v1\u0000').update(tokenSecret).digest()
}

export function isSealedPayload(token) {
  return String(token || '').startsWith(SEAL_PREFIX)
}

export function sealPayload(payload, env = process.env) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', sealKey(env), iv)
  const data = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()])
  return SEAL_PREFIX + Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64url')
}

export function openPayload(token, env = process.env) {
  const raw = String(token || '')
  if (!raw.startsWith(SEAL_PREFIX)) throw new Error('Invalid sealed payload')
  const buf = Buffer.from(raw.slice(SEAL_PREFIX.length), 'base64url')
  if (buf.length < 29) throw new Error('Invalid sealed payload')
  let json
  try {
    const decipher = createDecipheriv('aes-256-gcm', sealKey(env), buf.subarray(0, 12))
    decipher.setAuthTag(buf.subarray(12, 28))
    json = JSON.parse(Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString('utf8'))
  } catch {
    throw new Error('Invalid sealed payload')
  }
  if (!json || typeof json !== 'object') throw new Error('Invalid sealed payload')
  if (json.exp && Number(json.exp) < Date.now()) throw new Error('Sealed payload expired')
  return json
}

function timingSafeEqual(a, b) {
  const left = Buffer.from(String(a))
  const right = Buffer.from(String(b))
  if (left.length !== right.length) return false
  return tse(left, right)
}

export function encryptRecord(record, env = process.env) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', keyBuf(env), iv)
  const pt = Buffer.from(JSON.stringify(record), 'utf8')
  const data = Buffer.concat([cipher.update(pt), cipher.final()])
  const tag = cipher.getAuthTag()
  return {
    v: 1,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: data.toString('base64'),
  }
}

export function decryptRecord(payload, env = process.env) {
  if (!payload || typeof payload !== 'object') throw new Error('Missing YouTube credentials')
  if (payload.refresh_token && !payload.data) return payload
  const iv = Buffer.from(String(payload.iv || ''), 'base64')
  const tag = Buffer.from(String(payload.tag || ''), 'base64')
  const data = Buffer.from(String(payload.data || ''), 'base64')
  const open = (key) => {
    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(tag)
    return JSON.parse(Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8'))
  }
  try { return open(keyBuf(env)) } catch (e) {
    // Records saved before the key moved off the public constant still open (read only); the next save re-encrypts them.
    try { return open(createHash('sha256').update(YT_RECORD_SECRET_FALLBACK).digest()) } catch (_) { throw e }
  }
}

/** True when we can mint or reuse a YouTube access token for upload. */
export function youtubeRecordCanUpload(record, now = Date.now()) {
  if (!record?.channel_id) return false
  // Google already refused this grant; don't offer it until the user connects again.
  if (record.needs_reconnect) return false
  if (record.refresh_token) return true
  const exp = Number(record.expiry || 0)
  return !!(record.access_token && (exp === 0 || exp > now + 15_000))
}

export function publicYoutubeStatus(record, req, extra = {}) {
  const origin = requestOrigin(req)
  const connected = youtubeRecordCanUpload(record)
  return {
    configured: extra.configured !== false,
    connected,
    channel: connected
      ? {
        id: record.channel_id,
        title: record.channel_title || 'YouTube channel',
        thumb: record.channel_thumb || '',
      }
      : null,
    // Off unless the user turned it on.
    autoUpload: connected ? record.auto_upload === true : false,
    // A channel we had but can't use any more: the app should ask to connect again.
    // Read from the record only, so status never calls Google.
    needsReconnect: !connected && !!record?.channel_id,
    privacy: normalizePrivacy(record?.privacy),
    mcpUrl: origin + '/mcp',
    ...extra,
  }
}

export function parseCookies(req) {
  const raw = String(req?.headers?.cookie || '')
  const out = {}
  for (const part of raw.split(';')) {
    const i = part.indexOf('=')
    if (i < 0) continue
    const k = part.slice(0, i).trim()
    if (!k) continue
    try { out[k] = decodeURIComponent(part.slice(i + 1).trim()) } catch { out[k] = part.slice(i + 1).trim() }
  }
  return out
}

export function bridgeCookieHeader(value, { clear = false } = {}) {
  if (clear) return YT_BRIDGE_COOKIE + '=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'
  return [
    YT_BRIDGE_COOKIE + '=' + encodeURIComponent(value),
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=900',
    'Secure',
  ].join('; ')
}

export function googleAuthUrl({ clientId, redirectUri, state }) {
  const u = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  u.searchParams.set('client_id', clientId)
  u.searchParams.set('redirect_uri', redirectUri)
  u.searchParams.set('response_type', 'code')
  u.searchParams.set('scope', YT_SCOPES)
  u.searchParams.set('access_type', 'offline')
  u.searchParams.set('prompt', 'consent')
  u.searchParams.set('include_granted_scopes', 'true')
  u.searchParams.set('state', state)
  return u.toString()
}

function googleError(data, fallback) {
  const msg = data?.error_description || data?.error?.message || data?.error || fallback
  const err = new Error(String(msg).slice(0, 280))
  err.body = data
  return err
}

export async function exchangeGoogleCode({ code, redirectUri, env = process.env }) {
  const { clientId, clientSecret } = youtubeSecrets(env)
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw googleError(data, 'Could not connect YouTube')
  return data
}

export async function refreshGoogleAccess(refreshToken, env = process.env) {
  const { clientId, clientSecret } = youtubeSecrets(env)
  if (!clientSecret) {
    throw new Error('Add GOOGLE_YOUTUBE_CLIENT_SECRET on Vercel using the same Google sign-in client secret from Supabase, then reconnect YouTube.')
  }
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (String(data?.error || '') === 'invalid_grant') throw youtubeReconnectError()
    throw googleError(data, 'Could not refresh YouTube access')
  }
  return data
}

export async function fetchYoutubeChannel(accessToken) {
  const res = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
    headers: { Authorization: 'Bearer ' + accessToken },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw googleError(data, 'Could not read YouTube channel')
  const item = Array.isArray(data.items) ? data.items[0] : null
  if (!item?.id) throw new Error('No YouTube channel on this Google account')
  const sn = item.snippet || {}
  const thumbs = sn.thumbnails || {}
  const thumb = thumbs.default?.url || thumbs.medium?.url || thumbs.high?.url || ''
  return { id: item.id, title: sn.title || 'YouTube channel', thumb }
}

export async function youtubeApi(accessToken, pathAndQuery, { method = 'GET', body } = {}) {
  const url = 'https://www.googleapis.com/youtube/v3/' + String(pathAndQuery || '').replace(/^\//, '')
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: 'Bearer ' + accessToken,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw googleError(data, 'YouTube request failed')
  return data
}

export function clampMaxResults(n, fallback = 10, max = 25) {
  const x = Number(n)
  if (!Number.isFinite(x)) return fallback
  return Math.min(max, Math.max(1, Math.round(x)))
}

export function mapPlaylistItems(items) {
  return (Array.isArray(items) ? items : []).map((it) => {
    const videoId = it?.contentDetails?.videoId || it?.snippet?.resourceId?.videoId || ''
    const desc = String(it?.snippet?.description || '')
    return {
      videoId,
      title: it?.snippet?.title || '',
      publishedAt: it?.snippet?.publishedAt || '',
      description: desc.slice(0, 280),
      url: videoId ? 'https://www.youtube.com/watch?v=' + videoId : '',
    }
  }).filter((v) => v.videoId)
}

export function publicVideo(item) {
  if (!item?.id) return null
  return {
    videoId: item.id,
    title: item.snippet?.title || '',
    description: item.snippet?.description || '',
    tags: Array.isArray(item.snippet?.tags) ? item.snippet.tags : [],
    categoryId: item.snippet?.categoryId || '22',
    publishedAt: item.snippet?.publishedAt || '',
    privacy: item.status?.privacyStatus || '',
    duration: item.contentDetails?.duration || '',
    stats: item.statistics || {},
    url: 'https://www.youtube.com/watch?v=' + item.id,
    studioUrl: 'https://studio.youtube.com/video/' + item.id + '/edit',
  }
}

export async function listMyVideos(accessToken, maxResults) {
  const ch = await youtubeApi(accessToken, 'channels?part=snippet,contentDetails,statistics&mine=true')
  const item = Array.isArray(ch.items) ? ch.items[0] : null
  if (!item?.id) throw new Error('No YouTube channel on this Google account')
  const uploads = item.contentDetails?.relatedPlaylists?.uploads
  const playlist = uploads
    ? await youtubeApi(
      accessToken,
      'playlistItems?part=snippet,contentDetails&playlistId=' +
        encodeURIComponent(uploads) +
        '&maxResults=' + clampMaxResults(maxResults),
    )
    : { items: [] }
  return {
    channel: {
      id: item.id,
      title: item.snippet?.title || 'YouTube channel',
      customUrl: item.snippet?.customUrl || '',
      stats: item.statistics || {},
    },
    videos: mapPlaylistItems(playlist.items),
  }
}

export async function getVideo(accessToken, videoId) {
  const id = String(videoId || '').trim()
  if (!id) throw new Error('video_id is required')
  const data = await youtubeApi(
    accessToken,
    'videos?part=snippet,status,statistics,contentDetails&id=' + encodeURIComponent(id),
  )
  const item = Array.isArray(data.items) ? data.items[0] : null
  const video = publicVideo(item)
  if (!video) throw new Error('Video not found')
  return video
}

// Writable fields only: a PUT replaces snippet and status whole, so anything left out is wiped.
const SNIPPET_KEEP = ['title', 'description', 'tags', 'categoryId', 'defaultLanguage', 'defaultAudioLanguage']
const STATUS_KEEP = ['privacyStatus', 'publishAt', 'embeddable', 'license', 'publicStatsViewable', 'selfDeclaredMadeForKids', 'containsSyntheticMedia']

function pick(obj, keys) {
  const out = {}
  for (const k of keys) if (obj && obj[k] != null) out[k] = obj[k]
  return out
}

export async function updateVideo(accessToken, args = {}) {
  const videoId = String(args.video_id || args.videoId || '').trim()
  if (!videoId) throw new Error('video_id is required')
  const current = await youtubeApi(accessToken, 'videos?part=snippet,status&id=' + encodeURIComponent(videoId))
  const item = Array.isArray(current.items) ? current.items[0] : null
  if (!item?.id) throw new Error('Video not found')
  // Start from the video as it is, then apply only what was asked.
  const snippet = {
    ...pick(item.snippet, SNIPPET_KEEP),
    title: item.snippet?.title || 'TubeOps video',
    description: item.snippet?.description || '',
    tags: Array.isArray(item.snippet?.tags) ? item.snippet.tags : [],
    categoryId: item.snippet?.categoryId || '22',
  }
  if (args.title != null && String(args.title).trim()) snippet.title = sanitizeTitle(args.title)
  if (args.description != null) snippet.description = sanitizeDescription(args.description)
  if (Array.isArray(args.tags)) snippet.tags = sanitizeTags(args.tags)
  const status = { ...pick(item.status, STATUS_KEEP), privacyStatus: item.status?.privacyStatus || 'unlisted' }
  if (args.privacy) {
    status.privacyStatus = normalizePrivacy(args.privacy)
    // YouTube only accepts a scheduled publish time on a private video.
    if (status.privacyStatus !== 'private') delete status.publishAt
  }
  let data
  try {
    data = await youtubeApi(accessToken, 'videos?part=snippet,status', {
      method: 'PUT',
      body: { id: videoId, snippet, status },
    })
  } catch (e) {
    const msg = String(e.message || '')
    if (/insufficient|scope|forbidden/i.test(msg)) {
      throw new Error('Reconnect YouTube in TubeOps Account settings to allow video edits. ' + msg)
    }
    throw e
  }
  return publicVideo({ ...item, ...data, id: data.id || videoId, snippet: data.snippet || snippet, status: data.status || status }) || {
    videoId,
    title: snippet.title,
    description: snippet.description,
    tags: snippet.tags,
    privacy: status.privacyStatus,
    url: 'https://www.youtube.com/watch?v=' + videoId,
    studioUrl: 'https://studio.youtube.com/video/' + videoId + '/edit',
  }
}

export async function loadYoutubeRecord(token) {
  const files = await railwayList(token)
  const hit = files.find((f) => isYoutubeSidecarName(f.original_name || f.name))
  if (!hit?.url) return null
  const json = await fetchJsonUrl(hit.url)
  const rec = decryptRecord(json)
  rec._file_id = hit.id
  return rec
}

export async function loadYoutubeAccess(token) {
  const rec = await loadYoutubeRecord(token)
  if (!rec) return null
  try {
    const next = await ensureAccessToken(rec)
    if (next.access_token !== rec.access_token || next.expiry !== rec.expiry) {
      await saveYoutubeRecord(token, next)
    }
    return next
  } catch (e) {
    if (e?.code === 'reconnect' && e.status === 401) return markYoutubeNeedsReconnect(token, rec)
    return rec
  }
}

/** Remember that Google refused the grant, so status says "reconnect" without asking Google each time. */
export async function markYoutubeNeedsReconnect(token, rec) {
  if (!rec || rec.needs_reconnect) return rec
  rec.needs_reconnect = true
  rec.needs_reconnect_at = new Date().toISOString()
  try { return await saveYoutubeRecord(token, rec) } catch (_) { return rec }
}

/** A fresh connection replaces a refused one. */
export function clearYoutubeReconnect(rec) {
  if (rec) {
    delete rec.needs_reconnect
    delete rec.needs_reconnect_at
  }
  return rec
}

export async function requireYoutubeAccess(token) {
  const rec = await loadYoutubeRecord(token).catch(() => null)
  if (rec?.channel_id && rec.needs_reconnect) throw youtubeReconnectError()
  if (!youtubeRecordCanUpload(rec)) {
    const err = new Error('Connect a YouTube channel first')
    err.status = 409
    err.code = rec?.channel_id ? 'reconnect' : 'not_connected'
    throw err
  }
  let next
  try {
    next = await ensureAccessToken(rec)
  } catch (e) {
    if (e?.code === 'reconnect' && e.status === 401) await markYoutubeNeedsReconnect(token, rec)
    throw e
  }
  if (next.access_token !== rec.access_token || next.expiry !== rec.expiry) {
    await saveYoutubeRecord(token, next)
  }
  return next
}

export async function uploadYoutubeFromArgs(token, args = {}) {
  const rec = await requireYoutubeAccess(token)
  const file = await downloadRenderVideo(token, {
    renderJobId: args.renderJobId,
    videoUrl: args.video_url || args.videoUrl,
  })
  return youtubeResumableUpload({
    accessToken: rec.access_token,
    buffer: file.buffer,
    mime: file.mime,
    title: args.title,
    description: args.description,
    tags: args.tags,
    privacy: args.privacy || rec.privacy,
  })
}

export async function saveYoutubeFromGoogleTokens(token, body = {}) {
  const access = String(body.access_token || body.provider_token || '').trim()
  const refresh = String(body.refresh_token || body.provider_refresh_token || '').trim()
  if (!access) {
    const err = new Error('Google did not return a YouTube access token.')
    err.status = 400
    err.code = 'no_token'
    throw err
  }
  let rec = await loadYoutubeRecord(token).catch(() => null) || {}
  rec.access_token = access
  if (refresh) rec.refresh_token = refresh
  rec.expiry = Date.now() + Math.max(60, Number(body.expires_in || 3600) - 30) * 1000
  rec.source = refresh ? 'supabase-google' : 'google-gis'
  const channel = await fetchYoutubeChannel(access)
  rec.channel_id = channel.id
  rec.channel_title = channel.title
  rec.channel_thumb = channel.thumb
  rec.connected_at = new Date().toISOString()
  clearYoutubeReconnect(rec)
  if (rec.auto_upload == null) rec.auto_upload = false
  rec.privacy = normalizePrivacy(rec.privacy)
  return saveYoutubeRecord(token, rec)
}

export async function saveYoutubeRecord(token, record) {
  const prevId = record._file_id
  const stored = { ...record }
  delete stored._file_id
  const uploaded = await railwayUpload(token, {
    buffer: Buffer.from(JSON.stringify(encryptRecord(stored))),
    filename: YT_OAUTH_FILENAME,
    mime: 'application/json',
  })
  if (prevId && prevId !== uploaded.id) {
    try { await railwayDelete(token, prevId) } catch (_) {}
  }
  stored._file_id = uploaded.id
  return stored
}

export async function deleteYoutubeRecord(token, record) {
  if (record?._file_id) {
    try { await railwayDelete(token, record._file_id) } catch (_) {}
  }
  const files = await railwayList(token).catch(() => [])
  for (const f of files) {
    if (isYoutubeSidecarName(f.original_name || f.name) && f.id) {
      try { await railwayDelete(token, f.id) } catch (_) {}
    }
  }
}

export async function ensureAccessToken(record, env = process.env) {
  const exp = Number(record.expiry || 0)
  if (record.access_token && (!exp || exp > Date.now() + 60000)) return record
  if (!record.refresh_token) {
    const err = new Error('YouTube access expired. Connect YouTube again.')
    err.status = 409
    err.code = 'reconnect'
    throw err
  }
  const fresh = await refreshGoogleAccess(record.refresh_token, env)
  record.access_token = fresh.access_token
  record.expiry = Date.now() + Math.max(60, Number(fresh.expires_in || 3600) - 30) * 1000
  if (fresh.refresh_token) record.refresh_token = fresh.refresh_token
  return record
}

// YouTube rejects metadata with angle brackets in it.
function stripAngles(value) {
  return String(value ?? '').replace(/[<>]/g, '')
}

export const YT_TITLE_MAX = 100
export const YT_DESCRIPTION_MAX_BYTES = 5000
export const YT_TAGS_MAX_CHARS = 450
export const YT_DEFAULT_TAGS = ['tubeops']

/** At most 100 characters (code points, as YouTube counts), cut at a word boundary. */
export function sanitizeTitle(title) {
  const t = stripAngles(title).replace(/\s+/g, ' ').trim()
  if (!t) return 'TubeOps video'
  const chars = Array.from(t)
  if (chars.length <= YT_TITLE_MAX) return t
  const cut = chars.slice(0, YT_TITLE_MAX).join('')
  if (chars[YT_TITLE_MAX] === ' ') return cut.trim()
  const space = cut.lastIndexOf(' ')
  // One very long word: a hard cut beats a two-word title.
  return (space >= 40 ? cut.slice(0, space) : cut).trim()
}

/** At most 5000 UTF-8 bytes (YouTube's limit is bytes, not characters), never splitting a character. */
export function sanitizeDescription(description, fallback = '') {
  const d = stripAngles(description).trim() || fallback
  if (Buffer.byteLength(d, 'utf8') <= YT_DESCRIPTION_MAX_BYTES) return d
  let bytes = 0
  let out = ''
  for (const ch of d) {
    const n = Buffer.byteLength(ch, 'utf8')
    if (bytes + n > YT_DESCRIPTION_MAX_BYTES) break
    bytes += n
    out += ch
  }
  return out
}

/** Tags without empties or brackets, at most 450 characters in all as YouTube counts them. */
export function sanitizeTags(tags) {
  const out = []
  let total = 0
  for (const raw of Array.isArray(tags) ? tags : []) {
    const tag = stripAngles(raw).replace(/[\s,]+/g, ' ').trim()
    if (!tag || out.includes(tag)) continue
    // YouTube counts the comma between tags, and quotes around a tag with a space.
    const cost = Array.from(tag).length + (tag.includes(' ') ? 2 : 0) + (out.length ? 1 : 0)
    if (total + cost > YT_TAGS_MAX_CHARS) continue
    out.push(tag)
    total += cost
    if (out.length >= 15) break
  }
  return out
}

export async function youtubeResumableUpload({
  accessToken,
  buffer,
  mime = 'video/mp4',
  title,
  description,
  tags,
  privacy,
}) {
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)
  if (!bytes.length) throw new Error('Video file is empty')
  if (bytes.length > YT_MAX_SERVER_BYTES) {
    const err = new Error('This video is over ' + Math.round(YT_MAX_SERVER_BYTES / 1024 / 1024) + ' MB, too large to upload from the server.')
    err.status = 413
    err.code = 'too_large'
    throw err
  }
  const start = await fetch(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
    {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + accessToken,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': mime,
        'X-Upload-Content-Length': String(bytes.length),
      },
      body: JSON.stringify({
        snippet: {
          title: sanitizeTitle(title),
          description: sanitizeDescription(description, 'Uploaded with TubeOps'),
          tags: (() => { const clean = sanitizeTags(tags); return clean.length ? clean : YT_DEFAULT_TAGS })(),
          categoryId: '22',
        },
        status: {
          privacyStatus: normalizePrivacy(privacy),
          selfDeclaredMadeForKids: false,
        },
      }),
    },
  )
  const startData = await start.json().catch(() => ({}))
  if (!start.ok) throw googleError(startData, 'Could not start YouTube upload')
  const location = start.headers.get('location') || start.headers.get('Location')
  if (!location) throw new Error('YouTube did not return an upload URL')
  const put = await fetch(location, {
    method: 'PUT',
    headers: {
      Authorization: 'Bearer ' + accessToken,
      'Content-Type': mime,
      'Content-Length': String(bytes.length),
    },
    body: bytes,
  })
  const data = await put.json().catch(() => ({}))
  if (!put.ok) throw googleError(data, 'YouTube upload failed')
  const id = data.id
  return {
    videoId: id,
    url: id ? 'https://www.youtube.com/watch?v=' + id : '',
    studioUrl: id ? 'https://studio.youtube.com/video/' + id + '/edit' : '',
    title: data.snippet?.title || sanitizeTitle(title),
    privacy: data.status?.privacyStatus || normalizePrivacy(privacy),
  }
}

const DOWNLOAD_TIMEOUT_MS = 120000

/**
 * The finished MP4, read into memory for the upload. Only our own storage and
 * render hosts (lib/safe-fetch.js), and it stops reading the moment the file
 * passes the server upload limit.
 */
export async function downloadRenderVideo(token, { renderJobId, videoUrl }, { fetchImpl } = {}) {
  let url = String(videoUrl || '').trim()
  const headers = {}
  if (renderJobId) {
    url = UPSTREAM + '/api/faceless/render/' + encodeURIComponent(String(renderJobId)) + '/download'
    headers.Authorization = 'Bearer ' + token
  }
  if (!url || !/^https?:\/\//i.test(url)) throw new Error('Missing video URL')
  let got
  try {
    got = await safeFetch(url, { maxBytes: YT_MAX_SERVER_BYTES, timeoutMs: DOWNLOAD_TIMEOUT_MS, headers, ...(fetchImpl ? { fetchImpl } : {}) })
  } catch (e) {
    let err
    if (e.code === 'too_large') {
      err = new Error('This video is over ' + Math.round(YT_MAX_SERVER_BYTES / 1024 / 1024) + ' MB, too large to upload from the server.')
    } else if (e.code === 'host_not_allowed') {
      err = new Error('Only videos made or stored in TubeOps can be uploaded. Pass render_job_id, or a TubeOps file URL from files_list.')
    } else if (e.code === 'timeout') {
      err = new Error('Downloading the video took too long. Try again in a moment.')
    } else {
      err = new Error('Could not download the video')
    }
    err.status = e.status || 400
    err.code = e.code || 'fetch_failed'
    throw err
  }
  if (!got.ok) {
    let data = {}
    try { data = JSON.parse(got.buffer.toString('utf8')) } catch (_) {}
    const err = new Error(String(data.message || data.error || 'Could not download the video').slice(0, 280))
    err.status = got.status >= 400 && got.status < 500 ? got.status : 502
    throw err
  }
  const mime = String(got.headers?.get?.('content-type') || 'video/mp4').split(';')[0]
  return { buffer: got.buffer, mime }
}

export function mcpInitializeResult(clientVersion) {
  const asked = String(clientVersion || '').trim()
  const protocolVersion = MCP_PROTOCOLS.includes(asked) ? asked : MCP_PROTOCOL
  return {
    protocolVersion,
    capabilities: { tools: { listChanged: false } },
    serverInfo: { name: 'vidso', version: '2.0.0' },
    instructions: VIDSO_MCP_INSTRUCTIONS,
  }
}

export function parseMcpToolArgs(params) {
  const a = params?.arguments
  if (a == null) return {}
  if (typeof a === 'string') {
    try {
      const parsed = JSON.parse(a)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
    } catch {
      return {}
    }
  }
  return typeof a === 'object' && !Array.isArray(a) ? a : {}
}

export function mcpText(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
  return { content: [{ type: 'text', text }] }
}

export function mcpTools() {
  return [
    {
      name: 'youtube_status',
      description: 'Show whether this TubeOps account has a YouTube channel connected, plus auto-upload settings and the MCP URL.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    },
    {
      name: 'youtube_connect_url',
      description: 'Return a one-time browser link that starts Google OAuth so the user can connect a YouTube channel to this TubeOps account.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    },
    {
      name: 'youtube_list_videos',
      description: 'List recent uploads on the connected YouTube channel.',
      inputSchema: {
        type: 'object',
        properties: {
          max_results: { type: 'integer', minimum: 1, maximum: 25, description: 'How many videos to return (default 10)' },
        },
        additionalProperties: false,
      },
    },
    {
      name: 'youtube_get_video',
      description: 'Get title, description, privacy, tags, and stats for one video on the connected channel.',
      inputSchema: {
        type: 'object',
        properties: {
          video_id: { type: 'string', description: 'YouTube video ID' },
        },
        required: ['video_id'],
        additionalProperties: false,
      },
    },
    {
      name: 'youtube_update_video',
      description: 'Update title, description, tags, or privacy on a video the connected channel owns.',
      inputSchema: {
        type: 'object',
        properties: {
          video_id: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          privacy: { type: 'string', enum: YT_PRIVACY },
          tags: { type: 'array', items: { type: 'string' } },
        },
        required: ['video_id'],
        additionalProperties: false,
      },
    },
    {
      name: 'youtube_upload',
      description: 'Upload a finished video to the connected YouTube channel. Pass render_job_id after a long-form render, or a public https MP4 URL.',
      inputSchema: {
        type: 'object',
        properties: {
          video_url: { type: 'string', description: 'https URL of an MP4 the server can fetch' },
          render_job_id: { type: 'string', description: 'Long-form render job id from vidso_poll kind=render' },
          title: { type: 'string' },
          description: { type: 'string' },
          privacy: { type: 'string', enum: YT_PRIVACY },
          tags: { type: 'array', items: { type: 'string' } },
        },
        required: ['title'],
        additionalProperties: false,
      },
    },
  ].concat(vidsoMcpTools())
}

const YOUTUBE_ACCESS_TOOLS = new Set(['youtube_list_videos', 'youtube_get_video', 'youtube_update_video', 'youtube_upload'])

export async function runMcpTool(name, args, ctx = {}) {
  const { token, req } = ctx
  const a = args && typeof args === 'object' ? args : {}
  if (name === 'youtube_status') {
    const rec = await loadYoutubeRecord(token).catch(() => null)
    return mcpText(publicYoutubeStatus(rec, req, { configured: youtubeConfigured() }))
  }
  if (name === 'youtube_connect_url') {
    if (!youtubeConfigured()) {
      return mcpText('YouTube publishing is not configured on this TubeOps deployment yet.')
    }
    const ticket = issueYoutubeConnectTicket({
      token,
      returnTo: '/video-generation?youtube=connected',
    })
    const url = youtubeConnectStartUrl(requestOrigin(req), ticket)
    return mcpText(
      'Open this link in your browser to connect a YouTube channel to this TubeOps account. It expires in 15 minutes.\n' + url,
    )
  }
  if (YOUTUBE_ACCESS_TOOLS.has(name)) {
    try {
      if (name === 'youtube_list_videos') {
        const rec = await requireYoutubeAccess(token)
        return mcpText(await listMyVideos(rec.access_token, a.max_results))
      }
      if (name === 'youtube_get_video') {
        const rec = await requireYoutubeAccess(token)
        return mcpText(await getVideo(rec.access_token, a.video_id))
      }
      if (name === 'youtube_update_video') {
        const rec = await requireYoutubeAccess(token)
        return mcpText(await updateVideo(rec.access_token, a))
      }
      return mcpText(await uploadYoutubeFromArgs(token, {
        ...a,
        renderJobId: a.render_job_id || a.renderJobId,
      }))
    } catch (e) {
      // Tell Claude what to do about a lost or missing channel, with the code.
      if (e?.code === 'reconnect' || e?.code === 'not_connected') {
        return {
          ...mcpText({
            error: e.message,
            code: e.code,
            next: 'Call youtube_connect_url and give the user the link to ' + (e.code === 'reconnect' ? 'connect their channel again.' : 'connect a channel.'),
          }),
          isError: true,
        }
      }
      throw e
    }
  }
  if (String(name || '').startsWith('youtube_')) {
    const err = new Error('Unknown tool')
    err.code = -32601
    throw err
  }
  return runVidsoMcpTool(name, a, { token, req, user: ctx.user })
}
