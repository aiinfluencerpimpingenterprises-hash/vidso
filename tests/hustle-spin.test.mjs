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
} from '../lib/hustle-spin.js'

const home = readFileSync(fileURLToPath(new URL('../home/index.html', import.meta.url)), 'utf8')

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
  assert.ok(easeOutSlot(0.5) < 0.7)
  assert.ok(easeOutSlot(0.9) > 0.9)
})

test('the landing hero mounts the spinner', () => {
  assert.match(home, /id="hustle-spin"/)
  assert.match(home, /data-hustle-track/)
  assert.match(home, /\/lib\/hustle-spin\.js/)
  assert.match(home, /FACELESS YT CHANNEL/)
})
