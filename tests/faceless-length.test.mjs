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
  listCountFromTopic,
  rebuildFullScript,
  scriptLengthBrief,
  scriptTimeoutMs,
  scriptWordCount,
  sectionNeedsExpand,
  targetSectionCount,
  targetWordsFromSeconds,
  wordsPerSection,
} from '../lib/faceless-length.js'
import { durationFromBody } from '../lib/quota.js'

test('5 min chip is 750 words at 150 wpm', () => {
  assert.equal(WORDS_PER_MINUTE, 150)
  assert.equal(targetWordsFromSeconds(300), 750)
  assert.equal(impliedSecondsFromWords(750), 300)
  assert.equal(formatDurationSeconds(300), '5 min')
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
  const next = enrichScriptBody({ topic: '12 biggest airports', duration_id: 'long_300' }, 300)
  assert.equal(next.duration, 5)
  assert.equal(next.target_words, 750)
  assert.equal(next.target_sections, 12)
  assert.equal(next.words_per_section, 63)
  assert.match(next.brief, /5 min/)
  assert.equal(countSpokenWords('one two  three'), 3)
})

test('list topics drive section count and the length brief', () => {
  assert.equal(listCountFromTopic('12 biggest airports'), 12)
  assert.equal(targetSectionCount('12 biggest airports', 1800), 12)
  assert.equal(targetSectionCount('airport secrets', 1800), 12)
  assert.equal(targetSectionCount('airport secrets', 180), 4)
  assert.equal(wordsPerSection(4500, 12), 375)
  assert.equal(sectionNeedsExpand('short text here', 375), true)
  assert.equal(sectionNeedsExpand(Array.from({ length: 400 }, () => 'word').join(' '), 375), false)
  assert.equal(scriptTimeoutMs(1800), 144000)
  assert.equal(scriptTimeoutMs(60), 90000)
  const brief = scriptLengthBrief({
    topic: '12 biggest airports',
    durationSeconds: 1800,
    targetWords: 4500,
  })
  assert.match(brief, /4500 words/)
  assert.match(brief, /exactly 12 separate sections/)
  const rebuilt = rebuildFullScript({
    sections: [{ id: 'a', text: 'Hello there.' }, { id: 'b', text: 'More words.' }],
  })
  assert.equal(rebuilt.full_script, 'Hello there.\n\nMore words.')
})

test('script payload includes section budget for long targets', () => {
  const body = facelessScriptPayload({
    topic: '12 biggest airports',
    aspect: '16:9',
    durationId: 'long_1800',
    durationSeconds: 1800,
  })
  assert.equal(body.target_words, 4500)
  assert.equal(body.target_sections, 12)
  assert.equal(body.words_per_section, 375)
  assert.match(body.brief, /30 min/)
})

test('duration_seconds wins over duration minutes when id is missing', () => {
  assert.equal(durationFromBody({ duration: 30, duration_seconds: 1800 }), 1800)
  assert.equal(durationFromBody({ target_minutes: 30 }), 1800)
  assert.equal(durationFromBody({ duration: 45 }), 45)
})
