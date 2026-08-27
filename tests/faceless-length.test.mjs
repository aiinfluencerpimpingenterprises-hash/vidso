import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  LENGTH_TOLERANCE,
  WORDS_PER_MINUTE,
  countSpokenWords,
  enrichScriptBody,
  facelessMediaPayloadExtras,
  facelessScriptPayload,
  formatDurationSeconds,
  impliedSecondsFromWords,
  isMateriallyShort,
  scriptWordCount,
  targetWordsFromSeconds,
} from '../lib/faceless-length.js'
import { durationFromBody } from '../lib/quota.js'

test('length chips map to one WPM target', () => {
  const rows = [
    [180, 450],
    [300, 750],
    [600, 1500],
    [900, 2250],
    [1800, 4500],
  ]
  for (const [seconds, words] of rows) {
    assert.equal(targetWordsFromSeconds(seconds), words)
    assert.equal(impliedSecondsFromWords(words), seconds)
  }
})

test('missing duration throws instead of defaulting to 3 min', () => {
  assert.throws(() => targetWordsFromSeconds(null), /duration is required/)
  assert.throws(() => targetWordsFromSeconds(0), /duration is required/)
  assert.throws(() => facelessScriptPayload({ topic: 'x', durationId: 'long_300' }), /duration is required/)
  assert.throws(() => facelessMediaPayloadExtras('long_300', undefined), /duration is required/)
  assert.equal(durationFromBody({}), null)
  assert.equal(durationFromBody({ duration_id: 'long_300' }), 300)
})

test('script payload sends minutes on duration so a ?? 3 default cannot win', () => {
  const body = facelessScriptPayload({
    topic: 'Airport secrets',
    aspect: '16:9',
    durationId: 'long_300',
    durationSeconds: 300,
  })
  assert.equal(body.duration_id, 'long_300')
  assert.equal(body.duration, 5)
  assert.equal(body.duration_seconds, 300)
  assert.equal(body.target_minutes, 5)
  assert.equal(body.target_words, 750)
  assert.equal(body.words_per_minute, 150)
  assert.equal(body.aspect, '16:9')
})

test('media extras keep duration in seconds', () => {
  const extra = facelessMediaPayloadExtras('long_300', 300)
  assert.equal(extra.duration, 300)
  assert.equal(extra.duration_seconds, 300)
  assert.equal(extra.target_words, 750)
})

test('a 3 min script is materially short of a 5 min target', () => {
  assert.equal(LENGTH_TOLERANCE, 0.15)
  assert.equal(isMateriallyShort(180, 300), true)
  assert.equal(isMateriallyShort(255, 300), false)
  assert.equal(isMateriallyShort(300, 300), false)
  const short = scriptWordCount({ full_script: Array.from({ length: 450 }, () => 'word').join(' ') })
  assert.equal(short, 450)
  assert.equal(isMateriallyShort(impliedSecondsFromWords(short), 300), true)
})

test('gate enrich fills duration minutes when the client omitted the field', () => {
  const next = enrichScriptBody({ topic: 'x', duration_id: 'long_300' }, 300)
  assert.equal(next.duration, 5)
  assert.equal(next.target_words, 750)
  assert.equal(countSpokenWords('one two  three'), 3)
})
