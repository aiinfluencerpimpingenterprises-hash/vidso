import { falImageInput } from '../../lib/fal-image.js'
import { evaluateFeature, evaluatePlan } from '../../lib/enforce.js'
import { cors, readJson, requireUser, send } from '../_lib/http.js'

export const config = { maxDuration: 30 }

function falKey() {
  return String(process.env.FAL_KEY || process.env.FAL_API_KEY || '').replace(/^Key\s+/i, '').trim()
}

export default async function handler(req, res) {
  cors(req, res)
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    return res.end()
  }
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' })

  let user
  try {
    ;({ user } = await requireUser(req))
  } catch (e) {
    return send(res, e.status || 401, e.body || { error: e.message || 'Unauthorized' })
  }

  const plan = evaluatePlan(user)
  if (!plan.ok) return send(res, plan.status || 401, { error: plan.message, code: plan.code })

  const key = falKey()
  if (!key) return send(res, 501, { error: 'Image generation is not configured on this deployment.' })

  const body = await readJson(req)
  const prompt = String(body.prompt || '').trim()
  if (!prompt) return send(res, 400, { error: 'Enter a prompt' })

  const quality = String(body.resolution || body.quality || '').toUpperCase()
  if (quality === '4K') {
    const gate = evaluateFeature({ user, feature: 'image_4k' })
    if (!gate.ok) return send(res, 403, { error: gate.message, code: gate.code, requiredTier: gate.requiredTier })
  }

  let built
  try {
    built = falImageInput(body.model, prompt, {
      aspect: body.aspect_ratio || body.aspect,
      num_images: body.num_images,
      resolution: quality || body.resolution,
      image_urls: body.image_urls,
    })
  } catch (e) {
    return send(res, e.code === 'no_image_input' ? 400 : 400, { error: e.message, code: e.code })
  }

  const { endpoint, input, model, size } = built

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
        : (data.detail || data.error || data.raw || ('Image service ' + falRes.status))
      return send(res, 502, { error: String(errText).slice(0, 400) })
    }
    if (!data.request_id || !data.status_url || !data.response_url) {
      return send(res, 502, { error: 'The image service did not return a request handle' })
    }
    return send(res, 200, {
      model: model.id,
      endpoint,
      requestId: data.request_id,
      statusUrl: data.status_url,
      responseUrl: data.response_url,
      width: size?.width || null,
      height: size?.height || null,
    })
  } catch (e) {
    return send(res, 500, { error: e.message || 'Image request failed' })
  }
}
