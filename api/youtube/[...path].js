import { evaluatePlan, toHttp } from '../../lib/enforce.js'
import { cors, readJson, requireUser, send, bearer } from '../_lib/http.js'
import { handleRuns } from '../../lib/runs-api.js'
import {
  bridgeCookieHeader,
  deleteYoutubeRecord,
  exchangeGoogleCode,
  fetchYoutubeChannel,
  buildYoutubeConnect,
  loadYoutubeRecord,
  youtubeRecordCanUpload,
  mcpInitializeResult,
  MCP_PROTOCOL,
  mcpText,
  mcpTools,
  normalizePrivacy,
  parseCookies,
  parseMcpToolArgs,
  publicYoutubeStatus,
  readYoutubeConnectTicket,
  requestOrigin,
  requireYoutubeAccess,
  runMcpTool,
  saveYoutubeFromGoogleTokens,
  saveYoutubeRecord,
  uploadYoutubeFromArgs,
  verifyPayload,
  youtubeApiSubpath,
  youtubeConfigured,
  youtubeDedicatedOAuth,
  youtubeRedirectUri,
  YT_BRIDGE_COOKIE,
} from '../../lib/youtube.js'
import {
  mcpArchived,
  mcpConnectorPageHtml,
  mcpResourceFromReq,
  protectedResourceMetadataPath,
  unwrapMcpBearer,
  wantsBrowserPage,
  wwwAuthenticate,
} from '../../lib/mcp-oauth.js'
import { MCP_OPEN_TOOLS } from '../../lib/vidso-mcp.js'
import { resolveVidsoUser } from '../../lib/gate-run.js'
import { runTitleAgent } from '../../lib/title-agent.js'
import { runManagerAgent } from '../../lib/manager-agent.js'
import { runPublishAgent } from '../../lib/publish-agent.js'
import { runChannelAgent } from '../../lib/channel-agent.js'
import { runReferenceAgent } from '../../lib/reference-agent.js'
import { runCompose, runScenePlanner } from '../../lib/scene-agent.js'

export const config = { maxDuration: 300 }

function pathOf(req) {
  return youtubeApiSubpath(req)
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

function wantsSse(req) {
  return String(req?.headers?.accept || '').includes('text/event-stream')
}

function sendRpc(req, res, status, body) {
  res.statusCode = status
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('MCP-Protocol-Version', MCP_PROTOCOL)
  const json = JSON.stringify(body)
  if (wantsSse(req) && status === 200) {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Connection', 'keep-alive')
    return res.end('event: message\ndata: ' + json + '\n\n')
  }
  res.setHeader('Content-Type', 'application/json')
  return res.end(json)
}

function rpc(req, res, id, result) {
  return sendRpc(req, res, 200, { jsonrpc: '2.0', id: id ?? null, result })
}

function rpcErr(req, res, id, code, message) {
  return sendRpc(req, res, 200, { jsonrpc: '2.0', id: id ?? null, error: { code, message } })
}

function queryTicket(req) {
  const fromQuery = req?.query?.ticket
  if (fromQuery) return String([].concat(fromQuery)[0] || '')
  return new URLSearchParams(String(req?.url || '').split('?')[1] || '').get('ticket') || ''
}

async function handleConnectStart(req, res) {
  if (!youtubeConfigured()) {
    return send(res, 501, { error: 'YouTube publishing is turned off on this deployment.' })
  }
  let payload
  try {
    payload = readYoutubeConnectTicket(queryTicket(req))
  } catch {
    return send(res, 400, {
      error: 'This YouTube connect link expired. Ask Claude for a new youtube_connect_url.',
    })
  }
  try {
    const started = buildYoutubeConnect({
      token: payload.token,
      req,
      returnTo: payload.ret || '/video-generation?youtube=connected',
    })
    if (started.bridge) res.setHeader('Set-Cookie', bridgeCookieHeader(started.bridge))
    if (!started.url || started.mode === 'gis') {
      return redirect(res, appReturn(req, '/youtube', { yt: '1', youtube: 'connect' }))
    }
    return redirect(res, started.url)
  } catch (e) {
    return send(res, e.status || 400, { error: e.message || 'Could not start YouTube connect' })
  }
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
    return send(res, 501, { error: 'YouTube publishing is turned off on this deployment.' })
  }
  try {
    const started = buildYoutubeConnect({
      token,
      req,
      returnTo: body.returnTo || req.query?.returnTo,
    })
    if (started.bridge) res.setHeader('Set-Cookie', bridgeCookieHeader(started.bridge))
    return send(res, 200, {
      url: started.url || '',
      mode: started.mode,
      clientId: started.clientId || '',
      scopes: started.scopes || '',
    })
  } catch (e) {
    return send(res, e.status || 400, { error: e.message || 'Could not start YouTube connect' })
  }
}

async function handleImport(req, res, token, body) {
  try {
    const rec = await saveYoutubeFromGoogleTokens(token, body)
    return send(res, 200, publicYoutubeStatus(rec, req, { configured: true }))
  } catch (e) {
    return send(res, e.status || 400, { error: e.message || 'Could not connect YouTube', code: e.code })
  }
}

async function handleCallback(req, res) {
  const originPath = '/video-generation'
  const cookies = parseCookies(req)
  const fail = (message) => redirect(res, appReturn(req, originPath, { youtube: 'error', youtube_error: message }))
  if (!youtubeDedicatedOAuth()) return fail('not_configured')
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
  try {
    const rec = await requireYoutubeAccess(token)
    return send(res, 200, {
      accessToken: rec.access_token,
      expiresAt: rec.expiry,
      channel: { id: rec.channel_id, title: rec.channel_title, thumb: rec.channel_thumb },
      privacy: normalizePrivacy(rec.privacy),
    })
  } catch (e) {
    return send(res, e.status || 400, { error: e.message || 'Could not get a YouTube token', code: e.code })
  }
}

async function handleSettings(req, res, token, body) {
  const rec = await loadYoutubeRecord(token)
  if (!youtubeRecordCanUpload(rec)) {
    return send(res, 409, { error: 'Connect a YouTube channel first', code: rec?.channel_id ? 'reconnect' : 'not_connected' })
  }
  if (body.autoUpload != null) rec.auto_upload = !!body.autoUpload
  if (body.privacy != null) rec.privacy = normalizePrivacy(body.privacy)
  await saveYoutubeRecord(token, rec)
  return send(res, 200, publicYoutubeStatus(rec, req, { configured: true }))
}

async function handleUpload(req, res, token, body) {
  try {
    const result = await uploadYoutubeFromArgs(token, body)
    return send(res, 200, result)
  } catch (e) {
    return send(res, e.status || 400, { error: e.message || 'Upload failed', code: e.code })
  }
}

async function handleMcpMessage(req, res, token, user, body) {
  const id = body?.id ?? null
  const method = String(body?.method || '')
  if (method === 'initialize') return rpc(req, res, id, mcpInitializeResult(body?.params?.protocolVersion))
  if (
    method === 'notifications/initialized' ||
    method === 'initialized' ||
    method === 'notifications/cancelled'
  ) {
    res.statusCode = 202
    return res.end()
  }
  if (method === 'ping') return rpc(req, res, id, {})
  if (method === 'tools/list') return rpc(req, res, id, { tools: mcpTools() })
  if (method === 'resources/list') return rpc(req, res, id, { resources: [] })
  if (method === 'prompts/list') return rpc(req, res, id, { prompts: [] })
  if (method !== 'tools/call') return rpcErr(req, res, id, -32601, 'Unknown method')

  const name = String(body.params?.name || '')
  const args = parseMcpToolArgs(body.params)
  if (!MCP_OPEN_TOOLS.has(name)) {
    const plan = evaluatePlan(user)
    if (!plan.ok) return rpc(req, res, id, { ...mcpText(plan.message), isError: true })
  }
  try {
    const result = await runMcpTool(name, args, { token, req, user })
    return rpc(req, res, id, result)
  } catch (e) {
    if (e.code === -32601) return rpcErr(req, res, id, -32601, e.message || 'Unknown tool')
    return rpc(req, res, id, { ...mcpText(e.message || 'Tool failed'), isError: true })
  }
}

function sendMcpUnauthorized(req, res, message = 'Authentication required') {
  const origin = requestOrigin(req)
  const resource = mcpResourceFromReq(req)
  const meta = origin + protectedResourceMetadataPath(resource)
  res.setHeader('WWW-Authenticate', wwwAuthenticate(meta))
  res.setHeader('MCP-Protocol-Version', MCP_PROTOCOL)
  return send(res, 401, { error: 'invalid_token', error_description: message })
}

async function requireMcpUser(req) {
  const raw = bearer(req)
  if (!raw) {
    const err = new Error('Missing token')
    err.status = 401
    throw err
  }
  const unwrapped = unwrapMcpBearer(raw)
  const token = unwrapped.token
  const user = await resolveVidsoUser(token)
  return { user, token }
}

async function handleMcp(req, res, token, user) {
  res.setHeader('MCP-Protocol-Version', MCP_PROTOCOL)
  if (req.method === 'GET') {
    res.setHeader('Allow', 'POST, OPTIONS')
    return send(res, 405, {
      error: 'Streamable HTTP MCP: POST JSON-RPC to this URL',
      name: 'vidso',
      protocolVersion: MCP_PROTOCOL,
    })
  }
  const body = await readJson(req)
  if (Array.isArray(body)) {
    if (!body.length) return rpcErr(req, res, null, -32600, 'Empty batch')
    return handleMcpMessage(req, res, token, user, body[0])
  }
  return handleMcpMessage(req, res, token, user, body)
}

function falKey() {
  return String(process.env.FAL_KEY || process.env.FAL_API_KEY || '').replace(/^Key\s+/i, '').trim()
}

/** Scene agent: scene descriptions for AI visuals, and joining stills into clips (lib/scene-agent.js). */
async function handleScenes(req, res, body, mode) {
  const key = falKey()
  if (!key) return send(res, 501, { error: 'AI scenes are not configured on this deployment.' })
  try {
    if (mode === 'compose') return send(res, 200, await runCompose({ segments: body?.segments, id: body?.id, ms: body?.ms, falKey: key }))
    const scenes = (Array.isArray(body?.scenes) ? body.scenes : []).slice(0, 200)
    const out = await runScenePlanner({ scenes, topic: String(body?.topic || '').slice(0, 300), styleName: String(body?.style || '').slice(0, 60), character: String(body?.character || '').slice(0, 300), falKey: key })
    return send(res, 200, { scenes: out })
  } catch (e) {
    return send(res, 502, { error: e.message || 'Scene agent failed' })
  }
}

/** Publish agent: YouTube description and tags for a finished video (see lib/publish-agent.js). */
async function handlePublish(req, res, body) {
  const key = falKey()
  if (!key) return send(res, 501, { error: 'Publish agent is not configured on this deployment.' })
  try {
    const out = await runPublishAgent({
      title: String(body?.title || '').slice(0, 200),
      topic: String(body?.topic || '').slice(0, 600),
      script: String(body?.script || '').slice(0, 6000),
      niche: String(body?.niche || '').slice(0, 80),
      falKey: key,
      model: process.env.PUBLISH_MODEL || undefined,
    })
    return send(res, 200, out)
  } catch (e) {
    return send(res, 502, { error: e.message || 'Publish agent failed' })
  }
}

/** Channel agent: a name and first-episode topics for a new channel (Manager setup). */
async function handleChannel(req, res, body) {
  const key = falKey()
  if (!key) return send(res, 501, { error: 'Channel agent is not configured on this deployment.' })
  try {
    const out = await runChannelAgent({
      genre: String(body?.genre || '').slice(0, 40),
      about: String(body?.about || '').slice(0, 300),
      niche: String(body?.niche || '').slice(0, 80),
      reference: Array.isArray(body?.reference) ? body.reference.slice(0, 8).map((t) => String(t).slice(0, 140)) : [],
      falKey: key,
    })
    return send(res, 200, out)
  } catch (e) {
    return send(res, 502, { error: e.message || 'Channel agent failed' })
  }
}

/** Reference agent: read a YouTube channel the user wants to be like (public page + RSS only). */
async function handleReference(req, res, body) {
  const key = falKey()
  if (!key) return send(res, 501, { error: 'Reference reading is not configured on this deployment.' })
  try {
    return send(res, 200, await runReferenceAgent({ url: String(body?.url || '').slice(0, 300), falKey: key }))
  } catch (e) {
    return send(res, 400, { error: e.message || 'Could not read that channel' })
  }
}

/** Manager agent: what the crew should do with a chat message (see lib/manager-agent.js). */
async function handleManager(req, res, body) {
  const key = falKey()
  if (!key) return send(res, 501, { error: 'Manager agent is not configured on this deployment.' })
  const message = String(body?.message || '').trim()
  if (!message) return send(res, 400, { error: 'Empty message' })
  try {
    const styles = (Array.isArray(body.caption_styles) ? body.caption_styles : []).slice(0, 12)
      .map((x) => ({ id: String(x?.id || '').slice(0, 30), name: String(x?.name || '').slice(0, 40) })).filter((x) => x.id)
    const history = (Array.isArray(body.history) ? body.history : []).slice(-8)
      .map((h) => ({ from: h?.from === 'me' ? 'me' : 'manager', text: String(h?.text || '').slice(0, 300) }))
    const out = await runManagerAgent({
      message: message.slice(0, 1000),
      context: body.context && typeof body.context === 'object' ? body.context : {},
      history,
      captionStyles: styles,
      falKey: key,
      model: process.env.MANAGER_MODEL || undefined,
    })
    return send(res, 200, out)
  } catch (e) {
    return send(res, 502, { error: e.message || 'Manager agent failed' })
  }
}

/** Title agent: ranked title options for a video (see lib/title-agent.js). */
async function handleTitles(req, res, body) {
  const key = falKey()
  if (!key) return send(res, 501, { error: 'Title agent is not configured on this deployment.' })
  const topic = String(body?.topic || '').trim()
  if (!topic) return send(res, 400, { error: 'A topic is required.' })
  try {
    const out = await runTitleAgent({
      topic,
      hook: body.hook,
      script: String(body.script || '').slice(0, 6000),
      scriptTitle: body.script_title || body.scriptTitle,
      thumbnailText: body.thumbnail_text || body.thumbnailText,
      falKey: key,
      model: process.env.TITLE_MODEL || undefined,
    })
    return send(res, 200, out)
  } catch (e) {
    return send(res, 502, { error: e.message || 'Title agent failed' })
  }
}

export default async function handler(req, res) {
  cors(req, res)
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    return res.end()
  }

  const sub = pathOf(req)
  // Server-side video runs share this function (Vercel's function cap): /api/youtube/runs/…
  if (sub === 'runs' || sub.startsWith('runs/')) return handleRuns(req, res, sub.split('/').slice(1).filter(Boolean))
  if (sub === 'callback' && req.method === 'GET') {
    return handleCallback(req, res)
  }
  if (sub === 'connect-start' && req.method === 'GET') {
    return handleConnectStart(req, res)
  }

  if (sub === 'mcp') {
    // Archived. The upload and connect routes below are a separate feature and
    // stay live, so this guard is scoped to the MCP subpath only.
    if (mcpArchived(req)) return send(res, 404, { error: 'Not found' })
    if (wantsBrowserPage(req)) {
      res.statusCode = 200
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.setHeader('Cache-Control', 'no-store')
      return res.end(mcpConnectorPageHtml(requestOrigin(req)))
    }
    let user
    let token
    try {
      ;({ user, token } = await requireMcpUser(req))
    } catch (e) {
      return sendMcpUnauthorized(req, res, e.message || 'Unauthorized')
    }
    return handleMcp(req, res, token, user)
  }

  let user
  let token
  try {
    ;({ user, token } = await requireUser(req))
  } catch (e) {
    return send(res, e.status || 401, e.body || { error: e.message || 'Unauthorized' })
  }

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
  if (sub === 'import' && req.method === 'POST') return handleImport(req, res, token, await readJson(req))
  if (sub === 'disconnect' && req.method === 'POST') return handleDisconnect(req, res, token)
  if (sub === 'token' && req.method === 'POST') return handleToken(req, res, token)
  if (sub === 'settings' && req.method === 'POST') return handleSettings(req, res, token, await readJson(req))
  if (sub === 'upload' && req.method === 'POST') return handleUpload(req, res, token, await readJson(req))
  if (sub === 'titles' && req.method === 'POST') return handleTitles(req, res, await readJson(req))
  if (sub === 'manager' && req.method === 'POST') return handleManager(req, res, await readJson(req))
  if (sub === 'publish' && req.method === 'POST') return handlePublish(req, res, await readJson(req))
  if (sub === 'channel' && req.method === 'POST') return handleChannel(req, res, await readJson(req))
  if (sub === 'reference' && req.method === 'POST') return handleReference(req, res, await readJson(req))
  if ((sub === 'scenes' || sub === 'compose') && req.method === 'POST') return handleScenes(req, res, await readJson(req), sub)
  return send(res, 404, { error: 'Not found' })
}
