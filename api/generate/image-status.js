import { dimsFromFalResult, urlsFromFalResult } from '../../lib/fal-image.js'
import { urlsFromFalVideoResult } from '../../lib/fal-video.js'
import { cors, readJson, requireUser, send } from '../_lib/http.js'

export const config = { maxDuration: 30 }

function falKey() {
  return String(process.env.FAL_KEY || process.env.FAL_API_KEY || '').replace(/^Key\s+/i, '').trim()
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

  try {
    await requireUser(req)
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
    if (status.status === 'FAILED' || status.status === 'CANCELLED') {
      return send(res, 500, { error: status.error || ('Generation ' + String(status.status).toLowerCase()) })
    }
    if (status.status !== 'COMPLETED') return send(res, 200, { done: false })

    const r = await fetch(responseUrl, { headers: { Authorization: 'Key ' + key } })
    const rText = await r.text()
    let result
    try { result = JSON.parse(rText) } catch { result = {} }
    if (!r.ok) {
      const errText = Array.isArray(result.detail)
        ? result.detail.map((d) => d.msg || d.message || JSON.stringify(d)).join('; ')
        : (result.detail || result.error || ('Image result ' + r.status))
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
