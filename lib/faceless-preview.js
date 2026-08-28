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
