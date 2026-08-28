import { cors, readJson, requireUser, send } from '../_lib/http.js'
import {
  addAsset,
  addJob,
  createProject,
  deleteProject,
  duplicateProject,
  findProject,
  FS_FILE_PREFIX,
  listJobs,
  listProjects,
  patchJob,
  persistBinary,
  publicProject,
  updateProject,
} from '../../lib/faceless-studio-store.js'

export const config = { maxDuration: 60 }

const UPSTREAM = process.env.UPSTREAM_API || 'https://vibrant-patience-production-a7f0.up.railway.app'

function pathOf(req) {
  return [].concat(req.query.path || []).join('/')
}

function partsOf(path) {
  return String(path || '').replace(/^\/+|\/+$/g, '').split('/').filter(Boolean)
}

async function ingestExport(token, projectId, user, renderJobId) {
  const rec = await findProject(token, projectId, user)
  if (!rec) return { status: 404, body: { error: 'Project not found' } }
  const res = await fetch(
    UPSTREAM + '/api/faceless/render/' + encodeURIComponent(renderJobId) + '/download',
    { headers: { Authorization: 'Bearer ' + token } },
  )
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { status: res.status, body: { error: data.error || data.message || 'Could not download render' } }
  }
  const buf = Buffer.from(await res.arrayBuffer())
  const mime = String(res.headers.get('content-type') || 'video/mp4').split(';')[0]
  const uploaded = await persistBinary(token, {
    buffer: buf,
    filename: FS_FILE_PREFIX + String(projectId).slice(0, 8) + '-export.mp4',
    mime,
  })
  const added = await addAsset(token, projectId, user, {
    type: 'export',
    storage_url: uploaded.url,
    file_id: uploaded.id,
    mime,
    label: rec.title || 'Export',
  })
  const project = await updateProject(token, projectId, user, { status: 'ready' })
  return { status: 200, body: { asset: added.asset, project } }
}

async function persistRefs(token, projectId, user, refs) {
  const rec = await findProject(token, projectId, user)
  if (!rec) return null
  const list = Array.isArray(refs) ? refs.slice(0, 4) : []
  const out = []
  for (let i = 0; i < list.length; i++) {
    const raw = list[i]
    const url = typeof raw === 'string' ? raw : String(raw?.url || '')
    if (/^https?:\/\//i.test(url)) {
      out.push({ url, file_id: typeof raw === 'object' ? (raw.file_id || '') : '' })
      continue
    }
    const m = url.match(/^data:([^;]+);base64,(.+)$/)
    if (!m) continue
    const uploaded = await persistBinary(token, {
      buffer: Buffer.from(m[2], 'base64'),
      filename: FS_FILE_PREFIX + String(projectId).slice(0, 8) + '-ref-' + i + '.jpg',
      mime: m[1] || 'image/jpeg',
    })
    out.push({ url: uploaded.url, file_id: uploaded.id })
  }
  return updateProject(token, projectId, user, { references: out })
}

async function ingestMedia(token, projectId, user, body) {
  const rec = await findProject(token, projectId, user)
  if (!rec) return null
  const voiceUrl = String(body.voiceover_url || body.voiceoverUrl || '')
  if (voiceUrl) {
    const exists = (rec.assets || []).some((a) => a.type === 'voiceover' && a.storage_url === voiceUrl)
    if (!exists) {
      await addAsset(token, projectId, user, {
        type: 'voiceover',
        storage_url: voiceUrl,
        mime: String(body.voiceover_mime || 'audio/mpeg'),
        label: 'Voiceover',
        duration_seconds: body.duration_seconds,
      })
    }
  }
  const words = Array.isArray(body.words) ? body.words : null
  const hasCaptions = (rec.assets || []).some((a) => a.type === 'captions')
  if (words && words.length && !hasCaptions) {
    const uploaded = await persistBinary(token, {
      buffer: Buffer.from(JSON.stringify(words)),
      filename: FS_FILE_PREFIX + String(projectId).slice(0, 8) + '-captions.json',
      mime: 'application/json',
    })
    await addAsset(token, projectId, user, {
      type: 'captions',
      storage_url: uploaded.url,
      file_id: uploaded.id,
      mime: 'application/json',
      label: 'Captions',
    })
  }
  return findProject(token, projectId, user)
}

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

  const segs = partsOf(pathOf(req))
  const q = new URL(req.url, 'http://localhost').searchParams
  const offset = Math.max(0, parseInt(q.get('offset') || '0', 10) || 0)
  const limit = Math.min(60, Math.max(1, parseInt(q.get('limit') || '24', 10) || 24))

  try {
    if (segs[0] === 'jobs' && req.method === 'GET') {
      const data = await listJobs(token, user, {
        offset,
        limit,
        favorites: q.get('favorites') === '1',
        project_id: q.get('project_id') || '',
      })
      return send(res, 200, data)
    }

    if (segs[0] === 'projects' && segs.length === 1 && req.method === 'GET') {
      const data = await listProjects(token, user, {
        q: q.get('q') || '',
        sort: q.get('sort') || 'updated',
        favorites: q.get('favorites') === '1',
        visibility: q.get('visibility') || '',
        offset,
        limit,
      })
      return send(res, 200, data)
    }

    if (segs[0] === 'projects' && segs.length === 1 && req.method === 'POST') {
      const body = await readJson(req)
      const project = await createProject(token, user, body)
      return send(res, 201, { project })
    }

    if (segs[0] === 'projects' && segs[1] && segs.length === 2 && req.method === 'GET') {
      const rec = await findProject(token, segs[1], user)
      if (!rec) return send(res, 404, { error: 'Project not found' })
      return send(res, 200, { project: publicProject(rec) })
    }

    if (segs[0] === 'projects' && segs[1] && segs.length === 2 && req.method === 'PATCH') {
      const body = await readJson(req)
      const project = await updateProject(token, segs[1], user, body)
      if (!project) return send(res, 404, { error: 'Project not found' })
      return send(res, 200, { project })
    }

    if (segs[0] === 'projects' && segs[1] && segs.length === 2 && req.method === 'DELETE') {
      const ok = await deleteProject(token, segs[1], user)
      if (!ok) return send(res, 404, { error: 'Project not found' })
      return send(res, 200, { ok: true })
    }

    if (segs[0] === 'projects' && segs[2] === 'duplicate' && req.method === 'POST') {
      const project = await duplicateProject(token, segs[1], user)
      if (!project) return send(res, 404, { error: 'Project not found' })
      return send(res, 201, { project })
    }

    if (segs[0] === 'projects' && segs[2] === 'refs' && req.method === 'POST') {
      const body = await readJson(req)
      const project = await persistRefs(token, segs[1], user, body.references || body.refs)
      if (!project) return send(res, 404, { error: 'Project not found' })
      return send(res, 200, { project })
    }

    if (segs[0] === 'projects' && segs[2] === 'assets' && req.method === 'POST') {
      const body = await readJson(req)
      const added = await addAsset(token, segs[1], user, body)
      if (!added) return send(res, 404, { error: 'Project not found' })
      return send(res, 201, added)
    }

    if (segs[0] === 'projects' && segs[2] === 'jobs' && segs.length === 3 && req.method === 'POST') {
      const body = await readJson(req)
      const added = await addJob(token, segs[1], user, body)
      if (!added) return send(res, 404, { error: 'Project not found' })
      return send(res, 201, added)
    }

    if (segs[0] === 'projects' && segs[2] === 'jobs' && segs[3] && req.method === 'PATCH') {
      const body = await readJson(req)
      const patched = await patchJob(token, segs[1], user, segs[3], body)
      if (!patched) return send(res, 404, { error: 'Job not found' })
      return send(res, 200, patched)
    }

    if (segs[0] === 'projects' && segs[2] === 'ingest-export' && req.method === 'POST') {
      const body = await readJson(req)
      const jobId = body.renderJobId || body.jobId
      if (!jobId) return send(res, 400, { error: 'renderJobId is required' })
      const out = await ingestExport(token, segs[1], user, jobId)
      return send(res, out.status, out.body)
    }

    if (segs[0] === 'projects' && segs[2] === 'ingest-media' && req.method === 'POST') {
      const body = await readJson(req)
      const rec = await ingestMedia(token, segs[1], user, body)
      if (!rec) return send(res, 404, { error: 'Project not found' })
      return send(res, 200, { project: publicProject(rec) })
    }

    return send(res, 404, { error: 'Not found' })
  } catch (e) {
    return send(res, e.status || 500, { error: e.message || 'Studio request failed' })
  }
}
