import { cors, readJson, send } from '../_lib/http.js'
import { buildCapiEvent, capiUserData, CLIENT_CAPI_EVENTS, sanitizeTestCode, sendMetaEvents } from '../../lib/meta-capi.js'

export const config = { maxDuration: 10 }

function clientIp(req) {
  const xf = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
  return xf || String(req.headers['x-real-ip'] || '') || ''
}

export default async function handler(req, res) {
  cors(req, res)
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    return res.end()
  }
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' })

  const body = await readJson(req).catch(() => ({}))
  const eventName = String(body.event_name || body.event || '').trim()
  if (!CLIENT_CAPI_EVENTS.has(eventName)) return send(res, 400, { error: 'Unsupported event' })

  const result = await sendMetaEvents([
    buildCapiEvent({
      eventName,
      eventId: body.event_id,
      eventSourceUrl: String(body.event_source_url || req.headers.referer || 'https://vidso.pro/').slice(0, 2048),
      userData: capiUserData({
        email: body.email,
        userId: body.user_id || body.userId,
        fbp: body.fbp,
        fbc: body.fbc,
        ip: clientIp(req),
        ua: req.headers['user-agent'],
      }),
      customData: body.custom_data && typeof body.custom_data === 'object' ? body.custom_data : {},
    }),
  ], process.env, { testEventCode: sanitizeTestCode(body.test_event_code) })

  return send(res, 200, { received: true, pixel: result.skipped || (result.ok ? 'sent' : 'failed') })
}
