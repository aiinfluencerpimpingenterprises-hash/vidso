import { cors, readJson, requireUser, send } from '../_lib/http.js'
import { railwayUpload } from '../../lib/railway-files.js'

export const config = { maxDuration: 60 }

export default async function handler(req, res) {
  cors(req, res)
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    return res.end()
  }
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' })

  let token
  try {
    ;({ token } = await requireUser(req))
  } catch (e) {
    return send(res, e.status || 401, e.body || { error: e.message || 'Unauthorized' })
  }

  const body = await readJson(req)
  const urls = Array.isArray(body?.urls) ? body.urls.map((u) => String(u || '').trim()).filter(Boolean) : []
  if (urls.length < 2) return send(res, 400, { error: 'Need at least two voiceover parts' })
  if (urls.length > 12) return send(res, 400, { error: 'Too many voiceover parts' })

  const parts = []
  for (const url of urls) {
    if (!/^https?:\/\//i.test(url)) return send(res, 400, { error: 'Invalid voiceover URL' })
    const got = await fetch(url)
    if (!got.ok) return send(res, 502, { error: 'Could not read a voiceover part' })
    parts.push(Buffer.from(await got.arrayBuffer()))
  }

  try {
    const rec = await railwayUpload(token, {
      buffer: Buffer.concat(parts),
      filename: 'vidso-voiceover.mp3',
      mime: 'audio/mpeg',
    })
    return send(res, 200, rec)
  } catch (e) {
    return send(res, e.status || 502, { error: e.message || 'Could not save the merged voiceover' })
  }
}
