/** Shared thumbnail-generator constants. Used by the UI and generate APIs. */

export const IMG_MAX_REFS = 4
export const IMG_MAX_REF_BYTES = 8 * 1024 * 1024
export const IMG_PAGE_SIZE = 24
export const IMG_META_PREFIX = 'vidso-img-'
export const IMG_META_SUFFIX = '.meta.json'
export const IMG_REF_PREFIX = 'vidso-imgref-'

export const IMAGE_ASPECTS = [
  { id: 'auto', label: 'Auto', w: 0, h: 0 },
  { id: '1:1', label: '1:1', w: 1, h: 1 },
  { id: '3:4', label: '3:4', w: 3, h: 4 },
  { id: '4:3', label: '4:3', w: 4, h: 3 },
  { id: '2:3', label: '2:3', w: 2, h: 3 },
  { id: '3:2', label: '3:2', w: 3, h: 2 },
  { id: '9:16', label: '9:16', w: 9, h: 16 },
  { id: '16:9', label: '16:9', w: 16, h: 9 },
  { id: '5:4', label: '5:4', w: 5, h: 4 },
  { id: '4:5', label: '4:5', w: 4, h: 5 },
  { id: '21:9', label: '21:9', w: 21, h: 9 },
]

export const IMAGE_QUALITIES = ['1K', '2K', '4K']
export const DEFAULT_IMAGE_ASPECT = '16:9'
export const DEFAULT_IMAGE_QUALITY = '2K'

/** Empty-state sample thumbnails. Empty strings keep tinted cards; load errors fall back the same way. */
export const IMG_EMPTY_R2_HOST = 'pub-f40c956471ff49feab622906892ec527.r2.dev'
export const IMG_EMPTY_SAMPLES = [
  'https://pub-f40c956471ff49feab622906892ec527.r2.dev/thumbnail.png',
  'https://pub-f40c956471ff49feab622906892ec527.r2.dev/thumbnail1.png',
  'https://pub-f40c956471ff49feab622906892ec527.r2.dev/thumbnail2.png',
  'https://pub-f40c956471ff49feab622906892ec527.r2.dev/thumbnail3.png',
]

export const LFG_STEP_SHOTS = {
  script: 'https://' + IMG_EMPTY_R2_HOST + '/Script.png',
  media: 'https://' + IMG_EMPTY_R2_HOST + '/Media.png',
  export: 'https://' + IMG_EMPTY_R2_HOST + '/Export.png',
}

export function aspectById(id) {
  const key = String(id || '').trim()
  return IMAGE_ASPECTS.find((a) => a.id === key) || IMAGE_ASPECTS.find((a) => a.id === DEFAULT_IMAGE_ASPECT)
}

export function aspectCss(id) {
  const a = aspectById(id)
  if (!a || a.id === 'auto' || !a.w || !a.h) return '16 / 9'
  return a.w + ' / ' + a.h
}

const IMG_META_SUFFIXES = ['.meta.json', '.meta.txt', '.meta.jpg']

export function metaIdFromName(name) {
  const n = String(name || '')
  if (!n.startsWith(IMG_META_PREFIX)) return ''
  for (const suf of IMG_META_SUFFIXES) {
    if (n.endsWith(suf)) return n.slice(IMG_META_PREFIX.length, n.length - suf.length)
  }
  return ''
}

export function isMetaFileName(name) {
  return !!metaIdFromName(name)
}

export function isHistorySidecarName(name) {
  const n = String(name || '')
  return isMetaFileName(n) || n.startsWith(IMG_REF_PREFIX) || n.startsWith('vidso-yt-') || n.startsWith('vidso-fs-proj-')
}

export function metaFileName(id) {
  return IMG_META_PREFIX + id + IMG_META_SUFFIX
}

export function imageFileName(id, prompt) {
  const slug = String(prompt || 'thumbnail')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'thumbnail'
  return `Thumbnail-${slug}-${String(id).slice(0, 8)}.jpg`
}
