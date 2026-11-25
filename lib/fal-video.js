// Fal text-to-video catalog for Faceless Studio. IDs are what the picker
// sends; /api/generate/image maps kind=video onto queue.fal.run.

export const STOCK_VIDEO_MODEL = 'stock'
export const DEFAULT_VIDEO_MODEL = 'h3-max-turbo'
export const MAX_VIDEO_GENERATIONS = 4

/** The only video model offered: MiniMax H3 Max Turbo. Other models were removed on purpose. */
export const VIDEO_MODELS = [
  { id: 'h3-max-turbo', name: 'MiniMax H3 Max Turbo', group: 'MiniMax', hint: '3–10s, 768p, fastest and cheapest', blurb: '3–10s, 768p', fal: 'minimax/h3-max-turbo/text-to-video', i2v: 'minimax/h3-max-turbo/image-to-video', imageField: 'image_url', durations: [3, 4, 5, 6, 7, 8, 10], durationStyle: 'number', aspects: ['16:9', '9:16'], resolutions: ['768P'], audio: false, defaultDuration: 4, noAspectWithImage: true, extra: { prompt_expansion_mode: 'disabled' } },
]

export function videoModelById(id) {
  const key = String(id || '').trim()
  if (!key || key === STOCK_VIDEO_MODEL) return null
  return VIDEO_MODELS.find((m) => m.id === key) || VIDEO_MODELS.find((m) => m.id === DEFAULT_VIDEO_MODEL) || VIDEO_MODELS[0]
}

export function isFalVideoModel(id) {
  const key = String(id || '').trim()
  return VIDEO_MODELS.some((m) => m.id === key)
}

export function clampVideoCount(n) {
  const x = Math.round(Number(n))
  if (!Number.isFinite(x)) return 1
  return Math.min(MAX_VIDEO_GENERATIONS, Math.max(1, x))
}

export function durationsForModel(id) {
  const model = videoModelById(id)
  return model?.durations?.length ? model.durations.slice() : [5]
}

export function aspectsForModel(id) {
  const model = videoModelById(id)
  const allowed = model?.aspects || ['16:9', '9:16']
  return ['16:9', '9:16'].filter((a) => allowed.includes(a))
}

export function resolutionsForModel(id) {
  const model = videoModelById(id)
  return model?.resolutions?.length ? model.resolutions.slice() : []
}

export function resolutionFor(id, res) {
  const list = resolutionsForModel(id)
  if (!list.length) return ''
  const key = String(res || '').toLowerCase()
  return list.includes(key) ? key : (list.includes('720p') ? '720p' : list[0])
}

export function videoModelLabel(id) {
  if (!id || id === STOCK_VIDEO_MODEL || !isFalVideoModel(id)) return 'Stock footage'
  return videoModelById(id)?.name || 'MiniMax H3 Max Turbo'
}

function nearestDuration(model, seconds) {
  const list = model.durations || [model.defaultDuration || 5]
  const want = Number(seconds)
  if (!Number.isFinite(want) || want <= 0) return model.defaultDuration || list[0]
  let best = list[0]
  let gap = Math.abs(best - want)
  for (const n of list) {
    const g = Math.abs(n - want)
    if (g < gap) {
      best = n
      gap = g
    }
  }
  return best
}

export function clipDurationFor(id, seconds) {
  const model = videoModelById(id)
  if (!model) {
    const n = Number(seconds)
    return Number.isFinite(n) && n > 0 ? n : 5
  }
  return nearestDuration(model, seconds)
}

function formatDuration(model, seconds) {
  const n = nearestDuration(model, seconds)
  if (model.durationStyle === 'seconds-s') return n + 's'
  if (model.durationStyle === 'number') return n
  return String(n)
}

function pickAspect(model, aspect) {
  const want = aspect === '9:16' ? '9:16' : '16:9'
  const allowed = model.aspects || ['16:9', '9:16']
  return allowed.includes(want) ? want : allowed[0]
}

function cleanMediaUrls(urls) {
  if (!Array.isArray(urls)) return []
  return urls.map((u) => String(u || '').trim()).filter((u) => /^(https?:|data:)/i.test(u)).slice(0, 4)
}

export function falVideoInput(modelId, prompt, { aspect, duration, resolution, generate_audio, image_urls } = {}) {
  const model = videoModelById(modelId)
  if (!model) {
    const err = new Error('Pick a Fal video model, or use stock footage.')
    err.code = 'no_video_model'
    throw err
  }
  const text = String(prompt || '').trim()
  if (!text) {
    const err = new Error('Enter a prompt')
    err.code = 'no_prompt'
    throw err
  }
  const refs = cleanMediaUrls(image_urls)
  const useI2v = !!(refs.length && model.i2v)
  const input = {
    prompt: text.slice(0, 2400),
    aspect_ratio: pickAspect(model, aspect),
    duration: formatDuration(model, duration),
  }
  if (model.resolutions && model.resolutions.length) {
    const res = String(resolution || '').toLowerCase()
    // Model lists keep fal's own spelling ('768P'), so match without case.
    input.resolution = model.resolutions.find((r) => String(r).toLowerCase() === res) || (model.resolutions.includes('720p') ? '720p' : model.resolutions[0])
  }
  if (model.audio) input.generate_audio = generate_audio === true
  if (model.extra) Object.assign(input, model.extra)
  if (useI2v) {
    // H3 follows the first frame's shape and takes no aspect ratio.
    if (model.noAspectWithImage) delete input.aspect_ratio
    input[model.imageField || 'image_url'] = refs[0]
    // Some image-to-video endpoints want the duration as a number even when text-to-video wants a string.
    if (model.i2vDurationStyle === 'number') input.duration = Number(input.duration) || model.defaultDuration || 5
  }
  return { model, endpoint: useI2v ? model.i2v : model.fal, input, imageToVideo: useI2v }
}

export function urlsFromFalVideoResult(result) {
  if (!result || typeof result !== 'object') return []
  const raw = [
    typeof result.video === 'string' ? result.video : result.video?.url,
    ...(Array.isArray(result.videos) ? result.videos.map((v) => (typeof v === 'string' ? v : v?.url)) : []),
  ].filter(Boolean)
  return [...new Set(raw)]
}

/** The model that animates AI scenes in every mode (Balanced, Cinematic, Animate, Animate all). */
export const SCENE_ANIMATION_MODEL = 'h3-max-turbo'
