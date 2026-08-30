import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  TTS_CHUNK_CHARS,
  chunkNarrationText,
  estimateWordsFromText,
  evenTimelineFromClips,
  isMediaConcatError,
  narrationNeedsChunking,
} from '../lib/faceless-media-fallback.js'

test('detects the Railway media/concat 404', () => {
  assert.equal(isMediaConcatError('Cannot POST /api/media/concat'), true)
  assert.equal(isMediaConcatError({ message: 'media/concat failed' }), true)
  assert.equal(isMediaConcatError('B-roll timed out'), false)
})

test('long narration is chunked under the TTS character cap', () => {
  const sentence = 'This is a spoken sentence about airports and runways. '
  const text = sentence.repeat(200)
  assert.equal(narrationNeedsChunking(text), true)
  const chunks = chunkNarrationText(text, TTS_CHUNK_CHARS)
  assert.ok(chunks.length > 1)
  for (const c of chunks) assert.ok(c.length <= TTS_CHUNK_CHARS)
  assert.equal(chunks.join(' ').replace(/\s+/g, ' ').slice(0, 40), text.replace(/\s+/g, ' ').slice(0, 40))
})

test('short narration stays a single chunk', () => {
  assert.deepEqual(chunkNarrationText('Hello world.'), ['Hello world.'])
  assert.equal(narrationNeedsChunking('Hello world.'), false)
})

test('estimated word timings span the voiceover duration', () => {
  const words = estimateWordsFromText('one two three four', 4)
  assert.equal(words.length, 4)
  assert.equal(words[0].start, 0)
  assert.equal(words[3].end, 4)
})

test('timeline spreads clips across the full duration', () => {
  const tl = evenTimelineFromClips([{ id: 'a' }, { id: 'b' }], 10)
  assert.equal(tl.length, 2)
  assert.equal(tl[0].start, 0)
  assert.equal(tl[0].end, 5)
  assert.equal(tl[1].end, 10)
})
