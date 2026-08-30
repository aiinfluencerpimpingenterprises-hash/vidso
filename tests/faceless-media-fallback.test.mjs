import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  TTS_CHUNK_CHARS,
  chunkNarrationText,
  concatMpegUrls,
  estimateWordsFromText,
  evenTimelineFromClips,
  isMediaConcatError,
  isUploadFailedError,
  isVoiceoverJoinError,
  narrationNeedsChunking,
  playlistOffsetAt,
  voiceoverPlaylist,
} from '../lib/faceless-media-fallback.js'

test('detects the Railway media/concat 404', () => {
  assert.equal(isMediaConcatError('Cannot POST /api/media/concat'), true)
  assert.equal(isMediaConcatError({ message: 'media/concat failed' }), true)
  assert.equal(isMediaConcatError('B-roll timed out'), false)
})

test('detects upload failures from the join step', () => {
  assert.equal(isUploadFailedError('Upload failed'), true)
  assert.equal(isUploadFailedError({ message: 'Could not save the merged voiceover' }), true)
  assert.equal(isUploadFailedError('B-roll timed out'), false)
})

test('join errors include the browser download failure', () => {
  assert.equal(isVoiceoverJoinError('Could not download a voiceover chunk'), true)
  assert.equal(isVoiceoverJoinError('Cannot POST /api/media/concat'), true)
  assert.equal(isVoiceoverJoinError('B-roll timed out'), false)
})

test('playlist prefers the part list over a single joined URL', () => {
  assert.deepEqual(
    voiceoverPlaylist({
      voiceover_url: 'https://cdn.example/a.mp3',
      voiceover_urls: ['https://cdn.example/a.mp3', 'https://cdn.example/b.mp3'],
    }),
    ['https://cdn.example/a.mp3', 'https://cdn.example/b.mp3'],
  )
  assert.deepEqual(voiceoverPlaylist({ voiceover_url: 'https://cdn.example/a.mp3' }), ['https://cdn.example/a.mp3'])
})

test('playlist offset maps global time onto the right part', () => {
  assert.deepEqual(playlistOffsetAt([10, 8], 0), { index: 0, local: 0 })
  assert.deepEqual(playlistOffsetAt([10, 8], 10), { index: 1, local: 0 })
  assert.deepEqual(playlistOffsetAt([10, 8], 12), { index: 1, local: 2 })
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

test('mpeg byte-join keeps parts in order', async () => {
  const a = new Uint8Array([1, 2, 3]).buffer
  const b = new Uint8Array([4, 5]).buffer
  const fetchFn = async (url) => ({
    ok: true,
    headers: { get: () => 'audio/mpeg' },
    arrayBuffer: async () => (url.endsWith('a') ? a : b),
  })
  const joined = await concatMpegUrls(['https://x/a', 'https://x/b'], { fetch: fetchFn })
  assert.equal(joined.mime, 'audio/mpeg')
  assert.equal(joined.bytes, 5)
  assert.equal(joined.filename, 'faceless-voiceover.mp3')
  const out = new Uint8Array(await joined.blob.arrayBuffer())
  assert.deepEqual([...out], [1, 2, 3, 4, 5])
})
