import { deleteGeneration, updateGeneration } from '../../../lib/image-history.js'
import { cors, readJson, requireUser, send } from '../../_lib/http.js'

export const config = { maxDuration: 30 }

export default async function handler(req, res) {
  cors(req, res)
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    return res.end()
  }

  let token
  let user
  try {
    ;({ token, user } = await requireUser(req))
  } catch (e) {
    return send(res, e.status || 401, e.body || { error: e.message || 'Unauthorized' })
  }

  const fromQuery = String([].concat(req.query?.id || []).join('') || '').trim()
  const fromPath = String(req.url || '').split('?')[0].split('/').filter(Boolean).pop() || ''
  const id = fromQuery || fromPath
  if (!id || id === 'images') return send(res, 400, { error: 'Missing id' })

  try {
    if (req.method === 'PATCH') {
      const body = await readJson(req)
      const rec = await updateGeneration(token, id, { favorited: body.favorited }, user)
      if (!rec) return send(res, 404, { error: 'Not found' })
      return send(res, 200, rec)
    }
    if (req.method === 'DELETE') {
      const ok = await deleteGeneration(token, id, user)
      if (!ok) return send(res, 404, { error: 'Not found' })
      return send(res, 200, { ok: true })
    }
    return send(res, 405, { error: 'Method not allowed' })
  } catch (e) {
    return send(res, e.status || 500, { error: e.message || 'Request failed' })
  }
}
