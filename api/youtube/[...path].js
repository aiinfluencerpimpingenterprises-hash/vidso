import { evaluatePlan, toHttp } from '../../lib/enforce.js'
import { cors, readJson, requireUser, send } from '../_lib/http.js'
import { requireMcpUser } from '../_lib/mcp-user.js'
import { handleMcpBody } from '../../lib/mcp-rpc.js'
import { loadMcpRecord, publicMcpStatus } from '../../lib/mcp-auth.js'
import {
  findYoutubeUpload,
  isYoutubeQuotaError,
  listYoutubeUploads,
  publicQuotaView,
  recordYoutubeUpload,
  youtubeQuotaResetAt,
} from '../../lib/youtube-uploads.js'
import {
  bridgeCookieHeader,
  deleteYoutubeRecord,
  downloadRenderVideo,
  ensureAccessToken,
  exchangeGoogleCode,
  fetchYoutubeChannel,
  googleAuthUrl,
  loadYoutubeRecord,
  normalizePrivacy,
  parseCookies,
  publicYoutubeStatus,
  requestOrigin,
  saveYoutubeRecord,
  signPayload,
  verifyPayload,
  youtubeConfigured,
  youtubeOauthVerified,
  youtubeRedirectUri,
  youtubeResumableUpload,
  youtubeSecrets,
  YT_BRIDGE_COOKIE,
} from '../../lib/youtube.js'

export const config = { maxDuration: 300 }

function pathOf(req) {
  return [].concat(req.query.path || []).join('/')
}

function redirect(res, url) {
  res.statusCode = 302
  res.setHeader('Location', url)
  res.setHeader('Cache-Control', 'no-store')
  res.end()
}

function appReturn(req, path, extra = {}) {
  const origin = requestOrigin(req)
  const u = new URL((path && path.startsWith('/') ? path : '/video-generation'), origin)
  Object.entries(extra).forEach(([k, v]) => {
    if (v != null && v !== '') u.searchParams.set(k, String(v))
  })
  return u.toString()
}

async function extrasFor(req, token, rec) {
  const uploads = await listYoutubeUploads(token).catch(() => [])
  const mcp = await loadMcpRecord(token).catch(() => null)
  return {
    configured: youtubeConfigured(),
    oauthVerified: youtubeOauthVerified(),
    quota: publicQuotaView(uploads),
    mcp: publicMcpStatus(mcp, req, { sessionToken: token }),
    uploads,
  }
}

async function loadFresh(token) {
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

async function connectUrlFor(req, token, returnTo) {
  const { clientId } = youtubeSecrets()
  const redirectUri = youtubeRedirectUri(req)
  const nonce = signPayload({ n: Math.random().toString(36).slice(2), t: Date.now() })
  const bridge = signPayload({
    token,
    ret: String(returnTo || '/connections').slice(0, 120),
    n: nonce,
    exp: Date.now() + 15 * 60 * 1000,
  })
  const url = googleAuthUrl({
    clientId,
    redirectUri,
    state: signPayload({ n: nonce, exp: Date.now() + 15 * 60 * 1000 }),
  })
  return { url, bridge }
}

async function handleStatus(req, res, token) {
  if (!youtubeConfigured()) {
    return send(res, 200, publicYoutubeStatus(null, req, {
      configured: false,
      oauthVerified: youtubeOauthVerified(),
      message: 'YouTube publishing is not configured on this deployment yet.',
    }))
  }
  const rec = await loadYoutubeRecord(token).catch(() => null)
  const extra = await extrasFor(req, token, rec)
  return send(res, 200, publicYoutubeStatus(rec, req, extra))
}

async function handleConnect(req, res, token, body) {
  if (!youtubeConfigured()) {
    return send(res, 501, { error: 'YouTube publishing is not configured. Add GOOGLE_YOUTUBE_CLIENT_ID and GOOGLE_YOUTUBE_CLIENT_SECRET.' })
  }
  const { url, bridge } = await connectUrlFor(req, token, body.returnTo || req.query.returnTo)
  res.setHeader('Set-Cookie', bridgeCookieHeader(bridge))
  return send(res, 200, { url })
}

async function handleCallback(req, res) {
  const originPath = '/connections'
  const cookies = parseCookies(req)
  const fail = (message) => redirect(res, appReturn(req, originPath, { youtube: 'error', youtube_error: message }))
  if (!youtubeConfigured()) return fail('not_configured')
  const err = String(req.query.error || '')
  if (err) return fail(err.slice(0, 80))
  const code = String(req.query.code || '')
  if (!code) return fail('missing_code')
  let bridge
  let state
  try {
    bridge = verifyPayload(cookies[YT_BRIDGE_COOKIE] || '')
    state = verifyPayload(String(req.query.state || ''))
  } catch {
    return fail('expired')
  }
  if (!bridge?.token || state.n !== bridge.n) return fail('mismatch')
  const ret = bridge.ret || originPath
  try {
    const tokens = await exchangeGoogleCode({ code, redirectUri: youtubeRedirectUri(req) })
    if (!tokens.refresh_token && !tokens.access_token) return fail('no_token')
    let rec = await loadYoutubeRecord(bridge.token).catch(() => null) || {}
    rec.access_token = tokens.access_token
    rec.expiry = Date.now() + Math.max(60, Number(tokens.expires_in || 3600) - 30) * 1000
    if (tokens.refresh_token) rec.refresh_token = tokens.refresh_token
    if (!rec.refresh_token) return fail('no_refresh')
    const channel = await fetchYoutubeChannel(rec.access_token)
    rec.channel_id = channel.id
    rec.channel_title = channel.title
    rec.channel_thumb = channel.thumb
    rec.connected_at = new Date().toISOString()
    if (rec.auto_upload == null) rec.auto_upload = false
    rec.privacy = normalizePrivacy(rec.privacy)
    await saveYoutubeRecord(bridge.token, rec)
    res.setHeader('Set-Cookie', bridgeCookieHeader('', { clear: true }))
    return redirect(res, appReturn(req, ret, { youtube: 'connected' }))
  } catch (e) {
    return fail(String(e.message || 'connect_failed').slice(0, 80))
  }
}

async function handleDisconnect(req, res, token) {
  const rec = await loadYoutubeRecord(token).catch(() => null)
  await deleteYoutubeRecord(token, rec)
  return send(res, 200, publicYoutubeStatus(null, req, { configured: youtubeConfigured() }))
}

async function handleToken(req, res, token) {
  const rec = await loadFresh(token)
  if (!rec?.refresh_token) return send(res, 409, { error: 'Connect a YouTube channel first', code: 'not_connected' })
  const next = await ensureAccessToken(rec)
  if (next.access_token !== rec.access_token) await saveYoutubeRecord(token, next)
  return send(res, 200, {
    accessToken: next.access_token,
    expiresAt: next.expiry,
    channel: { id: next.channel_id, title: next.channel_title, thumb: next.channel_thumb },
    privacy: normalizePrivacy(next.privacy),
  })
}

async function handleSettings(req, res, token, body) {
  const rec = await loadYoutubeRecord(token)
  if (!rec?.refresh_token) return send(res, 409, { error: 'Connect a YouTube channel first', code: 'not_connected' })
  if (body.autoUpload != null) rec.auto_upload = !!body.autoUpload
  if (body.privacy != null) rec.privacy = normalizePrivacy(body.privacy)
  await saveYoutubeRecord(token, rec)
  return send(res, 200, publicYoutubeStatus(rec, req, { configured: true }))
}

async function runUpload(token, body) {
  const rec = await loadFresh(token)
  if (!rec?.refresh_token) {
    const err = new Error('Connect a YouTube channel first')
    err.status = 409
    err.code = 'not_connected'
    throw err
  }
  const next = await ensureAccessToken(rec)
  const file = await downloadRenderVideo(token, {
    renderJobId: body.renderJobId,
    videoUrl: body.video_url || body.videoUrl,
  })
  const result = await youtubeResumableUpload({
    accessToken: next.access_token,
    buffer: file.buffer,
    mime: file.mime,
    title: body.title,
    description: body.description,
    tags: body.tags,
    privacy: body.privacy || next.privacy,
  })
  await recordYoutubeUpload(token, {
    id: body.uploadId,
    project: body.project || body.title || '',
    channel_id: next.channel_id,
    channel_title: next.channel_title,
    title: body.title,
    status: 'published',
    url: result.url || '',
    video_url: body.video_url || body.videoUrl,
    render_job_id: body.renderJobId,
    description: body.description,
    privacy: body.privacy || next.privacy,
    tags: body.tags,
  }).catch(() => {})
  return result
}

async function handleUpload(req, res, token, body) {
  try {
    const result = await runUpload(token, body)
    return send(res, 200, result)
  } catch (e) {
    const queued = isYoutubeQuotaError(e)
    await recordYoutubeUpload(token, {
      id: body.uploadId,
      project: body.project || body.title || '',
      title: body.title,
      status: queued ? 'queued' : 'failed',
      error: e.message || 'Upload failed',
      video_url: body.video_url || body.videoUrl,
      render_job_id: body.renderJobId,
      description: body.description,
      privacy: body.privacy,
      tags: body.tags,
      retry_after: queued ? youtubeQuotaResetAt() : null,
    }).catch(() => {})
    return send(res, queued ? 429 : (e.status || 400), {
      error: queued
        ? 'YouTube daily quota is full. This upload is queued until the next reset (midnight Pacific Time).'
        : (e.message || 'Upload failed'),
      code: queued ? 'quota_exhausted' : e.code,
      queued,
      retryAfter: queued ? youtubeQuotaResetAt() : null,
    })
  }
}

async function handleUploads(req, res, token) {
  const uploads = await listYoutubeUploads(token).catch(() => [])
  return send(res, 200, { uploads, quota: publicQuotaView(uploads) })
}

async function handleRetry(req, res, token, body) {
  const row = await findYoutubeUpload(token, String(body.id || body.uploadId || ''))
  if (!row) return send(res, 404, { error: 'Upload not found' })
  if (row.status === 'published' && row.url) {
    return send(res, 200, { url: row.url, videoId: String(row.url).split('v=')[1] || '', skipped: true })
  }
  try {
    const result = await runUpload(token, {
      uploadId: row.id,
      title: body.title || row.title,
      description: body.description || row.description,
      privacy: body.privacy || row.privacy,
      tags: body.tags || row.tags,
      videoUrl: row.video_url,
      renderJobId: row.render_job_id,
      project: row.project,
    })
    return send(res, 200, result)
  } catch (e) {
    const queued = isYoutubeQuotaError(e)
    await recordYoutubeUpload(token, {
      id: row.id,
      status: queued ? 'queued' : 'failed',
      error: e.message || 'Retry failed',
      retry_after: queued ? youtubeQuotaResetAt() : null,
    }).catch(() => {})
    return send(res, queued ? 429 : (e.status || 400), {
      error: e.message || 'Retry failed',
      code: queued ? 'quota_exhausted' : e.code,
      queued,
      retryAfter: queued ? youtubeQuotaResetAt() : null,
    })
  }
}

async function handleMcp(req, res, token) {
  if (req.method === 'GET') {
    res.statusCode = 405
    res.setHeader('Allow', 'POST')
    return res.end()
  }
  const body = await readJson(req)
  return handleMcpBody(req, res, token, body)
}

export default async function handler(req, res) {
  cors(req, res)
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, MCP-Protocol-Version')
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    return res.end()
  }

  const sub = pathOf(req)
  if (sub === 'callback' && req.method === 'GET') {
    return handleCallback(req, res)
  }

  if (sub === 'mcp') {
    let token
    try {
      ;({ token } = await requireMcpUser(req))
    } catch (e) {
      return send(res, e.status || 401, e.body || { error: e.message || 'Unauthorized' })
    }
    return handleMcp(req, res, token)
  }

  let user
  let token
  try {
    ;({ user, token } = await requireUser(req))
  } catch (e) {
    return send(res, e.status || 401, e.body || { error: e.message || 'Unauthorized' })
  }

  const plan = evaluatePlan(user)
  if (!plan.ok && sub !== 'status' && sub !== 'uploads') {
    const http = toHttp(plan)
    return send(res, http.status, http.body)
  }

  if ((sub === 'status' || sub === '') && req.method === 'GET') return handleStatus(req, res, token)
  if (sub === 'connect' && (req.method === 'POST' || req.method === 'GET')) {
    const body = req.method === 'GET' ? {} : await readJson(req)
    return handleConnect(req, res, token, body)
  }
  if (sub === 'disconnect' && req.method === 'POST') return handleDisconnect(req, res, token)
  if (sub === 'token' && req.method === 'POST') return handleToken(req, res, token)
  if (sub === 'settings' && req.method === 'POST') return handleSettings(req, res, token, await readJson(req))
  if (sub === 'upload' && req.method === 'POST') return handleUpload(req, res, token, await readJson(req))
  if (sub === 'uploads' && req.method === 'GET') return handleUploads(req, res, token)
  if (sub === 'retry' && req.method === 'POST') return handleRetry(req, res, token, await readJson(req))
  if (sub === 'record' && req.method === 'POST') {
    const body = await readJson(req)
    const rec = await loadYoutubeRecord(token).catch(() => null)
    const row = await recordYoutubeUpload(token, {
      ...body,
      channel_id: rec?.channel_id,
      channel_title: rec?.channel_title,
    })
    return send(res, 200, { upload: row })
  }
  return send(res, 404, { error: 'Not found' })
}
