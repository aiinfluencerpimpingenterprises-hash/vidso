import { evaluatePlan, toHttp } from '../../lib/enforce.js'
import { cors, readJson, requireUser, send } from '../_lib/http.js'
import {
  bridgeCookieHeader,
  deleteYoutubeRecord,
  downloadRenderVideo,
  ensureAccessToken,
  exchangeGoogleCode,
  fetchYoutubeChannel,
  loadYoutubeRecord,
  mcpTools,
  normalizePrivacy,
  parseCookies,
  publicYoutubeStatus,
  requestOrigin,
  saveYoutubeRecord,
  signPayload,
  verifyPayload,
  youtubeConfigured,
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

function rpc(res, id, result) {
  return send(res, 200, { jsonrpc: '2.0', id: id ?? null, result })
}

function rpcErr(res, id, code, message) {
  return send(res, 200, { jsonrpc: '2.0', id: id ?? null, error: { code, message } })
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
    ret: String(returnTo || '/video-generation').slice(0, 120),
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
      message: 'YouTube publishing is not configured on this deployment yet.',
    }))
  }
  const rec = await loadYoutubeRecord(token).catch(() => null)
  return send(res, 200, publicYoutubeStatus(rec, req, { configured: true }))
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
  const originPath = '/video-generation'
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
    if (rec.auto_upload == null) rec.auto_upload = true
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
  return result
}

async function handleUpload(req, res, token, body) {
  try {
    const result = await runUpload(token, body)
    return send(res, 200, result)
  } catch (e) {
    return send(res, e.status || 400, { error: e.message || 'Upload failed', code: e.code })
  }
}

async function handleMcp(req, res, token) {
  if (req.method === 'GET') {
    res.statusCode = 405
    res.setHeader('Allow', 'POST')
    return res.end()
  }
  const body = await readJson(req)
  const id = body.id ?? null
  const method = String(body.method || '')
  if (method === 'initialize') {
    return rpc(res, id, {
      protocolVersion: '2025-03-26',
      capabilities: { tools: {} },
      serverInfo: { name: 'vidso-youtube', version: '1.0.0' },
    })
  }
  if (method === 'notifications/initialized' || method === 'initialized') {
    res.statusCode = 202
    return res.end()
  }
  if (method === 'ping') return rpc(res, id, {})
  if (method === 'tools/list') return rpc(res, id, { tools: mcpTools() })
  if (method !== 'tools/call') return rpcErr(res, id, -32601, 'Unknown method')

  const name = String(body.params?.name || '')
  const args = body.params?.arguments || {}
  try {
    if (name === 'youtube_status') {
      const rec = await loadYoutubeRecord(token).catch(() => null)
      return rpc(res, id, {
        content: [{ type: 'text', text: JSON.stringify(publicYoutubeStatus(rec, req, { configured: youtubeConfigured() }), null, 2) }],
      })
    }
    if (name === 'youtube_connect_url') {
      const origin = requestOrigin(req)
      return rpc(res, id, {
        content: [{
          type: 'text',
          text: 'Open Vidso while logged in and connect YouTube from Account settings:\n' + origin + '/video-generation?youtube=connect',
        }],
      })
    }
    if (name === 'youtube_upload') {
      const result = await runUpload(token, {
        videoUrl: args.video_url,
        title: args.title,
        description: args.description,
        privacy: args.privacy,
        tags: args.tags,
      })
      return rpc(res, id, {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      })
    }
    return rpcErr(res, id, -32601, 'Unknown tool')
  } catch (e) {
    return rpc(res, id, {
      content: [{ type: 'text', text: e.message || 'Tool failed' }],
      isError: true,
    })
  }
}

export default async function handler(req, res) {
  cors(req, res)
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    return res.end()
  }

  const sub = pathOf(req)
  if (sub === 'callback' && req.method === 'GET') {
    return handleCallback(req, res)
  }

  let user
  let token
  try {
    ;({ user, token } = await requireUser(req))
  } catch (e) {
    return send(res, e.status || 401, e.body || { error: e.message || 'Unauthorized' })
  }

  if (sub === 'mcp') return handleMcp(req, res, token)

  const plan = evaluatePlan(user)
  if (!plan.ok && sub !== 'status') {
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
  return send(res, 404, { error: 'Not found' })
}
