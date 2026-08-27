import { requireUser } from './http.js'
import { mcpCredentialFromRequest, sessionTokenFromMcpBearer } from '../../lib/mcp-auth.js'

/** Session token, or a Connections-issued MCP token wrapping that session. */
export async function requireMcpUser(req) {
  const raw = mcpCredentialFromRequest(req)
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
