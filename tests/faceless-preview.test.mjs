import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  FACELESS_CAPTION_DEFAULT_SIZE,
  FACELESS_CAPTION_EXPORT_HEIGHT,
  FACELESS_CAPTION_SHADOW_CSS,
  captionLayerShadow,
  captionPreviewPx,
  captionPreviewStrokePx,
  captionStrokeShadow,
  clipPlaybackRange,
  clipTimelineOffset,
  previewLoadTarget,
  youtubeWatchUrl,
} from '../lib/faceless-preview.js'

test('YouTube caption default is a readable 1080p size', () => {
  assert.equal(FACELESS_CAPTION_EXPORT_HEIGHT, 1080)
  assert.equal(FACELESS_CAPTION_DEFAULT_SIZE, 64)
  assert.ok(FACELESS_CAPTION_DEFAULT_SIZE >= 48)
  assert.ok(FACELESS_CAPTION_DEFAULT_SIZE <= 80)
})

test('preview caption px scales from 1080p down to the stage', () => {
  assert.equal(captionPreviewPx(64, 540), 32)
  assert.equal(captionPreviewPx(64, 1080), 64)
  assert.equal(captionPreviewPx(64, 0), 64)
  assert.equal(captionPreviewPx(0, 540), 64)
})

test('YouTube clips expose the watch URL for the clip proxy', () => {
  assert.equal(
    youtubeWatchUrl({ source: 'youtube', youtube_url: 'https://youtu.be/abc', url: '/api/download/stream?url=x' }),
    'https://youtu.be/abc',
  )
  assert.equal(
    youtubeWatchUrl({ source: 'youtube', pexels_url: 'https://www.youtube.com/watch?v=abc' }),
    'https://www.youtube.com/watch?v=abc',
  )
  assert.equal(youtubeWatchUrl({ url: 'https://videos.pexels.com/clip.mp4' }), '')
})

test('trimmed YouTube clips seek from 0, stock files keep clip_start', () => {
  const clip = { start: 10, end: 18, clip_start: 20 }
  assert.deepEqual(clipPlaybackRange(clip), { start: 20, end: 28 })
  assert.equal(clipTimelineOffset(clip, 12, { trimmed: false }), 22)
  assert.equal(clipTimelineOffset(clip, 12, { trimmed: true }), 2)
})

test('first preview clip loads on the visible player', () => {
  assert.equal(previewLoadTarget({ onHasUrl: false, offHasReadyUrl: false }), 'on')
  assert.equal(previewLoadTarget({ onHasUrl: true, offHasReadyUrl: false }), 'on')
  assert.equal(previewLoadTarget({ onHasUrl: false, offHasReadyUrl: true }), 'swap')
})

test('caption stroke and shadow compose a CSS text-shadow', () => {
  assert.equal(captionLayerShadow({}), 'none')
  assert.equal(captionLayerShadow({ shadow: true }), FACELESS_CAPTION_SHADOW_CSS)
  assert.equal(captionPreviewStrokePx(3, 540), 1.5)
  assert.match(captionStrokeShadow('#000000', 2), /-2px -2px 0 #000000/)
  const both = captionLayerShadow({
    shadow: true,
    stroke: true,
    strokeColor: '#000000',
    strokeWidth: 3,
    previewWidth: 1.5,
  })
  assert.match(both, /#000000/)
  assert.ok(both.includes(FACELESS_CAPTION_SHADOW_CSS))
})
