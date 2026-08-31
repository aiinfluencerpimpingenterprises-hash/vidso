// Fal text-to-video catalog for Faceless Studio. IDs are what the picker
// sends; /api/generate/image maps kind=video onto queue.fal.run.

export const STOCK_VIDEO_MODEL = 'stock'
export const DEFAULT_VIDEO_MODEL = 'kling-3-pro'
export const MAX_VIDEO_GENERATIONS = 4

export const VIDEO_MODELS = [
  { id: 'kling-3-pro', name: 'Kling 3.0 Pro', group: 'Kling', hint: 'Cinematic, 3–15s', blurb: 'Cinematic, 3–15s', fal: 'fal-ai/kling-video/v3/pro/text-to-video', i2v: 'fal-ai/kling-video/v3/pro/image-to-video', imageField: 'start_image_url', durations: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], durationStyle: 'string', aspects: ['16:9', '9:16', '1:1'], audio: true, defaultDuration: 5 },
  { id: 'veo-3.1', name: 'Veo 3.1', group: 'Google', hint: '4–8s, up to 4K', blurb: 'The only 4K model', fal: 'fal-ai/veo3.1', i2v: 'fal-ai/veo3.1/image-to-video', imageField: 'image_url', durations: [4, 6, 8], durationStyle: 'seconds-s', aspects: ['16:9', '9:16'], audio: true, defaultDuration: 8, resolutions: ['720p', '1080p', '4k'] },
  { id: 'seedance-2', name: 'Seedance 2.0', group: 'ByteDance', hint: '4–15s, native audio', blurb: '4–15s, native audio', fal: 'bytedance/seedance-2.0/text-to-video', i2v: 'bytedance/seedance-2.0/image-to-video', imageField: 'image_url', durations: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], durationStyle: 'string', aspects: ['16:9', '9:16', '1:1', '21:9'], audio: true, defaultDuration: 8, resolutions: ['480p', '720p', '1080p', '4k'] },
  { id: 'wan-2.7', name: 'Wan 2.7', group: 'Alibaba', hint: 'Fast scene clips', blurb: 'Fast scene clips', fal: 'fal-ai/wan/v2.7/text-to-video', i2v: 'fal-ai/wan/v2.7/image-to-video', imageField: 'image_url', durations: [5], durationStyle: 'string', aspects: ['16:9', '9:16'], audio: false, defaultDuration: 5 },
  { id: 'sora-2', name: 'Sora 2', group: 'OpenAI', hint: 'Detailed clips with audio', blurb: 'Detailed clips with audio', fal: 'fal-ai/sora-2/text-to-video', i2v: 'fal-ai/sora-2/image-to-video', imageField: 'image_url', durations: [4, 8, 12], durationStyle: 'number', aspects: ['16:9', '9:16'], audio: true, defaultDuration: 8 },
  { id: 'hailuo-02', name: 'Hailuo 02', group: 'MiniMax', hint: '6 or 10s, 1080p', blurb: '6 or 10s, 1080p', fal: 'fal-ai/minimax/hailuo-02/pro/text-to-video', i2v: 'fal-ai/minimax/hailuo-02/pro/image-to-video', imageField: 'image_url', durations: [6, 10], durationStyle: 'number', aspects: ['16:9', '9:16'], audio: false, defaultDuration: 6 },
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
  return videoModelById(id)?.name || 'Kling 3.0 Pro'
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
    input.resolution = model.resolutions.includes(res) ? res : (model.resolutions.includes('720p') ? '720p' : model.resolutions[0])
  }
  if (model.audio) input.generate_audio = generate_audio === true
  if (useI2v) input[model.imageField || 'image_url'] = refs[0]
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
