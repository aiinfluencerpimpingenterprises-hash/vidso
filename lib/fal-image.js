// Fal text-to-image catalog. IDs here are what the dashboard picker sends
// and what /api/generate/image maps to fal.run endpoints.

export const DEFAULT_IMAGE_MODEL = 'nano-banana-pro'

export const IMAGE_MODELS = [
  { id: 'nano-banana-pro', name: 'Nano Banana Pro', group: 'Google', hint: '2K, best text & detail', fal: 'fal-ai/nano-banana-pro', banana: true, resolution: '2K' },
  { id: 'nano-banana', name: 'Nano Banana', group: 'Google', hint: 'Fast, strong text', fal: 'fal-ai/nano-banana', banana: true, resolution: '1K' },
  { id: 'flux-2-pro', name: 'FLUX.2 Pro', group: 'Black Forest Labs', hint: 'Photoreal, detailed', fal: 'fal-ai/flux-2-pro' },
  { id: 'flux-2-max', name: 'FLUX.2 Max', group: 'Black Forest Labs', hint: 'Highest FLUX quality', fal: 'fal-ai/flux-2-max' },
  { id: 'gpt-image-2', name: 'GPT Image 2', group: 'OpenAI', hint: 'Instruction-following', fal: 'openai/gpt-image-2' },
  { id: 'seedream-4.5', name: 'Seedream 4.5', group: 'ByteDance', hint: 'Cinematic stills', fal: 'fal-ai/bytedance/seedream/v4.5/text-to-image' },
  { id: 'seedream-5-lite', name: 'Seedream 5.0 Lite', group: 'ByteDance', hint: 'Fast Seedream 5', fal: 'fal-ai/bytedance/seedream/v5/lite/text-to-image', seedream5Lite: true },
  { id: 'seedream-5-pro', name: 'Seedream 5.0 Pro', group: 'ByteDance', hint: 'Latest Seedream', fal: 'bytedance/seedream/v5/pro/text-to-image', seedream5: true },
]

const RATIO_DIMS = {
  '1:1': { w: 1024, h: 1024 },
  '16:9': { w: 1280, h: 720 },
  '9:16': { w: 720, h: 1280 },
  '4:3': { w: 1024, h: 768 },
  '3:4': { w: 768, h: 1024 },
}

const LONG_EDGE = { '1K': 1280, '2K': 2048, '4K': 3840 }

function align16(n) {
  return Math.max(16, Math.round(Number(n) / 16) * 16)
}

export function imageModelById(id) {
  const key = String(id || '').trim()
  return IMAGE_MODELS.find((m) => m.id === key) || IMAGE_MODELS.find((m) => m.id === DEFAULT_IMAGE_MODEL) || IMAGE_MODELS[0]
}

export function imageSizeForAspect(aspect, resolution) {
  const ratio = String(aspect || '9:16').split('·')[0].trim()
  const dims = RATIO_DIMS[ratio] || RATIO_DIMS['9:16']
  const res = LONG_EDGE[resolution] ? resolution : '1K'
  const long = Math.max(dims.w, dims.h) || 1024
  const scale = (LONG_EDGE[res] || 1280) / long
  return {
    image_size: { width: align16(dims.w * scale), height: align16(dims.h * scale) },
    aspect_ratio: RATIO_DIMS[ratio] ? ratio : '9:16',
  }
}

function scaleImageSize(dims, minPx, maxPx) {
  let width = dims.width
  let height = dims.height
  const px = width * height
  if (px < minPx) {
    const s = Math.sqrt(minPx / px)
    width = align16(width * s)
    height = align16(height * s)
  }
  if (width * height > maxPx) {
    const s = Math.sqrt(maxPx / (width * height))
    width = align16(width * s)
    height = align16(height * s)
  }
  return { width, height }
}

export function falImageInput(modelId, prompt, { aspect, num_images, resolution } = {}) {
  const model = imageModelById(modelId)
  const res = resolution || model.resolution || '1K'
  const size = imageSizeForAspect(aspect, res)
  if (model.seedream5Lite) {
    size.image_size = scaleImageSize(size.image_size, 2560 * 1440, 4096 * 4096)
  } else if (model.seedream5) {
    size.image_size = scaleImageSize(size.image_size, 1024 * 1024, 2048 * 2048)
  }
  const input = { prompt: String(prompt || '').trim() || 'cinematic still', ...size }
  if (model.banana) {
    delete input.image_size
    input.resolution = res === '4K' ? '4K' : res === '2K' ? '2K' : '1K'
    input.output_format = 'jpeg'
  }
  const count = Math.max(1, Math.min(4, parseInt(num_images, 10) || 1))
  if (count > 0) input.num_images = count
  return { model, endpoint: model.fal, input }
}

export function urlsFromFalResult(result) {
  if (!result || typeof result !== 'object') return []
  const urls = [
    ...(Array.isArray(result.images) ? result.images.map((img) => (typeof img === 'string' ? img : img?.url)) : []),
    typeof result.image === 'string' ? result.image : result.image?.url,
  ].filter(Boolean)
  return [...new Set(urls)]
}
