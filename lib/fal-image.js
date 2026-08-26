// Fal text-to-image catalog. IDs here are what the dashboard picker sends
// and what /api/generate/image maps to fal.run endpoints.

import { aspectById, DEFAULT_IMAGE_ASPECT } from './image-gen.js'

export const DEFAULT_IMAGE_MODEL = 'nano-banana-pro'

export const IMAGE_MODELS = [
  { id: 'nano-banana-pro', name: 'Nano Banana Pro', group: 'Google', hint: '2K, best text and detail', fal: 'fal-ai/nano-banana-pro', falEdit: 'fal-ai/nano-banana-pro/edit', banana: true, resolution: '2K', imageInput: true },
  { id: 'nano-banana', name: 'Nano Banana', group: 'Google', hint: 'Fast, strong text', fal: 'fal-ai/nano-banana', falEdit: 'fal-ai/nano-banana/edit', banana: true, resolution: '1K', imageInput: true },
  { id: 'flux-2-pro', name: 'FLUX.2 Pro', group: 'Black Forest Labs', hint: 'Photoreal, detailed', fal: 'fal-ai/flux-2-pro', falEdit: 'fal-ai/flux-2-pro/edit', imageInput: true },
  { id: 'flux-2-max', name: 'FLUX.2 Max', group: 'Black Forest Labs', hint: 'Highest FLUX quality', fal: 'fal-ai/flux-2-max' },
  { id: 'gpt-image-2', name: 'GPT Image 2', group: 'OpenAI', hint: 'Instruction-following', fal: 'openai/gpt-image-2' },
  { id: 'seedream-4.5', name: 'Seedream 4.5', group: 'ByteDance', hint: 'Cinematic stills', fal: 'fal-ai/bytedance/seedream/v4.5/text-to-image' },
  { id: 'seedream-5-lite', name: 'Seedream 5.0 Lite', group: 'ByteDance', hint: 'Fast Seedream 5', fal: 'fal-ai/bytedance/seedream/v5/lite/text-to-image', seedream5Lite: true },
  { id: 'seedream-5-pro', name: 'Seedream 5.0 Pro', group: 'ByteDance', hint: 'Latest Seedream', fal: 'bytedance/seedream/v5/pro/text-to-image', seedream5: true },
]

const LONG_EDGE = { '1K': 1280, '2K': 2048, '4K': 3840 }

function align16(n) {
  return Math.max(16, Math.round(Number(n) / 16) * 16)
}

export function imageModelById(id) {
  const key = String(id || '').trim()
  return IMAGE_MODELS.find((m) => m.id === key) || IMAGE_MODELS.find((m) => m.id === DEFAULT_IMAGE_MODEL) || IMAGE_MODELS[0]
}

export function imageSizeForAspect(aspect, resolution) {
  const spec = aspectById(aspect)
  const ratioId = spec?.id === 'auto' ? DEFAULT_IMAGE_ASPECT : (spec?.id || DEFAULT_IMAGE_ASPECT)
  const parsed = String(ratioId).split(':').map(Number)
  const rw = parsed[0] > 0 ? parsed[0] : 16
  const rh = parsed[1] > 0 ? parsed[1] : 9
  const res = LONG_EDGE[resolution] ? resolution : '1K'
  const long = LONG_EDGE[res] || 1280
  const landscape = rw >= rh
  const width = landscape ? long : align16(long * (rw / rh))
  const height = landscape ? align16(long * (rh / rw)) : long
  return {
    image_size: { width: align16(width), height: align16(height) },
    aspect_ratio: spec?.id === 'auto' ? 'auto' : ratioId,
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

function cleanImageUrls(urls) {
  if (!Array.isArray(urls)) return []
  return urls.map((u) => String(u || '').trim()).filter(Boolean).slice(0, 4)
}

export function falImageInput(modelId, prompt, { aspect, num_images, resolution, image_urls } = {}) {
  const model = imageModelById(modelId)
  const refs = cleanImageUrls(image_urls)
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
  let endpoint = model.fal
  if (refs.length) {
    if (!model.imageInput || !model.falEdit) {
      const err = new Error('This model is text only. Pick a model that accepts a reference image.')
      err.code = 'no_image_input'
      throw err
    }
    endpoint = model.falEdit
    input.image_urls = refs
  }
  return { model, endpoint, input, size: size.image_size }
}

export function urlsFromFalResult(result) {
  if (!result || typeof result !== 'object') return []
  const urls = [
    ...(Array.isArray(result.images) ? result.images.map((img) => (typeof img === 'string' ? img : img?.url)) : []),
    typeof result.image === 'string' ? result.image : result.image?.url,
  ].filter(Boolean)
  return [...new Set(urls)]
}

export function dimsFromFalResult(result) {
  const first = Array.isArray(result?.images) ? result.images[0] : result?.image
  if (!first || typeof first === 'string') return null
  const width = parseInt(first.width, 10)
  const height = parseInt(first.height, 10)
  if (!width || !height) return null
  return { width, height }
}
