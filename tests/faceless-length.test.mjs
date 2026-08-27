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
  mergeNewSections,
  needsMoreSections,
  padListSections,
  rebuildFullScript,
  scriptLengthBrief,
  scriptTimeoutMs,
  scriptWordCount,
  sectionNeedsExpand,
  stitchSectionText,
  trimSpokenText,
  capScriptToTarget,
  packScriptRequest,
  RAILWAY_TOPIC_MAX,
  outlineTargetWords,
  scriptUpstreamBody,
  shouldOutlineFirst,
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
  assert.equal(sectionNeedsExpand(Array.from({ length: 220 }, () => 'word').join(' '), 300, 0.7), false)
  assert.equal(sectionNeedsExpand(Array.from({ length: 220 }, () => 'word').join(' '), 300, 0.9), true)
  const stitched = stitchSectionText('Hello there friends.', 'And then the tiger stepped closer to the river bank.')
  assert.match(stitched, /Hello there friends/)
  assert.match(stitched, /river bank/)
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
  assert.equal(body.outline, true)
  assert.equal(body.final_target_words, 4500)
  assert.equal(body.target_sections, 12)
  assert.equal(body.target_words, 720)
  assert.equal(body.words_per_section, 60)
  assert.equal(shouldOutlineFirst(4500), true)
  assert.equal(shouldOutlineFirst(750), false)
  assert.equal(outlineTargetWords(15), 900)
  assert.match(body.brief, /valid JSON/i)
  assert.equal(scriptUpstreamBody(body).duration_id, undefined)
})

test('gate enrich keeps an outline word budget', () => {
  const next = enrichScriptBody({
    topic: '15 biggest tigers of all time',
    duration_id: 'long_1800',
    outline: true,
    target_words: 900,
    duration: 6,
    final_target_words: 4500,
  }, 1800)
  assert.equal(next.target_words, 900)
  assert.equal(next.duration, 6)
  assert.equal(next.final_target_words, 4500)
  assert.equal(next.duration_seconds, 360)
})

test('missing list sections are merged and padded to the topic count', () => {
  const existing = [{ id: 's1', heading: 'Siberian tiger', text: 'Snow.' }]
  const added = mergeNewSections(existing, [
    { heading: 'Siberian tiger', text: 'dup' },
    { heading: 'Bengal tiger', text: 'India.' },
  ], 4)
  assert.equal(added.length, 1)
  assert.equal(added[0].heading, 'Bengal tiger')
  const padded = padListSections(existing.concat(added), 15)
  assert.equal(padded.length, 15)
  assert.equal(padded[14].heading, 'Item 15 of 15')
  assert.equal(needsMoreSections({ sections: existing }, 15), true)
  assert.equal(needsMoreSections({ sections: padded }, 15), false)
})

test('duration_seconds wins over duration minutes when id is missing', () => {
  assert.equal(durationFromBody({ duration: 30, duration_seconds: 1800 }), 1800)
  assert.equal(durationFromBody({ target_minutes: 30 }), 1800)
  assert.equal(durationFromBody({ duration: 45 }), 45)
})

test('script request keeps topic under the Railway 500 cap', () => {
  const brief = scriptLengthBrief({
    topic: 'Oak Ridge: the secret city',
    durationSeconds: 600,
    targetWords: 1500,
  })
  const user = 'Oak Ridge: the secret city behind the atomic bomb, how it was built in secret, the people who lived there, and why it still matters today. ' +
    Array.from({ length: 40 }, () => 'More detail about the lab, the fences, and the cover story.').join(' ')
  const packed = packScriptRequest({ topic: user, brief, extra: 'Write 8 sections.' })
  assert.ok(packed.topic.length <= RAILWAY_TOPIC_MAX)
  assert.ok(user.length > RAILWAY_TOPIC_MAX)
  assert.equal(packed.prompt, user)
  assert.match(packed.brief, /Hard length/)
  assert.ok(packed.brief.includes(user))
  const short = packScriptRequest({ topic: '15 biggest tigers', brief })
  assert.equal(short.topic, '15 biggest tigers')
  assert.equal(short.brief, brief)
})

test('capScriptToTarget trims a 30 min overshoot back to 4500 words', () => {
  const sentence = 'The tiger moved through the trees with quiet power. '
  const long = Array.from({ length: 40 }, () => sentence).join('')
  const script = {
    sections: Array.from({ length: 15 }, (_, i) => ({
      id: 's' + (i + 1),
      heading: 'Tiger ' + (i + 1),
      text: long,
    })),
  }
  rebuildFullScript(script)
  assert.ok(scriptWordCount(script) > 4500)
  capScriptToTarget(script, 4500)
  assert.ok(scriptWordCount(script) <= 4500)
  assert.ok(scriptWordCount(script) >= 3600)
  assert.match(trimSpokenText('One two three. Four five six seven.', 4), /One two three\./)
})
