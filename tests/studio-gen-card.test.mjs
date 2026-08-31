import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  clampGenerationProgress,
  generationCardHtml,
  generationProgressToward,
} from '../lib/studio-gen-card.js'

const dashboard = readFileSync(fileURLToPath(new URL('../dashboard/index.html', import.meta.url)), 'utf8')
const studio = readFileSync(fileURLToPath(new URL('../lib/faceless-studio.js', import.meta.url)), 'utf8')

test('generation card shows generating plus a circular percent', () => {
  const html = generationCardHtml({ progress: 23, label: 'generating' })
  assert.match(html, /id="fs-gen-card"/)
  assert.match(html, /<strong>generating<\/strong>/)
  assert.match(html, /23%\.\.\./)
  assert.match(html, /--fs-gen-deg:83deg/)
  assert.match(html, /fs-gen-spin/)
  assert.doesNotMatch(html, /Ask before generating/)
})

test('generation progress eases toward the cap and never jumps to 100 early', () => {
  assert.equal(clampGenerationProgress(-4), 0)
  assert.equal(clampGenerationProgress(140), 100)
  assert.equal(generationProgressToward(0), 3)
  const mid = generationProgressToward(8000)
  assert.ok(mid > 20 && mid < 80, 'mid-run percent was ' + mid)
  assert.equal(generationProgressToward(120000), 90)
})

test('studio generate skips the ask modal and mounts the top-left card', () => {
  assert.match(dashboard, /id="fs-gen-host"/)
  assert.match(dashboard, /@keyframes fs-gen-spin/)
  assert.doesNotMatch(studio, /confirmAsk\(/)
  assert.match(studio, /startGenCard\(\)/)
})
