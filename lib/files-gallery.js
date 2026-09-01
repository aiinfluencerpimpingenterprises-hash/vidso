/** My Files gallery: classify uploads and name saved generations. */

export function slugFilePart(raw, fallback = 'file') {
  const slug = String(raw || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  return slug || fallback
}

export function generationFileName(kind, title, at = new Date()) {
  const day = (at instanceof Date && !Number.isNaN(+at) ? at : new Date()).toISOString().slice(0, 10)
  if (kind === 'thumbnail') return `Thumbnail-${slugFilePart(title, 'thumbnail')}-${day}.jpg`
  if (kind === 'longform') return `Long-form-${slugFilePart(title, 'video')}-${day}.mp4`
  return `Vidso-${slugFilePart(title, 'file')}-${day}`
}

const TITLE_SMALL = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'vs'])

/** Turn a saved filename like Long-form-top-10-dog-breeds-ranked-2026-09-01.mp4 into a YouTube title. */
export function youtubeTitleFromFileName(name) {
  let stem = String(name || '').replace(/\.[a-z0-9]{1,8}$/i, '').trim()
  stem = stem.replace(/^(long-form|short-form|thumbnail|vidso)-/i, '')
  stem = stem.replace(/-?\d{4}-\d{2}-\d{2}$/, '').replace(/-$/, '')
  const words = stem.split(/[-\s_]+/).map((w) => w.trim()).filter(Boolean)
  if (!words.length) return 'Vidso video'
  return words.map((w, i) => {
    const lower = w.toLowerCase()
    if (i > 0 && TITLE_SMALL.has(lower)) return lower
    if (/^\d/.test(w)) return w
    return lower.charAt(0).toUpperCase() + lower.slice(1)
  }).join(' ').slice(0, 100)
}

export function fileKind(file) {
  const mime = String(file?.mime_type || file?.type || '').toLowerCase()
  const name = String(file?.original_name || file?.name || '').toLowerCase()
  if (mime.startsWith('video/') || /\.(mp4|webm|mov|m4v)(\?|$)/i.test(name)) return 'video'
  if (mime.startsWith('audio/') || /\.(mp3|wav|m4a|aac)(\?|$)/i.test(name)) return 'audio'
  if (mime.startsWith('image/') || /\.(png|jpe?g|webp|gif)(\?|$)/i.test(name)) return 'image'
  return 'file'
}

export function fileKindLabel(file) {
  const name = String(file?.original_name || file?.name || '')
  if (/^Long-form-/i.test(name)) return 'Long Form'
  if (/^Thumbnail-/i.test(name)) return 'Thumbnail'
  const kind = fileKind(file)
  if (kind === 'video') return 'Video'
  if (kind === 'image') return 'Image'
  if (kind === 'audio') return 'Audio'
  return 'File'
}

export function galleryFilterOf(file) {
  const kind = fileKind(file)
  if (kind === 'video') return 'videos'
  if (kind === 'image') return 'thumbnails'
  if (kind === 'audio') return 'audio'
  return 'all'
}

export function galleryItems(files, filter = 'all') {
  const list = (Array.isArray(files) ? files : []).filter(Boolean)
  const key = String(filter || 'all')
  if (!key || key === 'all') return list
  return list.filter((f) => galleryFilterOf(f) === key)
}

export function formatFileSize(bytes) {
  const n = Number(bytes) || 0
  if (n <= 0) return ''
  if (n < 1024) return n + ' B'
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB'
  return (n / 1024 / 1024).toFixed(1) + ' MB'
}

export function sortFilesNewest(files) {
  return [...(files || [])].sort((a, b) => {
    const ta = Date.parse(a?.created_at || a?.createdAt || 0) || 0
    const tb = Date.parse(b?.created_at || b?.createdAt || 0) || 0
    return tb - ta
  })
}
