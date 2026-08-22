import { urlsFromFalResult } from '../../lib/fal-image.js'

export const config = { maxDuration: 30 }

const UPSTREAM = process.env.UPSTREAM_API || 'https://vibrant-patience-production-a7f0.up.railway.app'

function falKey() {
  return String(process.env.FAL_KEY || process.env.FAL_API_KEY || '').replace(/^Key\s+/i, '').trim()
}

function send(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

function cors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
}

async function readJson(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body
  const chunks = []
  for await (const c of req) chunks.push(c)
  if (!chunks.length) return {}
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') } catch { return {} }
}

function isFalQueueUrl(url) {
  try {
    const u = new URL(String(url || ''))
    return u.protocol === 'https:' && u.hostname === 'queue.fal.run'
  } catch {
    return false
  }
}

export default async function handler(req, res) {
  cors(req, res)
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    return res.end()
  }
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' })

  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return send(res, 401, { error: 'Missing token' })
  try {
    const me = await fetch(UPSTREAM + '/api/user/me', { headers: { Authorization: 'Bearer ' + token } })
    if (!me.ok) return send(res, me.status, { error: 'Unauthorized' })
  } catch {
    return send(res, 401, { error: 'Unauthorized' })
  }

  const key = falKey()
  if (!key) return send(res, 501, { error: 'FAL_KEY is not set on this deployment.' })

  const body = await readJson(req)
  const statusUrl = body.statusUrl
  const responseUrl = body.responseUrl
  if (!isFalQueueUrl(statusUrl) || !isFalQueueUrl(responseUrl)) {
    return send(res, 400, { error: 'Missing fal handle' })
  }

  try {
    const st = await fetch(statusUrl, { headers: { Authorization: 'Key ' + key } })
    const stText = await st.text()
    let status
    try { status = JSON.parse(stText) } catch { status = {} }
    if (!st.ok) return send(res, 502, { error: status.detail || status.error || ('fal status ' + st.status) })
    if (status.status === 'FAILED' || status.status === 'CANCELLED') {
      return send(res, 500, { error: status.error || ('Generation ' + String(status.status).toLowerCase()) })
    }
    if (status.status !== 'COMPLETED') return send(res, 200, { done: false })

    const r = await fetch(responseUrl, { headers: { Authorization: 'Key ' + key } })
    const rText = await r.text()
    let result
    try { result = JSON.parse(rText) } catch { result = {} }
    if (!r.ok) return send(res, 502, { error: result.detail || result.error || ('fal result ' + r.status) })
    const urls = urlsFromFalResult(result)
    if (!urls.length) return send(res, 502, { error: 'No image URL in fal result' })
    return send(res, 200, { done: true, urls })
  } catch (e) {
    return send(res, 500, { error: e.message || 'Fal status failed' })
  }
}


function send(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

function cors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
}

async function readJson(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body
  const chunks = []
  for await (const c of req) chunks.push(c)
  if (!chunks.length) return {}
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') } catch { return {} }
}

function isFalQueueUrl(url) {
  try {
    const u = new URL(String(url || ''))
    return u.protocol === 'https:' && u.hostname === 'queue.fal.run'
  } catch {
    return false
  }
}

export default async function handler(req, res) {
  cors(req, res)
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    return res.end()
  }
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' })

  const key = falKey()
  if (!key) return send(res, 501, { error: 'FAL_KEY is not set on this deployment.' })

  const body = await readJson(req)
  const statusUrl = body.statusUrl
  const responseUrl = body.responseUrl
  if (!isFalQueueUrl(statusUrl) || !isFalQueueUrl(responseUrl)) {
    return send(res, 400, { error: 'Missing fal handle' })
  }

  try {
    const st = await fetch(statusUrl, { headers: { Authorization: 'Key ' + key } })
    const stText = await st.text()
    let status
    try { status = JSON.parse(stText) } catch { status = {} }
    if (!st.ok) return send(res, 502, { error: status.detail || status.error || ('fal status ' + st.status) })
    if (status.status === 'FAILED' || status.status === 'CANCELLED') {
      return send(res, 500, { error: status.error || ('Generation ' + String(status.status).toLowerCase()) })
    }
    if (status.status !== 'COMPLETED') return send(res, 200, { done: false })

    const r = await fetch(responseUrl, { headers: { Authorization: 'Key ' + key } })
    const rText = await r.text()
    let result
    try { result = JSON.parse(rText) } catch { result = {} }
    if (!r.ok) return send(res, 502, { error: result.detail || result.error || ('fal result ' + r.status) })
    const urls = urlsFromFalResult(result)
    if (!urls.length) return send(res, 502, { error: 'No image URL in fal result' })
    return send(res, 200, { done: true, urls })
  } catch (e) {
    return send(res, 500, { error: e.message || 'Fal status failed' })
  }
}
