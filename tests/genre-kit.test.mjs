import { test } from 'node:test'
import assert from 'node:assert/strict'
import { voiceGroupFor, rankVoices, bestForIds, voiceSettingsFor, captionLookFor, cameraMoveFor, VOICE_GROUPS } from '../lib/genre-kit.js'
import { retentionBrief, retentionOutlineBrief, stripWrapUp, stripScriptWrapUp, rehookCount, hookFormulaFor } from '../lib/retention.js'
import { facelessScriptPayload } from '../lib/faceless-length.js'
import { stylesForNiche, GENRES } from '../lib/onboarding.js'
import { visualStyleById } from '../lib/visual-styles.js'

test('channels map to a voice group by niche, words, then genre', () => {
  assert.equal(voiceGroupFor({ niche: 'crime' }), 'mystery')
  assert.equal(voiceGroupFor({ niche: 'Crypto scams' }), 'mystery')
  assert.equal(voiceGroupFor({ niche: 'psychology' }), 'psychology')
  assert.equal(voiceGroupFor({ genre: 'history' }), 'history')
  assert.equal(voiceGroupFor({ about: 'channel about how the stock market works' }), 'finance')
  assert.equal(voiceGroupFor({ genre: 'kids' }), 'kids')
  assert.equal(voiceGroupFor({}), 'education')
})

test('voices rank by name, then by their labels; the best few are tagged', () => {
  const voices = [
    { id: 'a', name: 'Laura', gender: 'female', desc: 'upbeat, sassy', preview: 'x' },
    { id: 'b', name: 'Bill', gender: 'male', desc: 'trustworthy, old', preview: 'x' },
    { id: 'c', name: 'Zed', gender: 'male', desc: 'deep, raspy narrator', preview: 'x' },
    { id: 'd', name: 'George', gender: 'male', accent: 'british', desc: 'warm, mature', preview: 'x' },
  ]
  const mystery = rankVoices(voices, 'mystery').map((v) => v.id)
  assert.equal(mystery[0], 'b')
  assert.ok(mystery.indexOf('c') < mystery.indexOf('a'))
  assert.equal(rankVoices(voices, 'history')[0].id, 'd')
  assert.ok(bestForIds(voices, 'mystery').includes('b'))
  assert.ok(!bestForIds(voices, 'mystery').includes('a'))
})

test('each group has narration settings, a caption look and a camera move', () => {
  for (const key of Object.keys(VOICE_GROUPS)) {
    const s = voiceSettingsFor(key)
    assert.ok(s.stability > 0 && s.stability <= 1 && s.speed >= 0.85 && s.speed <= 1.1, key)
    assert.ok(captionLookFor(key))
    assert.ok(cameraMoveFor(key).length > 10)
  }
})

test('the script brief carries the hook formula, re-hook count and next-episode tease', () => {
  const b = retentionBrief({ seconds: 600, formatId: 'mystery-file', nextTopic: 'The ship that sailed itself', title: 'The Lake That Swallowed a Town' })
  assert.match(b, /Cold open at the strangest moment/)
  assert.match(b, /prove the title "The Lake That Swallowed a Town"/)
  assert.match(b, /about 6 times/)
  assert.match(b, /tease the next video, "The ship that sailed itself"/)
  assert.match(retentionOutlineBrief({ nextTopic: 'X' }), /teasing the next video, "X"/)
  assert.equal(rehookCount(120), 1)
  assert.equal(hookFormulaFor('nope'), hookFormulaFor('documentary'))
  const p = facelessScriptPayload({ topic: 'Why the Bermuda Triangle is a myth', aspect: '16:9', durationId: 'long_300', durationSeconds: 300, nextTopic: 'Flight 19' })
  assert.match(p.brief, /Flight 19/)
  assert.equal(p.next_topic, 'Flight 19')
})

test('wrap-up lines are cut from the end, real endings are kept', () => {
  assert.equal(stripWrapUp('The letters stopped in 1974. Nobody knows who sent the last one. Thanks for watching! See you next time.'), 'The letters stopped in 1974. Nobody knows who sent the last one.')
  assert.equal(stripWrapUp('And that is why the bridge still stands. Don\'t forget to like and subscribe.'), 'And that is why the bridge still stands.')
  assert.equal(stripWrapUp('The case is still open. Who do you think did it?'), 'The case is still open. Who do you think did it?')
  const s = stripScriptWrapUp({ sections: [{ text: 'One.' }, { text: 'The end is near. That\'s it for today.' }], full_script: 'x' })
  assert.equal(s.sections[1].text, 'The end is near.')
})

test('every style named for a niche or genre exists', () => {
  for (const n of ['history', 'military', 'business', 'psychology', 'space', 'philosophy', 'crime', 'tech', 'finance', 'health', 'geography']) {
    assert.equal(stylesForNiche(n).length, 6, n)
  }
  for (const g of GENRES) for (const id of g.styles) assert.ok(visualStyleById(id), g.id + ':' + id)
})
