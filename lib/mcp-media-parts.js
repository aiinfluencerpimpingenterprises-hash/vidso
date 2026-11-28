/**
 * Long MCP videos record their narration in parts: Railway refuses a media
 * script over ~8,000 characters, so a 10+ minute script is split the same way
 * the web client splits it and each part is its own media job. Claude only
 * sees one id, so the part ids ride inside a composite id ("multi:" + base64url)
 * that vidso_poll and longform_render_start both understand. Server-only.
 */

import { mergeMediaJobs } from './faceless-length.js'
import { voiceoverPlaylist } from './faceless-media-fallback.js'

export const MULTI_MEDIA_PREFIX = 'multi:'
const PART_ID = /^[\w-]{1,128}$/
export const MAX_MEDIA_PARTS = 40

const DONE = new Set(['done', 'ready', 'complete', 'completed'])
const FAILED = new Set(['error', 'failed', 'cancelled', 'canceled'])
const PENDING = new Set(['', 'queued', 'processing', 'running', 'pending', 'started'])

/** 'done' | 'failed' | 'pending' for a Railway media job status. Unknown statuses wait. */
export function mediaJobState(job) {
  const s = String(job?.status || '').trim().toLowerCase()
  if (DONE.has(s)) return 'done'
  if (FAILED.has(s)) return 'failed'
  if (PENDING.has(s)) return 'pending'
  return 'pending'
}

export function isMultiMediaId(id) {
  return String(id || '').startsWith(MULTI_MEDIA_PREFIX)
}

export function encodeMediaParts(ids) {
  const list = (Array.isArray(ids) ? ids : []).map((x) => String(x || '').trim())
  if (!list.length || list.length > MAX_MEDIA_PARTS || !list.every((x) => PART_ID.test(x))) {
    throw new Error('Invalid media part ids')
  }
  return MULTI_MEDIA_PREFIX + Buffer.from(list.join(','), 'utf8').toString('base64url')
}

/** The part ids inside a composite id; throws when it was tampered with or truncated. */
export function decodeMediaParts(id) {
  const raw = String(id || '')
  if (!isMultiMediaId(raw)) throw new Error('Not a multi-part media id')
  let list = []
  try {
    list = Buffer.from(raw.slice(MULTI_MEDIA_PREFIX.length), 'base64url').toString('utf8').split(',')
  } catch (_) {
    list = []
  }
  // Each id goes into a Railway path, so it must be a plain id.
  if (!list.length || list.length > MAX_MEDIA_PARTS || !list.every((x) => PART_ID.test(x))) {
    const err = new Error('That media_job_id is not valid. Use the id longform_make_video returned.')
    err.status = 400
    throw err
  }
  return list
}

/** One media job from finished parts: words, timeline and voiceover parts in order, times offset by earlier parts. */
export function mergeMediaParts(jobs) {
  const list = (Array.isArray(jobs) ? jobs : []).filter(Boolean)
  const merged = mergeMediaJobs(list)
  if (!merged) return null
  // mergeMediaJobs keeps one voiceover per part; a part can itself be several files.
  const urls = list.flatMap((j) => voiceoverPlaylist(j))
  if (urls.length) {
    merged.voiceover_urls = urls
    merged.voiceover_url = urls[0]
  }
  merged.status = 'done'
  return merged
}

/** Progress across parts for a poll that is still waiting. */
export function multiMediaProgress(jobs) {
  const list = Array.isArray(jobs) ? jobs : []
  const n = list.length || 1
  const done = list.filter((j) => mediaJobState(j) === 'done').length
  const sum = list.reduce((acc, j) => {
    if (mediaJobState(j) === 'done') return acc + 100
    const p = Number(j?.progress)
    return acc + (Number.isFinite(p) ? Math.max(0, Math.min(100, p)) : 0)
  }, 0)
  const current = list.findIndex((j) => mediaJobState(j) !== 'done')
  const step = current >= 0
    ? `Recording the narration (part ${current + 1} of ${n})` + (list[current]?.step ? ': ' + String(list[current].step).slice(0, 120) : '')
    : 'Joining the narration parts'
  return { progress: Math.round(sum / n), parts: n, parts_done: done, step }
}
