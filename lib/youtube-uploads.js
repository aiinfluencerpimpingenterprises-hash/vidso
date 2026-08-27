/** Per-account YouTube upload history. Platform quota is Google's shared daily bucket. */

import { randomUUID } from 'node:crypto'
import { fetchJsonUrl, railwayDelete, railwayList, railwayUpload } from './railway-files.js'
import { decryptRecord, encryptRecord, isYoutubeSidecarName } from './youtube.js'

export const YT_UPLOADS_FILENAME = 'vidso-yt-uploads.json'

/** YouTube Data API default project quota is 10,000 units/day. videos.insert costs 1,600. */
export const YT_UPLOAD_COST_UNITS = 1600
export const YT_DAILY_QUOTA_UNITS = 10000
export const YT_DAILY_UPLOAD_CAP = Math.floor(YT_DAILY_QUOTA_UNITS / YT_UPLOAD_COST_UNITS)

export function youtubeQuotaDay(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

export function youtubeQuotaResetAt(now = new Date()) {
  const day = youtubeQuotaDay(now)
  const [y, m, d] = day.split('-').map(Number)
  const next = new Date(Date.UTC(y, m - 1, d + 1, 8, 0, 0))
  const asPt = youtubeQuotaDay(next)
  if (asPt === day) return new Date(next.getTime() + 24 * 60 * 60 * 1000).toISOString()
  return next.toISOString()
}

export function isYoutubeQuotaError(err) {
  const msg = String(err?.message || err?.error || '')
  const reason = err?.body?.error?.errors?.[0]?.reason || err?.body?.error?.status || ''
  return /quota/i.test(msg) || /quotaExceeded/i.test(String(reason)) || /dailyLimitExceeded/i.test(String(reason))
}

export function publicQuotaView(history = []) {
  const day = youtubeQuotaDay()
  const yours = (history || []).filter((row) => {
    const dayKey = row.quota_day || row.quotaDay
    const status = row.status
    return dayKey === day && (status === 'published' || status === 'uploading')
  })
  return {
    dailyCap: YT_DAILY_UPLOAD_CAP,
    dailyUnits: YT_DAILY_QUOTA_UNITS,
    unitsPerUpload: YT_UPLOAD_COST_UNITS,
    quotaDay: day,
    resetsAt: youtubeQuotaResetAt(),
    yourUploadsToday: yours.length,
    platformRemainingUnknown: true,
  }
}

function emptyStore() {
  return { v: 1, items: [] }
}

async function loadStore(token) {
  const files = await railwayList(token)
  const hit = files.find((f) => (f.original_name || f.name) === YT_UPLOADS_FILENAME)
  if (!hit?.url) return { ...emptyStore() }
  const json = await fetchJsonUrl(hit.url)
  const rec = json?.data ? decryptRecord(json) : json
  rec._file_id = hit.id
  if (!Array.isArray(rec.items)) rec.items = []
  return rec
}

async function saveStore(token, store) {
  const prevId = store._file_id
  const stored = { v: 1, items: Array.isArray(store.items) ? store.items.slice(0, 80) : [] }
  const uploaded = await railwayUpload(token, {
    buffer: Buffer.from(JSON.stringify(encryptRecord(stored))),
    filename: YT_UPLOADS_FILENAME,
    mime: 'application/json',
  })
  if (prevId && prevId !== uploaded.id) {
    try { await railwayDelete(token, prevId) } catch (_) {}
  }
  stored._file_id = uploaded.id
  return stored
}

export function publicUpload(row) {
  if (!row) return null
  return {
    id: row.id,
    project: row.project || '',
    channelId: row.channel_id || '',
    channelTitle: row.channel_title || '',
    title: row.title || '',
    status: row.status || 'unknown',
    url: row.url || '',
    error: row.error || '',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
    quotaDay: row.quota_day || '',
  }
}

export async function listYoutubeUploads(token) {
  const store = await loadStore(token).catch(() => emptyStore())
  return (store.items || []).map(publicUpload)
}

export async function recordYoutubeUpload(token, patch) {
  const store = await loadStore(token).catch(() => emptyStore())
  const now = new Date().toISOString()
  const row = {
    id: patch.id || randomUUID(),
    project: String(patch.project || ''),
    channel_id: String(patch.channel_id || ''),
    channel_title: String(patch.channel_title || ''),
    title: String(patch.title || '').slice(0, 100),
    status: String(patch.status || 'published'),
    url: String(patch.url || ''),
    error: String(patch.error || '').slice(0, 280),
    video_url: String(patch.video_url || ''),
    render_job_id: String(patch.render_job_id || ''),
    description: String(patch.description || '').slice(0, 5000),
    privacy: String(patch.privacy || 'unlisted'),
    tags: Array.isArray(patch.tags) ? patch.tags.map(String).slice(0, 15) : [],
    quota_day: patch.quota_day || youtubeQuotaDay(),
    retry_after: patch.retry_after || null,
    created_at: patch.created_at || now,
    updated_at: now,
  }
  const idx = store.items.findIndex((it) => it.id === row.id)
  if (idx >= 0) store.items[idx] = { ...store.items[idx], ...row }
  else store.items.unshift(row)
  await saveStore(token, store)
  return publicUpload(row)
}

export async function findYoutubeUpload(token, id) {
  const store = await loadStore(token).catch(() => emptyStore())
  return (store.items || []).find((it) => it.id === id) || null
}

export function isYoutubeUploadsSidecarName(name) {
  return String(name || '') === YT_UPLOADS_FILENAME || isYoutubeSidecarName(name)
}
