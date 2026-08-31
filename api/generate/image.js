import { falImageInput } from '../../lib/fal-image.js'
import { falVideoInput } from '../../lib/fal-video.js'
import { evaluateFeature, evaluatePlan, evaluateStudioCredits, toHttp } from '../../lib/enforce.js'
import { creditCharge } from '../../lib/studio-credits.js'
import { hydrateUsage, incrementStudioCredits } from '../../lib/usage-store.js'
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

  const wantVideo = body.kind === 'video' || body.mode === 'video'
  const quality = String(body.resolution || body.quality || '').toUpperCase()
  if (!wantVideo && quality === '4K') {
    const gate = evaluateFeature({ user, feature: 'image_4k' })
    if (!gate.ok) return send(res, 403, { error: gate.message, code: gate.code, requiredTier: gate.requiredTier })
  }

  let built
  try {
    built = wantVideo
      ? falVideoInput(body.model, prompt, {
        aspect: body.aspect_ratio || body.aspect,
        duration: body.duration || body.duration_seconds,
        resolution: String(body.resolution || body.quality || '').toLowerCase(),
        generate_audio: body.generate_audio === true,
        image_urls: Array.isArray(body.image_urls)
          ? body.image_urls
          : (body.image_url ? [body.image_url] : []),
      })
      : falImageInput(body.model, prompt, {
        aspect: body.aspect_ratio || body.aspect,
        num_images: body.num_images,
        resolution: quality || body.resolution,
        image_urls: body.image_urls,
      })
  } catch (e) {
    return send(res, 400, { error: e.message, code: e.code })
  }

  const { endpoint, input, model, size } = built
  const label = wantVideo ? 'Video' : 'Image'
  const charge = creditCharge({
    kind: wantVideo ? 'video' : 'image',
    model: model.id,
    duration: body.duration || body.duration_seconds || input.duration,
    resolution: input.resolution || body.resolution || body.quality,
    generateAudio: input.generate_audio === true,
    numImages: input.num_images || body.num_images,
    aspect: input.aspect_ratio || body.aspect_ratio || body.aspect,
    width: size?.width,
    height: size?.height,
  })
  const usage = await hydrateUsage(user)
  const credits = evaluateStudioCredits({ user, cost: charge, used: usage.studio_credits_used })
  if (!credits.ok) {
    const http = toHttp(credits)
    return send(res, http.status, http.body)
  }

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
        : (data.detail || data.error || data.raw || (label + ' service ' + falRes.status))
      return send(res, 502, { error: String(errText).slice(0, 400) })
    }
    if (!data.request_id || !data.status_url || !data.response_url) {
      return send(res, 502, { error: 'The ' + label.toLowerCase() + ' service did not return a request handle' })
    }
    let remaining = credits.remaining
    try {
      const after = await incrementStudioCredits(user, credits.charge)
      remaining = Math.max(0, credits.limit - (after.studio_credits_used || 0))
    } catch (_) {}
    return send(res, 200, {
      kind: wantVideo ? 'video' : 'image',
      model: model.id,
      endpoint,
      requestId: data.request_id,
      statusUrl: data.status_url,
      responseUrl: data.response_url,
      width: size?.width || null,
      height: size?.height || null,
      creditsCharged: credits.charge,
      creditsRemaining: remaining,
      creditsLimit: credits.limit,
    })
  } catch (e) {
    return send(res, 500, { error: e.message || (label + ' request failed') })
  }
}
