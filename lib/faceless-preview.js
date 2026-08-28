/** Long Form preview + YouTube caption sizing helpers. */

/** Burned-in size is authored against a 1080p frame (YouTube upload). */
export const FACELESS_CAPTION_EXPORT_HEIGHT = 1080

/**
 * Default burned-in caption size at 1080p.
 * ~6% of frame height: readable on TV and phone without covering the picture.
 * 14px was a preview-stage default and is unreadably small in the export.
 */
export const FACELESS_CAPTION_DEFAULT_SIZE = 64

export function captionPreviewPx(
  size,
  stageHeight,
  exportHeight = FACELESS_CAPTION_EXPORT_HEIGHT,
) {
  const s = Number(size)
  const h = Number(stageHeight)
  const eh = Number(exportHeight) || FACELESS_CAPTION_EXPORT_HEIGHT
  if (!Number.isFinite(s) || s <= 0) return FACELESS_CAPTION_DEFAULT_SIZE
  if (!Number.isFinite(h) || h <= 0 || !Number.isFinite(eh) || eh <= 0) return Math.round(s)
  return Math.max(10, Math.round(s * (h / eh)))
}

export const FACELESS_CAPTION_SHADOW_CSS = '0 2px 8px rgba(0,0,0,.85), 0 0 2px #000'
export const FACELESS_CAPTION_STROKE_DEFAULT_COLOR = '#000000'
export const FACELESS_CAPTION_STROKE_DEFAULT_WIDTH = 3

export function captionPreviewStrokePx(
  width,
  stageHeight,
  exportHeight = FACELESS_CAPTION_EXPORT_HEIGHT,
) {
  const w = Number(width)
  const h = Number(stageHeight)
  const eh = Number(exportHeight) || FACELESS_CAPTION_EXPORT_HEIGHT
  if (!Number.isFinite(w) || w <= 0) return 0
  if (!Number.isFinite(h) || h <= 0 || !Number.isFinite(eh) || eh <= 0) return w
  return Math.max(0.5, +(w * (h / eh)).toFixed(2))
}

export function captionStrokeShadow(color, width) {
  const w = Number(width)
  if (!Number.isFinite(w) || w <= 0) return ''
  const c = color || FACELESS_CAPTION_STROKE_DEFAULT_COLOR
  return [
    [-1, -1], [1, -1], [-1, 1], [1, 1],
    [-1, 0], [1, 0], [0, -1], [0, 1],
  ].map(([x, y]) => `${x * w}px ${y * w}px 0 ${c}`).join(',')
}

export function captionLayerShadow({
  shadow = false,
  stroke = false,
  strokeColor = FACELESS_CAPTION_STROKE_DEFAULT_COLOR,
  strokeWidth = FACELESS_CAPTION_STROKE_DEFAULT_WIDTH,
  previewWidth,
} = {}) {
  const parts = []
  if (stroke) {
    const w = previewWidth == null ? strokeWidth : previewWidth
    const outline = captionStrokeShadow(strokeColor, w)
    if (outline) parts.push(outline)
  }
  if (shadow) parts.push(FACELESS_CAPTION_SHADOW_CSS)
  return parts.join(', ') || 'none'
}

export function youtubeWatchUrl(clip) {
  if (!clip) return ''
  const direct = String(clip.youtube_url || '').trim()
  if (direct) return direct
  if (clip.source === 'youtube') {
    return String(clip.pexels_url || '').trim()
  }
  return ''
}

export function clipPlaybackRange(clip) {
  const start = Math.max(0, Number(clip?.clip_start) || 0)
  const len = Math.max(4, (Number(clip?.end) || 0) - (Number(clip?.start) || 0))
  return { start, end: +(start + len).toFixed(2) }
}

/** Offset into the file playing in the preview <video>. */
export function clipTimelineOffset(clip, t, { trimmed = false } = {}) {
  const rel = Math.max(0, Number(t) - Number(clip?.start || 0))
  if (trimmed) return rel
  return Math.max(0, Number(clip?.clip_start || 0) + rel)
}

/**
 * Load the active clip on the visible player. Using the hidden buffer first
 * leaves a black stage in browsers that skip decoding opacity:0 videos.
 */
export function previewLoadTarget({ onHasUrl, offHasReadyUrl }) {
  if (onHasUrl) return 'on'
  if (offHasReadyUrl) return 'swap'
  return 'on'
}
