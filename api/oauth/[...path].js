import { cors, readJson, send } from '../_lib/http.js'
import { requestOrigin, verifyPayload } from '../../lib/youtube.js'
import {
  assertRedirect,
  authorizeParamsFromNext,
  authorizationServerMetadata,
  authorizeHtml,
  canonicalMcpUrl,
  issueAuthCode,
  mcpArchived,
  oauthApiSubpath,
  parseForm,
  protectedResourceMetadata,
  readClient,
  refreshVidsoSession,
  registerClient,
  resourceFromMetadataSubpath,
  tokenResponse,
  UPSTREAM,
  verifyPkce,
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

/** Checks a pending authorize request; returns its parts or an error code. */
function checkAuthorize(q, origin) {
  const clientId = String(q.get('client_id') || '')
  const redirectUri = String(q.get('redirect_uri') || '')
  const state = String(q.get('state') || '')
  const challenge = String(q.get('code_challenge') || '')
  const method = String(q.get('code_challenge_method') || 'S256')
  const resource = String(q.get('resource') || canonicalMcpUrl(origin))
  if (String(q.get('response_type') || 'code') !== 'code') return { error: 'unsupported_response_type', redirectUri, state }
  if (!challenge || method.toUpperCase() !== 'S256') return { error: 'invalid_request', redirectUri, state }
  try {
    assertRedirect(readClient(clientId), redirectUri)
  } catch {
    return { error: 'unregistered', redirectUri: '', state }
  }
  return { clientId, redirectUri, state, challenge, resource }
}

function clientRedirect(redirectUri, params) {
  const u = new URL(redirectUri)
  for (const [k, v] of Object.entries(params)) if (v) u.searchParams.set(k, v)
  return u.toString()
}

// Claude always signs in on its own here. Reusing the browser's session meant
// Claude and the browser shared one refresh token, so whichever refreshed first
// signed the other out.
async function handleAuthorize(req, res) {
  const origin = originOf(req)
  const q = queryOf(req)
  const pending = checkAuthorize(q, origin)
  if (pending.error === 'unregistered') {
    return html(res, 400, authorizeHtml('This Claude connector is not registered. Add the TubeOps URL again.'))
  }
  if (pending.error) {
    if (!pending.redirectUri) return html(res, 400, authorizeHtml(pending.error))
    return redirect(res, clientRedirect(pending.redirectUri, { error: pending.error, state: pending.state }))
  }
  const next = '/oauth/authorize?' + q.toString()
  return redirect(res, origin + '/login?connect=claude&next=' + encodeURIComponent(next))
}

/** The login page hands over Claude's own fresh session; answer with Claude's redirect. */
async function handleConnectorSession(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' })
  const body = await readJson(req).catch(() => ({}))
  const access = String(body.access_token || '').trim()
  const refresh = String(body.refresh_token || '').trim()
  const q = authorizeParamsFromNext(body.next)
  if (!access || !refresh || !q) return send(res, 400, { error: 'invalid_request' })
  const pending = checkAuthorize(q, originOf(req))
  if (pending.error) return send(res, 400, { error: pending.error })
  const me = await fetch(UPSTREAM + '/api/user/me', { headers: { Authorization: 'Bearer ' + access } }).catch(() => null)
  if (!me?.ok) return send(res, 401, { error: 'Sign-in did not go through. Try again.' })
  const code = issueAuthCode({
    access,
    refresh,
    clientId: pending.clientId,
    redirectUri: pending.redirectUri,
    codeChallenge: pending.challenge,
    resource: pending.resource,
  })
  return send(res, 200, { redirect: clientRedirect(pending.redirectUri, { code, state: pending.state }) })
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
        own: !!payload.own,
      }))
    }
    if (grant === 'refresh_token') {
      const payload = verifyPayload(String(body.refresh_token || ''))
      if (payload.typ !== 'mcp_oauth_refresh' || !payload.refresh) throw new Error('invalid_grant')
      if (!payload.own) {
        // Connected before Claude had its own sign-in: refreshing would sign the
        // browser out, so send Claude back through sign-in once.
        const err = new Error('Reconnect TubeOps in Claude so it gets its own sign-in.')
        err.body = { error: 'invalid_grant', error_description: err.message }
        throw err
      }
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
  if (mcpArchived(req)) return send(res, 404, { error: 'Not found' })

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
  if (sub === 'session') return handleConnectorSession(req, res)
  if (sub === 'token') return handleToken(req, res)
  return send(res, 404, { error: 'Not found' })
}
