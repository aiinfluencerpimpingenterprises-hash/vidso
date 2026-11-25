import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { VIDEO_MODELS } from '../lib/fal-video.js'

const shell = readFileSync(fileURLToPath(new URL('../lib/studio-shell.js', import.meta.url)), 'utf8')
const css = readFileSync(fileURLToPath(new URL('../dashboard/index.html', import.meta.url)), 'utf8')

test('the only model card is H3 Max Turbo', () => {
  assert.deepEqual(VIDEO_MODELS.map((m) => m.name), ['MiniMax H3 Max Turbo'])
  assert.doesNotMatch(shell, /id="fs-video-model"/)
})

test('studio model picker builds the lifted card markup', () => {
  assert.match(shell, /function modelCardHtml/)
  assert.match(shell, /class="fs-model-card/)
  assert.match(shell, /fs-model-card-badge/)
  assert.match(css, /button\.fs-model-card\{/)
  assert.match(css, /border:1\.5px solid #6b717a/)
  assert.match(css, /0 8px 18px rgba\(0,0,0,\.28\)/)
})
