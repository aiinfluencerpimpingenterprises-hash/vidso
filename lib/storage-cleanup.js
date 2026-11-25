// Daily cleanup of leftover media in the clipzo-uploads Supabase bucket. Server-only.
//
// The Railway backend stores every voiceover part, joined narration and
// intermediate render in Supabase Storage and never deletes them, which filled
// the free plan's 1 GB (4.2 GB on 2026-11-25, mostly voiceover parts). Files
// people saved are listed in the `user_files` table (`key` = storage path);
// anything else is a leftover.
//
// Deletes only: video/audio files, older than ORPHAN_DAYS, that no user_files
// row points at. Saved videos, projects, images and YouTube connections stay.

const BUCKET = 'clipzo-uploads'
const DEFAULT_URL = 'https://ymtmgpgcmrazqeklixwf.supabase.co'
export const ORPHAN_DAYS = 14
const MEDIA_EXT = /\.(mp4|mov|m4v|webm|mkv|avi|mp3|wav|m4a|aac|ogg|oga|flac|opus)$/i

export function isMedia(path, mime) {
  const m = String(mime || '').toLowerCase()
  return m.startsWith('video/') || m.startsWith('audio/') || MEDIA_EXT.test(String(path || ''))
}

/** Which objects to delete: old, media, and not in anyone's library. */
export function planCleanup(objects, keptKeys, { now = Date.now(), days = ORPHAN_DAYS } = {}) {
  const keep = keptKeys instanceof Set ? keptKeys : new Set(keptKeys)
  const cutoff = now - days * 86400000
  return objects.filter((o) => {
    if (!isMedia(o.path, o.mime)) return false
    if (keep.has(o.path)) return false
    const at = Date.parse(o.createdAt || '')
    return Number.isFinite(at) && at < cutoff
  })
}

function supabase(env) {
  const read = (n) => String(env?.[n] || process.env[n] || '').trim()
  const key = read('SUPABASE_SERVICE_ROLE_KEY') || read('SUPABASE_SECRET_KEY')
  const base = (read('SUPABASE_URL') || DEFAULT_URL).replace(/\/+$/, '')
  if (!key) return null
  const headers = { apikey: key, 'Content-Type': 'application/json' }
  if (key.startsWith('eyJ')) headers.Authorization = 'Bearer ' + key
  async function call(method, path, body, extra = {}) {
    const res = await fetch(base + path, { method, headers: { ...headers, ...extra }, body: body ? JSON.stringify(body) : undefined })
    const text = await res.text()
    let data
    try { data = JSON.parse(text) } catch { data = text }
    if (!res.ok) throw new Error(`${method} ${path.split('?')[0]} → ${res.status}`)
    return data
  }
  return { call }
}

async function listObjects(sb, prefix = '') {
  const out = []
  for (let offset = 0; ; offset += 1000) {
    const page = await sb.call('POST', `/storage/v1/object/list/${BUCKET}`, {
      prefix, limit: 1000, offset, sortBy: { column: 'name', order: 'asc' },
    })
    for (const item of page) {
      const path = prefix ? `${prefix}/${item.name}` : item.name
      if (item.id == null && !item.metadata) out.push(...await listObjects(sb, path))
      else out.push({ path, size: Number(item.metadata?.size) || 0, mime: item.metadata?.mimetype || '', createdAt: item.created_at || '' })
    }
    if (page.length < 1000) break
  }
  return out
}

async function libraryKeys(sb) {
  const keys = new Set()
  for (let from = 0; ; from += 1000) {
    const page = await sb.call('GET', '/rest/v1/user_files?select=key', null, { Range: `${from}-${from + 999}`, 'Range-Unit': 'items' })
    for (const row of page) if (row?.key) keys.add(String(row.key))
    if (page.length < 1000) break
  }
  return keys
}

export async function cleanupStorage({ env, now = Date.now(), dryRun = false, days = ORPHAN_DAYS } = {}) {
  const sb = supabase(env)
  if (!sb) return { ok: false, reason: 'no_supabase_key' }
  // Read the library first: if that fails we stop, rather than treat every file as a leftover.
  const kept = await libraryKeys(sb)
  const objects = await listObjects(sb)
  const doomed = planCleanup(objects, kept, { now, days })
  const bytes = doomed.reduce((n, o) => n + o.size, 0)
  let deleted = 0
  if (!dryRun) {
    for (let i = 0; i < doomed.length; i += 100) {
      const batch = doomed.slice(i, i + 100).map((o) => o.path)
      const out = await sb.call('DELETE', `/storage/v1/object/${BUCKET}`, { prefixes: batch })
      deleted += Array.isArray(out) ? out.length : batch.length
    }
  }
  return {
    ok: true,
    dryRun,
    scanned: objects.length,
    inLibrary: kept.size,
    matched: doomed.length,
    deleted,
    freedMb: Math.round(bytes / 104857.6) / 10,
  }
}
