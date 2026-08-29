import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_VIDEO_MODEL,
  STOCK_VIDEO_MODEL,
  clampVideoCount,
  clipDurationFor,
  falVideoInput,
  resolutionFor,
  videoModelLabel,
  isFalVideoModel,
  urlsFromFalVideoResult,
  videoModelById,
} from '../lib/fal-video.js'

test('Kling 3 Pro maps to the Fal text-to-video endpoint', () => {
  const { endpoint, input, model } = falVideoInput('kling-3-pro', 'fireflies at dusk', { aspect: '9:16', duration: 7 })
  assert.equal(model.id, 'kling-3-pro')
  assert.equal(endpoint, 'fal-ai/kling-video/v3/pro/text-to-video')
  assert.equal(input.aspect_ratio, '9:16')
  assert.equal(input.duration, '7')
  assert.equal(input.generate_audio, false)
  assert.equal(input.prompt, 'fireflies at dusk')
})

test('unknown and stock ids are not Fal models', () => {
  assert.equal(isFalVideoModel(STOCK_VIDEO_MODEL), false)
  assert.equal(isFalVideoModel(''), false)
  assert.equal(isFalVideoModel('not-real'), false)
  assert.equal(isFalVideoModel('kling-3-pro'), true)
  assert.equal(videoModelById('not-real').id, DEFAULT_VIDEO_MODEL)
})

test('Veo uses 8s duration labels and 16:9 by default', () => {
  const { endpoint, input } = falVideoInput('veo-3.1', 'tokyo alley', { aspect: '16:9', duration: 10 })
  assert.equal(endpoint, 'fal-ai/veo3.1')
  assert.equal(input.duration, '8s')
  assert.equal(input.aspect_ratio, '16:9')
  assert.equal(input.resolution, '720p')
})

test('Seedance clamps duration and can enable audio', () => {
  const { endpoint, input } = falVideoInput('seedance-2', 'underwater match', {
    aspect: '9:16',
    duration: 20,
    generate_audio: true,
  })
  assert.equal(endpoint, 'bytedance/seedance-2.0/text-to-video')
  assert.equal(input.duration, '15')
  assert.equal(input.generate_audio, true)
})

test('stock footage cannot build a Fal payload', () => {
  assert.throws(
    () => falVideoInput(STOCK_VIDEO_MODEL, 'x'),
    (err) => err.code === 'no_video_model'
  )
})

test('video result parser reads video.url', () => {
  assert.deepEqual(
    urlsFromFalVideoResult({ video: { url: 'https://v.mp4' }, videos: [{ url: 'https://v.mp4' }] }),
    ['https://v.mp4']
  )
})

test('reference image switches Kling to image-to-video', () => {
  const { endpoint, input, imageToVideo } = falVideoInput('kling-3-pro', 'the bowl turns', {
    image_urls: ['https://cdn.example/ref.jpg'],
    generate_audio: true,
    duration: 12,
  })
  assert.equal(imageToVideo, true)
  assert.equal(endpoint, 'fal-ai/kling-video/v3/pro/image-to-video')
  assert.equal(input.start_image_url, 'https://cdn.example/ref.jpg')
  assert.equal(input.generate_audio, true)
  assert.equal(input.duration, '12')
})

test('generation count clamps to 1 through 4', () => {
  assert.equal(clampVideoCount(0), 1)
  assert.equal(clampVideoCount(9), 4)
  assert.equal(clampVideoCount(2), 2)
  assert.equal(clipDurationFor('veo-3.1', 10), 8)
  assert.equal(resolutionFor('veo-3.1', '4k'), '4k')
  assert.equal(resolutionFor('kling-3-pro', '1080p'), '')
  assert.equal(videoModelLabel('kling-3-pro'), 'Kling 3.0 Pro')
  assert.equal(videoModelLabel('stock'), 'Stock footage')
})
