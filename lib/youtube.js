/** YouTube Data API helpers for Vidso. Server-only (Node crypto + Railway token store).
 *
 * Env (Vercel), optional when reusing Google sign-in:
 *   GOOGLE_YOUTUBE_CLIENT_ID
 *   GOOGLE_YOUTUBE_CLIENT_SECRET
 *   YOUTUBE_TOKEN_SECRET          optional; defaults to the client secret
 *   YOUTUBE_REDIRECT_URI          optional; defaults to {origin}/api/youtube/callback
 *
 * If those are unset, Connect YouTube reuses the same Google OAuth client as
 * Vidso sign-in (Supabase).
 */

import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual as tse } from 'node:crypto'
import { fetchJsonUrl, railwayDelete, railwayList, railwayUpload } from './railway-files.js'

export const YT_OAUTH_FILENAME = 'vidso-yt-oauth.json'
export const YT_BRIDGE_COOKIE = 'vidso_yt_bridge'
export const YT_SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube',
].join(' ')
export const MCP_PROTOCOL = '2025-03-26'
export const YT_PRIVACY = ['unlisted', 'private', 'public']
export const YT_MAX_SERVER_BYTES = 96 * 1024 * 1024
export const SUPABASE_AUTH_URL = 'https://ymtmgpgcmrazqeklixwf.supabase.co'
export const SIGNIN_GOOGLE_CLIENT_ID = '715298595148-v01b90t5fvsjeqsbcvme9u69318a89gj.apps.googleusercontent.com'
const YT_RECORD_SECRET_FALLBACK = 'vidso-yt-record-v1'

const UPSTREAM = process.env.UPSTREAM_API || 'https://vibrant-patience-production-a7f0.up.railway.app'

export function youtubeSecrets(env = process.env) {
  const clientId = String(env.GOOGLE_YOUTUBE_CLIENT_ID || SIGNIN_GOOGLE_CLIENT_ID).trim()
  const clientSecret = String(env.GOOGLE_YOUTUBE_CLIENT_SECRET || '').trim()
  const tokenSecret = String(env.YOUTUBE_TOKEN_SECRET || clientSecret || YT_RECORD_SECRET_FALLBACK).trim()
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
  return u.toString()
}

export const YT_PROD_REDIRECT = 'https://www.vidso.pro/api/youtube/callback'

export function requestOrigin(req) {
  const xfHost = String(req?.headers?.['x-forwarded-host'] || '').split(',')[0].trim()
  const host = xfHost || String(req?.headers?.host || 'vidso.pro').split(',')[0].trim()
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
  return YT_PRIVACY.includes(v) ? v : 'unlisted'
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
  const decipher = createDecipheriv('aes-256-gcm', keyBuf(env), iv)
  decipher.setAuthTag(tag)
  const pt = Buffer.concat([decipher.update(data), decipher.final()])
  return JSON.parse(pt.toString('utf8'))
}

export function publicYoutubeStatus(record, req, extra = {}) {
  const origin = requestOrigin(req)
  const connected = !!(record && record.refresh_token && record.channel_id)
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
    autoUpload: connected ? record.auto_upload !== false : false,
    privacy: normalizePrivacy(record?.privacy),
    mcpUrl: origin + '/api/youtube/mcp',
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
  if (!res.ok) throw googleError(data, 'Could not refresh YouTube access')
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

export async function updateVideo(accessToken, args = {}) {
  const videoId = String(args.video_id || args.videoId || '').trim()
  if (!videoId) throw new Error('video_id is required')
  const current = await youtubeApi(accessToken, 'videos?part=snippet,status&id=' + encodeURIComponent(videoId))
  const item = Array.isArray(current.items) ? current.items[0] : null
  if (!item?.id) throw new Error('Video not found')
  const snippet = {
    title: item.snippet?.title || 'Vidso video',
    description: item.snippet?.description || '',
    tags: Array.isArray(item.snippet?.tags) ? item.snippet.tags : [],
    categoryId: item.snippet?.categoryId || '22',
  }
  if (args.title != null && String(args.title).trim()) snippet.title = sanitizeTitle(args.title)
  if (args.description != null) snippet.description = String(args.description).slice(0, 5000)
  if (Array.isArray(args.tags)) snippet.tags = args.tags.map(String).slice(0, 15)
  const status = { privacyStatus: item.status?.privacyStatus || 'unlisted' }
  if (args.privacy) status.privacyStatus = normalizePrivacy(args.privacy)
  let data
  try {
    data = await youtubeApi(accessToken, 'videos?part=snippet,status', {
      method: 'PUT',
      body: { id: videoId, snippet, status },
    })
  } catch (e) {
    const msg = String(e.message || '')
    if (/insufficient|scope|forbidden/i.test(msg)) {
      throw new Error('Reconnect YouTube in Vidso Account settings to allow video edits. ' + msg)
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
  } catch (_) {
    return rec
  }
}

export async function requireYoutubeAccess(token) {
  const rec = await loadYoutubeAccess(token)
  if (!rec?.refresh_token) {
    const err = new Error('Connect a YouTube channel first')
    err.status = 409
    err.code = 'not_connected'
    throw err
  }
  const next = await ensureAccessToken(rec)
  if (next.access_token !== rec.access_token) await saveYoutubeRecord(token, next)
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
  if (!refresh) {
    const err = new Error('Google did not return a YouTube refresh token. Approve YouTube access, then connect again.')
    err.status = 400
    err.code = 'no_refresh'
    throw err
  }
  if (!access) {
    const err = new Error('Google did not return a YouTube access token.')
    err.status = 400
    err.code = 'no_token'
    throw err
  }
  let rec = await loadYoutubeRecord(token).catch(() => null) || {}
  rec.access_token = access
  rec.refresh_token = refresh
  rec.expiry = Date.now() + Math.max(60, Number(body.expires_in || 3600) - 30) * 1000
  rec.source = 'supabase-google'
  const channel = await fetchYoutubeChannel(access)
  rec.channel_id = channel.id
  rec.channel_title = channel.title
  rec.channel_thumb = channel.thumb
  rec.connected_at = new Date().toISOString()
  if (rec.auto_upload == null) rec.auto_upload = true
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
  if (record.access_token && exp > Date.now() + 60000) return record
  if (!record.refresh_token) throw new Error('YouTube is not connected')
  const fresh = await refreshGoogleAccess(record.refresh_token, env)
  record.access_token = fresh.access_token
  record.expiry = Date.now() + Math.max(60, Number(fresh.expires_in || 3600) - 30) * 1000
  if (fresh.refresh_token) record.refresh_token = fresh.refresh_token
  return record
}

export function sanitizeTitle(title) {
  const t = String(title || '').replace(/\s+/g, ' ').trim()
  return (t || 'Vidso video').slice(0, 100)
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
    throw new Error('This video is too large to upload from the server. Use Upload to YouTube in the app.')
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
          description: String(description || 'Uploaded with Vidso').slice(0, 5000),
          tags: Array.isArray(tags) && tags.length ? tags.map(String).slice(0, 15) : ['vidso'],
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

export async function downloadRenderVideo(token, { renderJobId, videoUrl }) {
  let url = String(videoUrl || '').trim()
  const headers = {}
  if (renderJobId) {
    url = UPSTREAM + '/api/faceless/render/' + encodeURIComponent(String(renderJobId)) + '/download'
    headers.Authorization = 'Bearer ' + token
  }
  if (!url || !/^https?:\/\//i.test(url)) throw new Error('Missing video URL')
  const res = await fetch(url, { headers })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.message || data.error || 'Could not download the video')
  }
  const mime = String(res.headers.get('content-type') || 'video/mp4').split(';')[0]
  const buf = Buffer.from(await res.arrayBuffer())
  return { buffer: buf, mime }
}

export function mcpInitializeResult() {
  return {
    protocolVersion: MCP_PROTOCOL,
    capabilities: { tools: { listChanged: false } },
    serverInfo: { name: 'vidso-youtube', version: '1.1.0' },
    instructions: [
      'Vidso YouTube MCP for the signed-in Vidso account.',
      'Call youtube_status first.',
      'If the channel is not connected, give the user the youtube_connect_url link and have them reconnect in Account settings.',
      'Use youtube_list_videos and youtube_get_video to inspect uploads.',
      'Use youtube_update_video to change title, description, tags, or privacy.',
      'Use youtube_upload for a finished public https MP4. Large files should be uploaded in the Vidso app.',
    ].join(' '),
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
      description: 'Show whether this Vidso account has a YouTube channel connected, plus auto-upload settings and the MCP URL.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    },
    {
      name: 'youtube_connect_url',
      description: 'Tell the user how to connect a YouTube channel in Vidso (opens Account settings).',
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
      description: 'Upload a finished video to the connected YouTube channel. Prefer a public https video URL. Long files should be uploaded in the Vidso app.',
      inputSchema: {
        type: 'object',
        properties: {
          video_url: { type: 'string', description: 'https URL of an MP4 the server can fetch' },
          title: { type: 'string' },
          description: { type: 'string' },
          privacy: { type: 'string', enum: YT_PRIVACY },
          tags: { type: 'array', items: { type: 'string' } },
        },
        required: ['video_url', 'title'],
        additionalProperties: false,
      },
    },
  ]
}

export async function runMcpTool(name, args, { token, req }) {
  const a = args && typeof args === 'object' ? args : {}
  if (name === 'youtube_status') {
    const rec = await loadYoutubeRecord(token).catch(() => null)
    return mcpText(publicYoutubeStatus(rec, req, { configured: youtubeConfigured() }))
  }
  if (name === 'youtube_connect_url') {
    return mcpText(
      'Open Vidso while logged in and connect YouTube from Account settings:\n' +
        requestOrigin(req) + '/video-generation?youtube=connect',
    )
  }
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
  if (name === 'youtube_upload') {
    return mcpText(await uploadYoutubeFromArgs(token, a))
  }
  const err = new Error('Unknown tool')
  err.code = -32601
  throw err
}
