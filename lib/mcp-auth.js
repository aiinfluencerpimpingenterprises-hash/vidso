/** MCP connector tokens. A signed wrapper around the Vidso session, revocable from Connections. */

import { randomBytes } from 'node:crypto'
import { fetchJsonUrl, railwayDelete, railwayList, railwayUpload } from './railway-files.js'
import { encryptRecord, decryptRecord, signPayload, verifyPayload } from './youtube.js'

export const MCP_FILENAME = 'vidso-mcp.json'

export function isMcpSidecarName(name) {
  return String(name || '') === MCP_FILENAME
}

async function loadRaw(token) {
  const files = await railwayList(token)
  const hit = files.find((f) => isMcpSidecarName(f.original_name || f.name))
  if (!hit?.url) return null
  const json = await fetchJsonUrl(hit.url)
  const rec = decryptRecord(json)
  rec._file_id = hit.id
  return rec
}

async function saveRaw(token, record) {
  const prevId = record._file_id
  const stored = { ...record }
  delete stored._file_id
  const uploaded = await railwayUpload(token, {
    buffer: Buffer.from(JSON.stringify(encryptRecord(stored))),
    filename: MCP_FILENAME,
    mime: 'application/json',
  })
  if (prevId && prevId !== uploaded.id) {
    try { await railwayDelete(token, prevId) } catch (_) {}
  }
  stored._file_id = uploaded.id
  return stored
}

export async function deleteMcpRecord(token) {
  const rec = await loadRaw(token).catch(() => null)
  if (rec?._file_id) {
    try { await railwayDelete(token, rec._file_id) } catch (_) {}
  }
}

export function mcpOrigin(req) {
  const xfHost = String(req?.headers?.['x-forwarded-host'] || '').split(',')[0].trim()
  const host = xfHost || String(req?.headers?.host || 'vidso.pro').split(',')[0].trim()
  const proto = String(req?.headers?.['x-forwarded-proto'] || 'https').split(',')[0].trim()
  return proto + '://' + host
}

export function mcpConnectorUrl(origin, token) {
  const base = String(origin || '').replace(/\/$/, '') + '/api/mcp'
  if (!token) return base
  return base + '?token=' + encodeURIComponent(token)
}

export function mintMcpConnector(sessionToken, nonce) {
  return signPayload({
    k: 'mcp',
    t: sessionToken,
    n: nonce,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 30,
  })
}

/** Bearer header first, then ?token= for Claude Customize → Connectors. */
export function mcpCredentialFromRequest(req) {
  const header = String(req?.headers?.authorization || '').replace(/^Bearer\s+/i, '').trim()
  if (header) return header
  const q = req?.query?.token
  if (q != null && q !== '') return String(Array.isArray(q) ? q[0] : q).trim()
  try {
    const u = new URL(req.url || '', 'https://vidso.pro')
    return String(u.searchParams.get('token') || '').trim()
  } catch (_) {
    return ''
  }
}

export function publicMcpStatus(record, req, extra = {}) {
  const sessionToken = extra.sessionToken
  const rest = { ...extra }
  delete rest.sessionToken
  const origin = mcpOrigin(req)
  const issued = !!(record && record.nonce)
  const out = {
    issued,
    mcpUrl: origin + '/api/mcp',
    connectorUrl: origin + '/api/mcp',
    lastUsedAt: record?.last_used_at || null,
    createdAt: record?.created_at || null,
    ...rest,
  }
  if (issued && sessionToken) {
    const connector = mintMcpConnector(sessionToken, record.nonce)
    out.token = connector
    out.connectorUrl = mcpConnectorUrl(origin, connector)
  }
  return out
}

export async function loadMcpRecord(token) {
  return loadRaw(token).catch(() => null)
}

export async function issueMcpToken(token, user, req) {
  const nonce = randomBytes(16).toString('hex')
  const rec = {
    nonce,
    created_at: new Date().toISOString(),
    last_used_at: null,
    user_id: String(user?.id || user?.user_id || user?.email || ''),
  }
  const prev = await loadRaw(token).catch(() => null)
  if (prev?._file_id) rec._file_id = prev._file_id
  await saveRaw(token, rec)
  return publicMcpStatus(rec, req, { sessionToken: token })
}

export async function revokeMcpToken(token, req) {
  await deleteMcpRecord(token)
  return publicMcpStatus(null, req)
}

export async function touchMcpUse(sessionToken) {
  const rec = await loadRaw(sessionToken).catch(() => null)
  if (!rec?.nonce) return
  rec.last_used_at = new Date().toISOString()
  await saveRaw(sessionToken, rec)
}

export function parseMcpBearer(raw) {
  const token = String(raw || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return null
  try {
    const payload = verifyPayload(token)
    if (payload?.k === 'mcp' && payload.t && payload.n) return payload
  } catch (_) {}
  return null
}

export async function sessionTokenFromMcpBearer(raw) {
  const payload = parseMcpBearer(raw)
  if (!payload) return null
  const rec = await loadRaw(payload.t)
  if (!rec || rec.nonce !== payload.n) {
    const err = new Error('This MCP token was revoked. Issue a new one from Connections.')
    err.status = 401
    throw err
  }
  return payload.t
}
