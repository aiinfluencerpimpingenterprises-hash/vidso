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
  VIDEO_MODELS,
} from '../lib/fal-video.js'

test('H3 Max Turbo is the default and maps to the Fal text-to-video endpoint', () => {
  assert.equal(DEFAULT_VIDEO_MODEL, 'h3-max-turbo')
  const { endpoint, input, model } = falVideoInput('h3-max-turbo', 'fireflies at dusk', { aspect: '9:16', duration: 7 })
  assert.equal(model.id, 'h3-max-turbo')
  assert.equal(endpoint, 'minimax/h3-max-turbo/text-to-video')
  assert.equal(input.aspect_ratio, '9:16')
  assert.equal(input.duration, 7)
  assert.equal(input.resolution, '768P')
  assert.equal(input.prompt_expansion_mode, 'disabled')
  assert.equal(input.prompt, 'fireflies at dusk')
})

test('H3 Max Turbo is the only video model; old picks fall back to it', () => {
  assert.deepEqual(VIDEO_MODELS.map((m) => m.id), ['h3-max-turbo'])
  for (const old of ['kling-3-pro', 'veo-3.1', 'seedance-2', 'sora-2', 'wan-2.7', 'hailuo-02', 'hailuo-02-std']) {
    assert.equal(isFalVideoModel(old), false)
    assert.equal(videoModelById(old).id, 'h3-max-turbo')
  }
})

test('unknown and stock ids are not Fal models', () => {
  assert.equal(isFalVideoModel(STOCK_VIDEO_MODEL), false)
  assert.equal(isFalVideoModel(''), false)
  assert.equal(isFalVideoModel('not-real'), false)
  assert.equal(isFalVideoModel('h3-max-turbo'), true)
  assert.equal(videoModelById('not-real').id, DEFAULT_VIDEO_MODEL)
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

test('reference image switches H3 to image-to-video with no aspect ratio', () => {
  const { endpoint, input, imageToVideo } = falVideoInput('h3-max-turbo', 'the bowl turns', {
    image_urls: ['https://cdn.example/ref.jpg'],
    duration: 4,
  })
  assert.equal(imageToVideo, true)
  assert.equal(endpoint, 'minimax/h3-max-turbo/image-to-video')
  assert.equal(input.image_url, 'https://cdn.example/ref.jpg')
  assert.equal(input.aspect_ratio, undefined)
  assert.equal(input.duration, 4)
})

test('generation count clamps to 1 through 4', () => {
  assert.equal(clampVideoCount(0), 1)
  assert.equal(clampVideoCount(9), 4)
  assert.equal(clampVideoCount(2), 2)
  assert.equal(clipDurationFor('h3-max-turbo', 9), 8)
  assert.equal(resolutionFor('h3-max-turbo', '1080p'), '768P')
  assert.equal(videoModelLabel('h3-max-turbo'), 'MiniMax H3 Max Turbo')
  assert.equal(videoModelLabel('stock'), 'Stock footage')
})
