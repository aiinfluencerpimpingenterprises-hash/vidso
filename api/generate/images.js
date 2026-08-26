import { IMG_PAGE_SIZE } from '../../lib/image-gen.js'
import { listGenerations } from '../../lib/image-history.js'
import { cors, requireUser, send } from '../_lib/http.js'

export const config = { maxDuration: 30 }

export default async function handler(req, res) {
  cors(req, res)
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    return res.end()
  }
  if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' })

  let token
  let user
  try {
    ;({ token, user } = await requireUser(req))
  } catch (e) {
    return send(res, e.status || 401, e.body || { error: e.message || 'Unauthorized' })
  }

  const q = new URL(req.url, 'http://localhost').searchParams
  const offset = Math.max(0, parseInt(q.get('offset') || '0', 10) || 0)
  const limit = Math.min(60, Math.max(1, parseInt(q.get('limit') || String(IMG_PAGE_SIZE), 10) || IMG_PAGE_SIZE))
  const favorites = q.get('favorites') === '1' || q.get('favorites') === 'true'

  try {
    const data = await listGenerations(token, { favorites, offset, limit, user })
    return send(res, 200, data)
  } catch (e) {
    return send(res, e.status || 500, { error: e.message || 'Could not load thumbnails' })
  }
}
