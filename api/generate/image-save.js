import { persistGeneration } from '../../lib/image-history.js'
import { cors, readJson, requireUser, send } from '../_lib/http.js'

export const config = { maxDuration: 60 }

export default async function handler(req, res) {
  cors(req, res)
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    return res.end()
  }
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' })

  let user
  let token
  try {
    ;({ user, token } = await requireUser(req))
  } catch (e) {
    return send(res, e.status || 401, e.body || { error: e.message || 'Unauthorized' })
  }

  const body = await readJson(req)
  const urls = Array.isArray(body.urls) ? body.urls.map(String).filter(Boolean) : []
  const single = body.url ? [String(body.url)] : []
  const list = urls.length ? urls : single
  if (!list.length) return send(res, 400, { error: 'Missing image URL' })

  try {
    const items = []
    for (let i = 0; i < list.length; i++) {
      const rec = await persistGeneration(token, user, {
        url: list[i],
        prompt: body.prompt,
        model: body.model,
        aspect_ratio: body.aspect_ratio,
        quality: body.quality || body.resolution,
        batch_index: body.batch_index != null ? body.batch_index : i,
        width: body.width,
        height: body.height,
        reference_images: body.reference_images || body.image_urls || [],
      })
      items.push(rec)
    }
    return send(res, 200, { items })
  } catch (e) {
    return send(res, e.status || 500, { error: e.message || 'Could not save the image' })
  }
}
