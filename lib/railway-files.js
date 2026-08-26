/** Server-only helpers for Railway /api/upload (existing object storage). */

const UPSTREAM = process.env.UPSTREAM_API || 'https://vibrant-patience-production-a7f0.up.railway.app'

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

export async function railwayList(token) {
  const res = await fetch(UPSTREAM + '/api/upload', { headers: authHeaders(token) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.message || data.error || 'Could not list files')
    err.status = res.status
    throw err
  }
  return asFileList(data).map(fileRecord).filter(Boolean)
}

export async function railwayUpload(token, { buffer, filename, mime }) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
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

export async function railwayDelete(token, id) {
  if (!id) return
  const res = await fetch(UPSTREAM + '/api/upload/' + encodeURIComponent(id), {
    method: 'DELETE',
    headers: authHeaders(token),
  })
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
  return res.json()
}
