import { cors, readJson, requireUser, send } from '../_lib/http.js'
import { requireMcpUser } from '../_lib/mcp-user.js'
import { handleMcpBody } from '../../lib/mcp-rpc.js'
import { issueMcpToken, loadMcpRecord, publicMcpStatus, revokeMcpToken } from '../../lib/mcp-auth.js'
import { mcpServerInfo, publicMcpTools, VERIFIED_MCP_CLIENTS } from '../../lib/mcp-registry.js'

export const config = { maxDuration: 300 }

function pathOf(req) {
  return [].concat(req.query.path || []).join('/')
}

function catalog(req) {
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim()
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'vidso.pro').split(',')[0].trim()
  const origin = proto + '://' + host
  return {
    server: { ...mcpServerInfo(), url: origin + '/api/mcp' },
    tools: publicMcpTools(),
    clients: VERIFIED_MCP_CLIENTS,
  }
}

export default async function handler(req, res) {
  cors(req, res)
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, MCP-Protocol-Version')
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    return res.end()
  }

  const sub = pathOf(req)

  if ((sub === '' || sub === 'tools') && req.method === 'GET') {
    return send(res, 200, catalog(req))
  }

  if (sub === 'status' && req.method === 'GET') {
    let token
    try { ;({ token } = await requireUser(req)) } catch (e) {
      return send(res, e.status || 401, e.body || { error: e.message || 'Unauthorized' })
    }
    const rec = await loadMcpRecord(token)
    return send(res, 200, publicMcpStatus(rec, req))
  }

  if (sub === 'token' && req.method === 'POST') {
    let user
    let token
    try { ;({ user, token } = await requireUser(req)) } catch (e) {
      return send(res, e.status || 401, e.body || { error: e.message || 'Unauthorized' })
    }
    const issued = await issueMcpToken(token, user, req)
    return send(res, 200, issued)
  }

  if (sub === 'revoke' && req.method === 'POST') {
    let token
    try { ;({ token } = await requireUser(req)) } catch (e) {
      return send(res, e.status || 401, e.body || { error: e.message || 'Unauthorized' })
    }
    return send(res, 200, await revokeMcpToken(token, req))
  }

  if (req.method !== 'POST') {
    res.statusCode = 405
    res.setHeader('Allow', 'GET,POST,OPTIONS')
    return res.end()
  }

  let token
  try {
    ;({ token } = await requireMcpUser(req))
  } catch (e) {
    return send(res, e.status || 401, e.body || { error: e.message || 'Unauthorized' })
  }

  const body = await readJson(req)
  return handleMcpBody(req, res, token, body)
}
