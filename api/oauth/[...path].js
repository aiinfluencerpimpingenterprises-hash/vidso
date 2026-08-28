import { cors, readJson, send } from '../_lib/http.js'
import { requestOrigin, verifyPayload } from '../../lib/youtube.js'
import {
  assertRedirect,
  authorizationServerMetadata,
  authorizeHtml,
  canonicalMcpUrl,
  issueAuthCode,
  oauthApiSubpath,
  parseForm,
  protectedResourceMetadata,
  readClient,
  refreshVidsoSession,
  registerClient,
  resourceFromMetadataSubpath,
  tokenResponse,
  verifyPkce,
  vidsoSessionFromCookies,
} from '../../lib/mcp-oauth.js'

export const config = { maxDuration: 30 }

function originOf(req) {
  return requestOrigin(req).replace(/\/+$/, '')
}

function redirect(res, url) {
  res.statusCode = 302
  res.setHeader('Location', url)
  res.setHeader('Cache-Control', 'no-store')
  res.end()
}

function html(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(body)
}

async function readTokenBody(req) {
  const type = String(req.headers['content-type'] || '')
  if (type.includes('application/json')) return readJson(req)
  const chunks = []
  for await (const c of req) chunks.push(c)
  return parseForm(Buffer.concat(chunks).toString('utf8'))
}

function queryOf(req) {
  try {
    const host = originOf(req)
    return new URL(String(req.url || '/'), host).searchParams
  } catch {
    return new URLSearchParams()
  }
}

async function handleRegister(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' })
  try {
    const body = await readJson(req)
    const client = registerClient(body)
    res.statusCode = 201
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Cache-Control', 'no-store')
    return res.end(JSON.stringify(client))
  } catch (e) {
    return send(res, e.status || 400, e.body || { error: 'invalid_client_metadata', error_description: e.message })
  }
}

async function handleAuthorize(req, res) {
  const origin = originOf(req)
  const q = queryOf(req)
  const clientId = String(q.get('client_id') || '')
  const redirectUri = String(q.get('redirect_uri') || '')
  const state = String(q.get('state') || '')
  const challenge = String(q.get('code_challenge') || '')
  const method = String(q.get('code_challenge_method') || 'S256')
  const resource = String(q.get('resource') || canonicalMcpUrl(origin))
  const failToClient = (error) => {
    if (!redirectUri) return html(res, 400, authorizeHtml(error))
    const u = new URL(redirectUri)
    u.searchParams.set('error', error)
    if (state) u.searchParams.set('state', state)
    return redirect(res, u.toString())
  }
  if (String(q.get('response_type') || 'code') !== 'code') return failToClient('unsupported_response_type')
  if (!challenge || method.toUpperCase() !== 'S256') return failToClient('invalid_request')
  let client
  try {
    client = readClient(clientId)
    assertRedirect(client, redirectUri)
  } catch {
    return html(res, 400, authorizeHtml('This Claude connector is not registered. Add the Vidso URL again.'))
  }
  let session
  try {
    session = await vidsoSessionFromCookies(req)
  } catch {
    session = null
  }
  if (!session?.access) {
    const next = '/oauth/authorize?' + q.toString()
    return redirect(res, origin + '/login?next=' + encodeURIComponent(next))
  }
  const code = issueAuthCode({
    access: session.access,
    refresh: session.refresh,
    clientId,
    redirectUri,
    codeChallenge: challenge,
    resource,
  })
  const u = new URL(redirectUri)
  u.searchParams.set('code', code)
  if (state) u.searchParams.set('state', state)
  return redirect(res, u.toString())
}

async function handleToken(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' })
  const body = await readTokenBody(req)
  const grant = String(body.grant_type || '')
  try {
    if (grant === 'authorization_code') {
      const payload = verifyPayload(String(body.code || ''))
      if (payload.typ !== 'mcp_oauth_code') throw new Error('invalid_grant')
      assertRedirect(readClient(payload.client_id), payload.redirect_uri)
      if (payload.redirect_uri !== String(body.redirect_uri || '')) {
        const err = new Error('redirect_uri mismatch')
        err.body = { error: 'invalid_grant', error_description: err.message }
        throw err
      }
      if (!verifyPkce(String(body.code_verifier || ''), payload.code_challenge)) {
        const err = new Error('pkce failed')
        err.body = { error: 'invalid_grant', error_description: 'PKCE verification failed' }
        throw err
      }
      return send(res, 200, tokenResponse({
        access: payload.access,
        refresh: payload.refresh,
        clientId: payload.client_id,
        resource: payload.resource,
      }))
    }
    if (grant === 'refresh_token') {
      const payload = verifyPayload(String(body.refresh_token || ''))
      if (payload.typ !== 'mcp_oauth_refresh' || !payload.refresh) throw new Error('invalid_grant')
      const session = await refreshVidsoSession(payload.refresh)
      return send(res, 200, tokenResponse({
        access: session.access_token,
        refresh: session.refresh_token,
        clientId: payload.client_id,
        resource: payload.resource,
      }))
    }
    return send(res, 400, { error: 'unsupported_grant_type' })
  } catch (e) {
    return send(res, 400, e.body || { error: 'invalid_grant', error_description: e.message || 'invalid_grant' })
  }
}

export default async function handler(req, res) {
  cors(req, res)
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    return res.end()
  }
  const origin = originOf(req)
  const sub = oauthApiSubpath(req)
  if (sub === 'protected-resource' || sub.startsWith('protected-resource/')) {
    const resource = resourceFromMetadataSubpath(sub, origin)
    res.setHeader('Cache-Control', 'no-store')
    return send(res, 200, protectedResourceMetadata(origin, resource))
  }
  if (sub === 'authorization-server' || sub === 'openid-configuration') {
    res.setHeader('Cache-Control', 'no-store')
    return send(res, 200, authorizationServerMetadata(origin))
  }
  if (sub === 'register') return handleRegister(req, res)
  if (sub === 'authorize') return handleAuthorize(req, res)
  if (sub === 'token') return handleToken(req, res)
  return send(res, 404, { error: 'Not found' })
}
