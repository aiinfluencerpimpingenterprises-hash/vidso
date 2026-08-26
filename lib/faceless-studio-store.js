/**
 * Faceless Studio persistence.
 * Live store: one JSON sidecar per project in Railway /api/upload (same per-user
 * object store as thumbnail history). Nested assets and jobs live on the
 * project document so a failed voiceover cannot wipe the script.
 * SQL in server/faceless-studio.sql is the intended table shape once a
 * database client is wired.
 */

import { randomUUID } from 'node:crypto'
import { fetchJsonUrl, railwayDelete, railwayList, railwayUpload } from './railway-files.js'

export const FS_PROJ_PREFIX = 'vidso-fs-proj-'
export const FS_PROJ_SUFFIX = '.json'
export const FS_FILE_PREFIX = 'vidso-fs-file-'

export const PROJECT_STATUSES = ['draft', 'script', 'media', 'preview', 'export', 'ready', 'failed']
export const JOB_STATUSES = ['queued', 'running', 'succeeded', 'failed']
export const ASSET_TYPES = ['script', 'voiceover', 'captions', 'broll', 'music', 'thumbnail', 'export', 'reference']

export function isStudioSidecarName(name) {
  const n = String(name || '')
  return n.startsWith(FS_PROJ_PREFIX) || n.startsWith(FS_FILE_PREFIX)
}

export function projectFileName(id) {
  return FS_PROJ_PREFIX + id + FS_PROJ_SUFFIX
}

export function userIdOf(user) {
  return String(user?.id || user?.user_id || user?.email || '').trim()
}

function nowIso() {
  return new Date().toISOString()
}

function titleFromTopic(topic) {
  const t = String(topic || '').trim().replace(/\s+/g, ' ')
  if (!t) return 'Untitled project'
  return t.slice(0, 72)
}

export function createProjectRecord(user, body = {}) {
  const id = randomUUID()
  const t = nowIso()
  const topic = String(body.topic || body.prompt || '').trim()
  return {
    id,
    user_id: userIdOf(user),
    title: String(body.title || titleFromTopic(topic)).slice(0, 120),
    topic,
    status: 'draft',
    aspect: body.aspect === '9:16' ? '9:16' : '16:9',
    length: String(body.length || body.duration_id || 'long_180'),
    duration_seconds: Number(body.duration_seconds) > 0 ? Number(body.duration_seconds) : 180,
    voice_id: String(body.voice_id || body.voiceId || ''),
    model: String(body.model || 'vidso-faceless'),
    favorited: false,
    created_at: t,
    updated_at: t,
    pipeline: body.pipeline && typeof body.pipeline === 'object' ? body.pipeline : null,
    references: Array.isArray(body.references) ? body.references.slice(0, 4) : [],
    assets: [],
    jobs: [],
  }
}

export function publicProject(rec) {
  if (!rec) return null
  const { _meta_file, ...rest } = rec
  return rest
}

function projectIdFromName(name) {
  const n = String(name || '')
  if (!n.startsWith(FS_PROJ_PREFIX) || !n.endsWith(FS_PROJ_SUFFIX)) return ''
  return n.slice(FS_PROJ_PREFIX.length, n.length - FS_PROJ_SUFFIX.length)
}

async function writeProject(token, rec) {
  const next = { ...rec, updated_at: nowIso() }
  delete next._meta_file
  if (rec.meta_file_id) {
    try { await railwayDelete(token, rec.meta_file_id) } catch (_) {}
  }
  const meta = await railwayUpload(token, {
    buffer: Buffer.from(JSON.stringify(next)),
    filename: projectFileName(next.id),
    mime: 'application/json',
  })
  next.meta_file_id = meta.id
  return next
}

export async function listProjects(token, user, { q = '', sort = 'updated', favorites = false, offset = 0, limit = 24 } = {}) {
  const uid = userIdOf(user)
  const files = await railwayList(token)
  const metas = files.filter((f) => projectIdFromName(f.original_name))
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
  const needle = String(q || '').trim().toLowerCase()
  const matched = []
  for (const file of metas) {
    try {
      const rec = await fetchJsonUrl(file.url)
      if (!rec?.id) continue
      if (uid && rec.user_id && rec.user_id !== uid) continue
      rec.meta_file_id = rec.meta_file_id || file.id
      rec._meta_file = file
      if (favorites && !rec.favorited) continue
      if (needle) {
        const hay = (rec.title + ' ' + rec.topic + ' ' + rec.status).toLowerCase()
        if (!hay.includes(needle)) continue
      }
      matched.push(rec)
    } catch (_) {}
  }
  matched.sort((a, b) => {
    if (sort === 'title') return String(a.title || '').localeCompare(String(b.title || ''))
    if (sort === 'created') return new Date(b.created_at || 0) - new Date(a.created_at || 0)
    return new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0)
  })
  const items = matched.slice(offset, offset + limit).map(publicProject)
  return { items, offset, limit, hasMore: offset + limit < matched.length, total: matched.length }
}

export async function findProject(token, id, user) {
  const uid = userIdOf(user)
  const files = await railwayList(token)
  const meta = files.find((f) => projectIdFromName(f.original_name) === id)
  if (!meta) return null
  const rec = await fetchJsonUrl(meta.url)
  if (!rec) return null
  if (uid && rec.user_id && rec.user_id !== uid) return null
  rec.meta_file_id = rec.meta_file_id || meta.id
  rec._meta_file = meta
  return rec
}

export async function createProject(token, user, body) {
  const rec = createProjectRecord(user, body)
  return publicProject(await writeProject(token, rec))
}

export async function updateProject(token, id, user, patch) {
  const rec = await findProject(token, id, user)
  if (!rec) return null
  const next = { ...rec }
  if (patch.title != null) next.title = String(patch.title).slice(0, 120)
  if (patch.topic != null) next.topic = String(patch.topic)
  if (patch.status != null && PROJECT_STATUSES.includes(patch.status)) next.status = patch.status
  if (patch.aspect === '9:16' || patch.aspect === '16:9') next.aspect = patch.aspect
  if (patch.length != null) next.length = String(patch.length)
  if (patch.duration_seconds != null && Number(patch.duration_seconds) > 0) {
    next.duration_seconds = Number(patch.duration_seconds)
  }
  if (patch.voice_id != null) next.voice_id = String(patch.voice_id)
  if (patch.model != null) next.model = String(patch.model)
  if (patch.favorited != null) next.favorited = !!patch.favorited
  if (patch.pipeline !== undefined) next.pipeline = patch.pipeline
  if (Array.isArray(patch.references)) next.references = patch.references.slice(0, 4)
  if (Array.isArray(patch.assets)) next.assets = patch.assets
  if (Array.isArray(patch.jobs)) next.jobs = patch.jobs
  return publicProject(await writeProject(token, next))
}

export async function deleteProject(token, id, user) {
  const rec = await findProject(token, id, user)
  if (!rec) return false
  const files = [rec.meta_file_id]
  for (const a of rec.assets || []) if (a?.file_id) files.push(a.file_id)
  for (const r of rec.references || []) if (r?.file_id) files.push(r.file_id)
  for (const idToDel of files) {
    try { await railwayDelete(token, idToDel) } catch (_) {}
  }
  return true
}

export async function duplicateProject(token, id, user) {
  const rec = await findProject(token, id, user)
  if (!rec) return null
  const copy = createProjectRecord(user, rec)
  copy.title = (rec.title || 'Untitled') + ' copy'
  copy.topic = rec.topic
  copy.aspect = rec.aspect
  copy.length = rec.length
  copy.duration_seconds = rec.duration_seconds
  copy.voice_id = rec.voice_id
  copy.model = rec.model
  copy.pipeline = rec.pipeline ? JSON.parse(JSON.stringify(rec.pipeline)) : null
  copy.assets = (rec.assets || []).filter((a) => a.type !== 'export').map((a) => ({
    ...a,
    id: randomUUID(),
    created_at: nowIso(),
  }))
  copy.jobs = []
  copy.status = rec.pipeline?.script ? 'script' : 'draft'
  return publicProject(await writeProject(token, copy))
}

export async function addAsset(token, projectId, user, asset) {
  const rec = await findProject(token, projectId, user)
  if (!rec) return null
  const type = ASSET_TYPES.includes(asset.type) ? asset.type : 'export'
  const row = {
    id: randomUUID(),
    type,
    storage_url: String(asset.storage_url || asset.url || ''),
    file_id: String(asset.file_id || ''),
    mime: String(asset.mime || ''),
    label: String(asset.label || type),
    created_at: nowIso(),
  }
  rec.assets = [...(rec.assets || []), row]
  const saved = await writeProject(token, rec)
  return { project: publicProject(saved), asset: row }
}

export async function addJob(token, projectId, user, job) {
  const rec = await findProject(token, projectId, user)
  if (!rec) return null
  const row = {
    id: randomUUID(),
    type: String(job.type || 'script'),
    status: JOB_STATUSES.includes(job.status) ? job.status : 'queued',
    progress: Math.max(0, Math.min(100, Number(job.progress) || 0)),
    error: String(job.error || ''),
    remote_id: String(job.remote_id || job.jobId || ''),
    favorited: false,
    created_at: nowIso(),
    updated_at: nowIso(),
  }
  rec.jobs = [...(rec.jobs || []), row]
  const saved = await writeProject(token, rec)
  return { project: publicProject(saved), job: row }
}

export async function patchJob(token, projectId, user, jobId, patch) {
  const rec = await findProject(token, projectId, user)
  if (!rec) return null
  const jobs = rec.jobs || []
  const idx = jobs.findIndex((j) => j.id === jobId || j.remote_id === jobId)
  if (idx < 0) return null
  const next = { ...jobs[idx], updated_at: nowIso() }
  if (patch.status && JOB_STATUSES.includes(patch.status)) next.status = patch.status
  if (patch.progress != null) next.progress = Math.max(0, Math.min(100, Number(patch.progress) || 0))
  if (patch.error != null) next.error = String(patch.error)
  if (patch.remote_id != null) next.remote_id = String(patch.remote_id)
  if (patch.favorited != null) next.favorited = !!patch.favorited
  jobs[idx] = next
  rec.jobs = jobs
  if (next.status === 'failed' && rec.status !== 'ready') rec.status = rec.pipeline?.script ? 'script' : rec.status
  const saved = await writeProject(token, rec)
  return { project: publicProject(saved), job: next }
}

export async function listJobs(token, user, { offset = 0, limit = 24, favorites = false, project_id = '' } = {}) {
  const { items } = await listProjects(token, user, { offset: 0, limit: 200, favorites: false })
  let jobs = []
  for (const p of items) {
    if (project_id && p.id !== project_id) continue
    for (const j of p.jobs || []) {
      jobs.push({
        ...j,
        project_id: p.id,
        project_title: p.title,
        topic: p.topic,
        thumb: (p.assets || []).find((a) => a.type === 'thumbnail')?.storage_url || '',
      })
    }
  }
  jobs.sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0))
  if (favorites) jobs = jobs.filter((j) => j.favorited)
  return {
    items: jobs.slice(offset, offset + limit),
    offset,
    limit,
    hasMore: offset + limit < jobs.length,
    total: jobs.length,
  }
}

export async function persistBinary(token, { buffer, filename, mime }) {
  return railwayUpload(token, { buffer, filename, mime })
}
