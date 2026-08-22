import { falImageInput } from '../../lib/fal-image.js'

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

async function requireUser(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) {
    const err = new Error('Missing token')
    err.status = 401
    throw err
  }
  const res = await fetch(UPSTREAM + '/api/user/me', { headers: { Authorization: 'Bearer ' + token } })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.message || data.error || 'Unauthorized')
    err.status = res.status
    err.body = data
    throw err
  }
  return data
}

export default async function handler(req, res) {
  cors(req, res)
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    return res.end()
  }
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' })

  try {
    await requireUser(req)
  } catch (e) {
    return send(res, e.status || 401, e.body || { error: e.message || 'Unauthorized' })
  }

  const key = falKey()
  if (!key) return send(res, 501, { error: 'FAL_KEY is not set on this deployment.' })

  const body = await readJson(req)
  const prompt = String(body.prompt || '').trim()
  if (!prompt) return send(res, 400, { error: 'Enter a prompt' })

  const { endpoint, input, model } = falImageInput(body.model, prompt, {
    aspect: body.aspect_ratio || body.aspect,
    num_images: body.num_images,
    resolution: body.resolution,
  })

  try {
    const falRes = await fetch('https://queue.fal.run/' + endpoint, {
      method: 'POST',
      headers: { Authorization: 'Key ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    const text = await falRes.text()
    let data
    try { data = JSON.parse(text) } catch { data = { raw: text } }
    if (!falRes.ok) {
      const errText = Array.isArray(data.detail)
        ? data.detail.map((d) => d.msg || d.message || JSON.stringify(d)).join('; ')
        : (data.detail || data.error || data.raw || ('fal ' + falRes.status))
      return send(res, 502, { error: String(errText).slice(0, 400) })
    }
    if (!data.request_id || !data.status_url || !data.response_url) {
      return send(res, 502, { error: 'fal did not return a request handle' })
    }
    return send(res, 200, {
      model: model.id,
      endpoint,
      requestId: data.request_id,
      statusUrl: data.status_url,
      responseUrl: data.response_url,
    })
  } catch (e) {
    return send(res, 500, { error: e.message || 'Fal request failed' })
  }
}
