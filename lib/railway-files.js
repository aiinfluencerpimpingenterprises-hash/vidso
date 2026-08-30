/** Server-only helpers for Railway /api/upload (existing object storage). */

const UPSTREAM = process.env.UPSTREAM_API || 'https://vibrant-patience-production-a7f0.up.railway.app'
const SIDECAR_MARK = Buffer.from('\nVIDSO_JSON\n')
// Minimal JPEG so magic-byte allowlists accept JSON sidecars.
const MINI_JPEG = Buffer.from(
  'ffd8ffe000104a46494600010100000100010000ffdb004300080606070605080707070909080a0c140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20242e2720222c231c1c2837292c30313434341f27393d38323c2e333432ffc0000b080001000101011100ffc400140001000000000000000000000000000003ffc400141001000000000000000000000000000000ffda0008010100003f007fffffd9',
  'hex',
)

function replaceExt(name, ext) {
  return String(name || 'file').replace(/\.[A-Za-z0-9]+$/i, '') + ext
}

export function isSidecarUpload(filename, mime) {
  const n = String(filename || '')
  const m = String(mime || '')
  return /\.(json|txt)$/i.test(n) ||
    /json|text\//i.test(m) ||
    n.startsWith('vidso-fs-proj-') ||
    n.startsWith('vidso-img-') ||
    n.startsWith('vidso-yt-')
}

export function isTypeRejected(err) {
  return /not allowed|unsupported (file )?type|invalid (file )?type|file type/i.test(String(err?.message || ''))
}

export function packJsonBytes(bytes) {
  const raw = bytes instanceof Uint8Array ? Buffer.from(bytes) : Buffer.from(bytes || [])
  if (raw.length >= 2 && raw[0] === 0xff && raw[1] === 0xd8) return raw
  return Buffer.concat([MINI_JPEG, SIDECAR_MARK, raw])
}

export function parseJsonSidecar(bytes) {
  const buf = Buffer.from(bytes instanceof Uint8Array ? bytes : bytes || [])
  const mark = buf.indexOf(SIDECAR_MARK)
  if (mark >= 0) return JSON.parse(buf.subarray(mark + SIDECAR_MARK.length).toString('utf8'))
  return JSON.parse(buf.toString('utf8').replace(/^\uFEFF/, ''))
}

function authHeaders(token) {
  return { Authorization: 'Bearer ' + token }
}

export function asFileList(data) {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.files)) return data.files
  if (Array.isArray(data?.uploads)) return data.uploads
  if (Array.isArray(data?.data)) return data.data
  return []
}

export function fileRecord(data) {
  if (!data || typeof data !== 'object') return null
  const rec = data.file || data.upload || data.data || data
  const id = rec.id || rec.file_id
  const url = rec.url || rec.public_url || rec.src
  if (!id && !url) return null
  return {
    id: id ? String(id) : '',
    url: url ? String(url) : '',
    original_name: rec.original_name || rec.name || rec.filename || '',
    mime_type: rec.mime_type || rec.content_type || rec.type || '',
    size: rec.size || 0,
    created_at: rec.created_at || rec.createdAt || null,
  }
}

// One studio action fans out into several store calls (find, write, add job,
// add asset), and each used to re-list every file. Warm instances reuse this
// for a few seconds; writes drop the entry so a rewrite is never missed.
const LIST_TTL_MS = 4000
const LIST_MAX = 32
const listCache = new Map()

function cacheKey(token) {
  return String(token || '')
}

export function invalidateFileList(token) {
  listCache.delete(cacheKey(token))
}

function cachedList(token) {
  const hit = listCache.get(cacheKey(token))
  if (!hit) return null
  if (Date.now() - hit.at > LIST_TTL_MS) {
    listCache.delete(cacheKey(token))
    return null
  }
  return hit.items
}

function rememberList(token, items) {
  const key = cacheKey(token)
  if (listCache.size >= LIST_MAX && !listCache.has(key)) {
    listCache.delete(listCache.keys().next().value)
  }
  listCache.set(key, { at: Date.now(), items })
}

export async function railwayList(token, { fresh = false } = {}) {
  if (!fresh) {
    const hit = cachedList(token)
    if (hit) return hit
  }
  const res = await fetch(UPSTREAM + '/api/upload', { headers: authHeaders(token) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.message || data.error || 'Could not list files')
    err.status = res.status
    throw err
  }
  const items = asFileList(data).map(fileRecord).filter(Boolean)
  rememberList(token, items)
  return items
}

async function uploadOnce(token, bytes, filename, mime) {
  const fd = new FormData()
  fd.append('file', new Blob([bytes], { type: mime || 'application/octet-stream' }), filename)
  const res = await fetch(UPSTREAM + '/api/upload', {
    method: 'POST',
    headers: authHeaders(token),
    body: fd,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.message || data.error || 'Upload failed')
    err.status = res.status
    throw err
  }
  const rec = fileRecord(data)
  if (!rec) {
    const err = new Error('Upload did not return a file')
    err.status = 502
    throw err
  }
  return rec
}

export async function railwayUpload(token, { buffer, filename, mime }) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  const attempts = [{ filename, mime: mime || 'application/octet-stream', bytes }]
  if (isSidecarUpload(filename, mime)) {
    attempts.push({ filename: replaceExt(filename, '.txt'), mime: 'text/plain', bytes })
    attempts.push({
      filename: replaceExt(filename, '.jpg'),
      mime: 'image/jpeg',
      bytes: packJsonBytes(bytes),
    })
  }
  let lastErr
  for (const attempt of attempts) {
    try {
      const rec = await uploadOnce(token, attempt.bytes, attempt.filename, attempt.mime)
      invalidateFileList(token)
      return rec
    } catch (e) {
      lastErr = e
      if (!isTypeRejected(e)) throw e
    }
  }
  throw lastErr
}

export async function railwayDelete(token, id) {
  if (!id) return
  const res = await fetch(UPSTREAM + '/api/upload/' + encodeURIComponent(id), {
    method: 'DELETE',
    headers: authHeaders(token),
  })
  invalidateFileList(token)
  if (!res.ok && res.status !== 404) {
    const data = await res.json().catch(() => ({}))
    const err = new Error(data.message || data.error || 'Delete failed')
    err.status = res.status
    throw err
  }
}

export async function fetchJsonUrl(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Could not read generation')
  return parseJsonSidecar(Buffer.from(await res.arrayBuffer()))
}

/**
 * Read many sidecars at once. Listing pages used to await one URL at a time,
 * so a user with 20 projects paid for 20 serial round trips.
 */
export async function fetchJsonUrls(urls, { concurrency = 8 } = {}) {
  const list = Array.isArray(urls) ? urls : []
  const out = new Array(list.length).fill(null)
  let next = 0
  const worker = async () => {
    while (next < list.length) {
      const i = next++
      try { out[i] = await fetchJsonUrl(list[i]) } catch (_) { out[i] = null }
    }
  }
  const lanes = Math.max(1, Math.min(concurrency, list.length))
  await Promise.all(Array.from({ length: lanes }, worker))
  return out
}
