import { fulfillWhopEvent, verifyWhopWebhook } from '../../lib/whop-webhook.js'

export const config = { maxDuration: 15 }

function send(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

async function readRaw(req) {
  if (typeof req.body === 'string') return req.body
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8')
  const chunks = []
  for await (const c of req) chunks.push(c)
  return Buffer.concat(chunks).toString('utf8')
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    return res.end()
  }
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' })

  const secret = String(process.env.WHOP_WEBHOOK_SECRET || '').trim()
  if (!secret) return send(res, 503, { error: 'WHOP_WEBHOOK_SECRET is not set.' })

  let event
  try {
    const raw = await readRaw(req)
    event = verifyWhopWebhook(raw, req.headers, secret)
  } catch (e) {
    return send(res, e.status || 401, { error: e.message || 'Invalid signature' })
  }

  try {
    const result = await fulfillWhopEvent(event)
    return send(res, 200, { received: true, ...result })
  } catch (e) {
    if (e.code === 'membership_taken') return send(res, 200, { received: true, skipped: 'membership_taken' })
    return send(res, 500, { error: e.message || 'Fulfillment failed' })
  }
}
