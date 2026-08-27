import { requireUser } from './http.js'
import { sessionTokenFromMcpBearer } from '../../lib/mcp-auth.js'

function bearer(req) {
  return String(req?.headers?.authorization || '').replace(/^Bearer\s+/i, '').trim()
}

/** Session token, or a Connections-issued MCP token wrapping that session. */
export async function requireMcpUser(req) {
  const raw = bearer(req)
  const session = await sessionTokenFromMcpBearer(raw).catch((e) => {
    if (e.status === 401) throw e
    return null
  })
  if (session) {
    req.headers = { ...req.headers, authorization: 'Bearer ' + session }
    const out = await requireUser(req)
    return { ...out, mcpToken: true, sessionToken: session }
  }
  const out = await requireUser(req)
  return { ...out, mcpToken: false, sessionToken: out.token }
}
