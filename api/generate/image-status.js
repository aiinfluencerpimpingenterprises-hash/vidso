import { dimsFromFalResult, urlsFromFalResult } from '../../lib/fal-image.js'
import { urlsFromFalVideoResult } from '../../lib/fal-video.js'
import { cors, readJson, requireUser, send } from '../_lib/http.js'
import { claimFalRefund, readFalJobHandle, requestIdFromQueueUrl } from '../_lib/fal-job.js'
import { addSceneAllowance, releaseStudioCredits } from '../../lib/usage-store.js'

export const config = { maxDuration: 30 }

function falKey() {
  return String(process.env.FAL_KEY || process.env.FAL_API_KEY || '').replace(/^Key\s+/i, '').trim()
}

function errorText(value) {
  if (!value) return ''
  if (typeof value === 'string') return value
  return String(value.message || value.msg || JSON.stringify(value))
}

function isQueueUrl(url) {
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

  let user
  try {
    ;({ user } = await requireUser(req))
  } catch (e) {
    return send(res, e.status || 401, e.body || { error: e.message || 'Unauthorized' })
  }

  const key = falKey()
  if (!key) return send(res, 501, { error: 'Image generation is not configured on this deployment.' })

  const body = await readJson(req)
  const statusUrl = body.statusUrl
  const responseUrl = body.responseUrl
  if (!isQueueUrl(statusUrl) || !isQueueUrl(responseUrl)) {
    return send(res, 400, { error: 'Missing generation handle' })
  }

  // A job fal says failed is final: give back what it held (once, to its owner)
  // and answer 422 so the client stops polling. Old clients send no handle and
  // get the same 422 without a refund.
  const failed = async (message) => {
    let refunded = 0
    let sceneBack = false
    const job = readFalJobHandle(body.handle, user)
    const rid = requestIdFromQueueUrl(statusUrl)
    if (job && rid && job.rid === rid && (job.charge > 0 || job.free) && await claimFalRefund(rid)) {
      if (job.charge > 0) {
        try { await releaseStudioCredits(user, job.charge); refunded = job.charge } catch (_) {}
      }
      if (job.free) {
        try { await addSceneAllowance(user, 1); sceneBack = true } catch (_) {}
      }
    }
    return send(res, 422, {
      error: String(message || 'Generation failed').slice(0, 400),
      code: 'generation_failed',
      refunded,
      ...(sceneBack ? { sceneRefunded: true } : {}),
    })
  }

  try {
    const st = await fetch(statusUrl, { headers: { Authorization: 'Key ' + key } })
    const stText = await st.text()
    let status
    try { status = JSON.parse(stText) } catch { status = {} }
    if (!st.ok) {
      const errText = Array.isArray(status.detail)
        ? status.detail.map((d) => d.msg || d.message || JSON.stringify(d)).join('; ')
        : (status.detail || status.error || ('Image status ' + st.status))
      return send(res, 502, { error: String(errText).slice(0, 400) })
    }
    const state = String(status.status || '').toUpperCase()
    if (state === 'FAILED' || state === 'CANCELLED' || state === 'CANCELED' || state === 'ERROR') {
      return failed(errorText(status.error) || ('Generation ' + state.toLowerCase()))
    }
    if (state !== 'COMPLETED') return send(res, 200, { done: false })
    // fal reports some failed jobs as COMPLETED with an error attached.
    if (status.error) return failed(errorText(status.error))

    const r = await fetch(responseUrl, { headers: { Authorization: 'Key ' + key } })
    const rText = await r.text()
    let result
    try { result = JSON.parse(rText) } catch { result = {} }
    if (!r.ok) {
      const errText = Array.isArray(result.detail)
        ? result.detail.map((d) => d.msg || d.message || JSON.stringify(d)).join('; ')
        : (result.detail || result.error || ('Image result ' + r.status))
      // 422 is fal rejecting the finished job (bad input, safety filter): final.
      if (r.status === 422) return failed(errText)
      return send(res, 502, { error: String(errText).slice(0, 400) })
    }
    const imageUrls = urlsFromFalResult(result)
    const videoUrls = urlsFromFalVideoResult(result)
    const urls = [...new Set(videoUrls.concat(imageUrls))]
    if (!urls.length) return send(res, 502, { error: 'No media came back' })
    const dims = dimsFromFalResult(result)
    return send(res, 200, {
      done: true,
      kind: videoUrls.length ? 'video' : 'image',
      urls,
      width: dims?.width || null,
      height: dims?.height || null,
    })
  } catch (e) {
    return send(res, 500, { error: e.message || 'Status check failed' })
  }
}
