import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  HUSTLE_LABELS,
  HUSTLE_WINNER,
  buildReel,
  targetOffset,
  easeOutQuint,
  easeOutSlot,
  itemFace,
  createHustleAudio,
} from '../lib/hustle-spin.js'

const home = readFileSync(fileURLToPath(new URL('../home/index.html', import.meta.url)), 'utf8')
const spin = readFileSync(fileURLToPath(new URL('../spin/index.html', import.meta.url)), 'utf8')
const dashboard = readFileSync(fileURLToPath(new URL('../dashboard/index.html', import.meta.url)), 'utf8')
const shell = readFileSync(fileURLToPath(new URL('../lib/hustle-spin.js', import.meta.url)), 'utf8')

test('the reel always parks on Faceless YT Channel', () => {
  const reel = buildReel()
  assert.equal(reel.winner, 'FACELESS YT CHANNEL')
  assert.equal(reel.items[reel.winnerIndex], HUSTLE_WINNER)
  assert.equal(reel.items.lastIndexOf(HUSTLE_WINNER), reel.winnerIndex)
  for (const label of HUSTLE_LABELS) assert.ok(reel.items.includes(label))
})

test('stop offset centers the winning row', () => {
  const reel = buildReel({ loops: 4, tail: 3 })
  const itemHeight = 80
  const viewportHeight = 400
  const y = targetOffset(itemHeight, reel.winnerIndex, viewportHeight)
  const winnerCenter = reel.winnerIndex * itemHeight + itemHeight / 2 - y
  assert.equal(winnerCenter, viewportHeight / 2)
})

test('ease starts fast and finishes on 1', () => {
  assert.equal(easeOutQuint(0), 0)
  assert.equal(easeOutQuint(1), 1)
  assert.ok(easeOutQuint(0.3) > 0.3)
  assert.ok(easeOutQuint(0.8) > 0.95)
  assert.equal(easeOutSlot(0), 0)
  assert.equal(easeOutSlot(1), 1)
  assert.ok(easeOutSlot(0.3) > 0.55)
  assert.ok(easeOutSlot(0.5) > 0.86)
  assert.ok(easeOutSlot(0.5) < 0.95)
  assert.ok(easeOutSlot(0.85) < 0.99)
  assert.ok(easeOutSlot(0.9) > 0.9)
})

test('on-screen labels stay sharp', () => {
  const mid = itemFace(200, 400, 80)
  const edge = itemFace(20, 400, 80)
  assert.equal(mid.filter, 'none')
  assert.equal(mid.opacity, 1)
  assert.ok(edge.opacity < 0.4)
  assert.ok(edge.opacity > 0)
  assert.equal(edge.filter, 'none')
})

test('reel audio can tick and land without a browser context', () => {
  const silent = createHustleAudio(null)
  assert.equal(silent.tick(), false)
  assert.equal(silent.land(), false)
  let osc = 0
  class FakeCtx {
    constructor() { this.state = 'running'; this.currentTime = 0; this.destination = {} }
    createOscillator() {
      osc += 1
      return {
        type: 'sine',
        frequency: { value: 0 },
        connect() { return { connect() {} } },
        start() {},
        stop() {},
      }
    }
    createGain() {
      return {
        gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() { return this },
      }
    }
  }
  const live = createHustleAudio(FakeCtx)
  assert.equal(live.tick(1), true)
  assert.equal(live.land(), true)
  assert.ok(osc >= 4)
})

test('a tap starts the reel without waiting on audio', () => {
  assert.match(shell, /unlockAudio\(\)\s*\n\s*if \(!spinning\) spin\(\)/)
  assert.match(dashboard, /path === '\/spin'\) return/)
})

test('the spinner lives on its own section, not the landing hero', () => {
  assert.doesNotMatch(home, /id="hustle-spin"/)
  assert.match(spin, /id="hustle-spin"/)
  assert.match(spin, /data-hustle-track/)
  assert.match(spin, /hustle-spin-mark is-left/)
  assert.match(spin, /hustle-spin-mark is-right/)
  assert.match(spin, /\/lib\/hustle-spin\.js/)
  assert.match(spin, /FACELESS YT CHANNEL/)
})
