import { randomUUID } from 'node:crypto'
import { imageFileName, IMG_REF_PREFIX, isMetaFileName, metaFileName } from './image-gen.js'
import { fetchJsonUrl, railwayDelete, railwayList, railwayUpload } from './railway-files.js'

function userIdOf(user) {
  return String(user?.id || user?.user_id || user?.email || '').trim()
}

export async function persistGeneration(token, user, {
  url,
  prompt,
  model,
  aspect_ratio,
  quality,
  batch_index = 0,
  width,
  height,
  reference_images = [],
} = {}) {
  if (!url) throw new Error('Missing image URL')
  const id = randomUUID()
  const imgRes = await fetch(url)
  if (!imgRes.ok) throw new Error('Could not download generated image')
  const mime = String(imgRes.headers.get('content-type') || 'image/jpeg').split(';')[0]
  const buf = Buffer.from(await imgRes.arrayBuffer())
  const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg'
  const uploaded = await railwayUpload(token, {
    buffer: buf,
    filename: imageFileName(id, prompt).replace(/\.jpg$/, '.' + ext),
    mime,
  })
  const refs = await persistReferenceImages(token, id, reference_images)
  const record = {
    id,
    user_id: userIdOf(user),
    prompt: String(prompt || ''),
    model: String(model || ''),
    aspect_ratio: String(aspect_ratio || '16:9'),
    quality: String(quality || '1K'),
    batch_index: Number(batch_index) || 0,
    storage_url: uploaded.url,
    file_id: uploaded.id,
    width: width ? Number(width) : null,
    height: height ? Number(height) : null,
    favorited: false,
    reference_images: refs,
    created_at: new Date().toISOString(),
  }
  const meta = await railwayUpload(token, {
    buffer: Buffer.from(JSON.stringify(record)),
    filename: metaFileName(id),
    mime: 'application/json',
  })
  record.meta_file_id = meta.id
  return record
}

async function persistReferenceImages(token, generationId, refs) {
  const list = Array.isArray(refs) ? refs.slice(0, 4) : []
  const out = []
  for (let i = 0; i < list.length; i++) {
    const raw = list[i]
    const url = typeof raw === 'string' ? raw : String(raw?.url || '')
    if (!url) continue
    if (/^https?:\/\//i.test(url)) {
      out.push({ url, file_id: typeof raw === 'object' ? (raw.file_id || '') : '' })
      continue
    }
    const m = url.match(/^data:([^;]+);base64,(.+)$/)
    if (!m) continue
    try {
      const uploaded = await railwayUpload(token, {
        buffer: Buffer.from(m[2], 'base64'),
        filename: IMG_REF_PREFIX + String(generationId).slice(0, 8) + '-' + i + '.jpg',
        mime: m[1] || 'image/jpeg',
      })
      out.push({ url: uploaded.url, file_id: uploaded.id })
    } catch (_) {}
  }
  return out
}

function generationIdFromName(name) {
  const n = String(name || '')
  if (!isMetaFileName(n)) return ''
  return n.slice('vidso-img-'.length, n.length - '.meta.json'.length)
}

export async function listGenerations(token, { favorites, offset = 0, limit = 24, user } = {}) {
  const uid = userIdOf(user)
  const files = await railwayList(token)
  const metas = files.filter((f) => isMetaFileName(f.original_name))
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
  const wantFav = !!favorites
  const matched = []
  let scanned = 0
  for (const file of metas) {
    scanned += 1
    try {
      const rec = await fetchJsonUrl(file.url)
      if (!rec || !rec.id) continue
      if (uid && rec.user_id && rec.user_id !== uid) continue
      rec.meta_file_id = rec.meta_file_id || file.id
      rec.storage_url = rec.storage_url || rec.url
      if (wantFav && !rec.favorited) continue
      matched.push(rec)
      if (matched.length >= offset + limit && !wantFav) break
    } catch (_) {}
    if (wantFav && matched.length >= offset + limit) break
  }
  const items = matched.slice(offset, offset + limit)
  const hasMore = wantFav ? scanned < metas.length && items.length === limit : offset + limit < metas.length
  return { items, offset, limit, hasMore }
}

export async function findGeneration(token, id, user) {
  const files = await railwayList(token)
  const meta = files.find((f) => generationIdFromName(f.original_name) === id)
  if (!meta) return null
  const rec = await fetchJsonUrl(meta.url)
  const uid = userIdOf(user)
  if (uid && rec?.user_id && rec.user_id !== uid) return null
  rec.meta_file_id = rec.meta_file_id || meta.id
  rec._meta_file = meta
  rec._image_file = files.find((f) => f.id && f.id === rec.file_id) || null
  return rec
}

export async function updateGeneration(token, id, patch, user) {
  const rec = await findGeneration(token, id, user)
  if (!rec) return null
  const next = {
    ...rec,
    favorited: patch.favorited != null ? !!patch.favorited : !!rec.favorited,
  }
  delete next._meta_file
  delete next._image_file
  if (rec.meta_file_id) await railwayDelete(token, rec.meta_file_id)
  const meta = await railwayUpload(token, {
    buffer: Buffer.from(JSON.stringify(next)),
    filename: metaFileName(id),
    mime: 'application/json',
  })
  next.meta_file_id = meta.id
  return next
}

export async function deleteGeneration(token, id, user) {
  const rec = await findGeneration(token, id, user)
  if (!rec) return false
  if (rec.file_id) await railwayDelete(token, rec.file_id)
  if (rec.meta_file_id) await railwayDelete(token, rec.meta_file_id)
  const refs = Array.isArray(rec.reference_images) ? rec.reference_images : []
  for (const ref of refs) {
    if (ref?.file_id) await railwayDelete(token, ref.file_id)
  }
  return true
}
