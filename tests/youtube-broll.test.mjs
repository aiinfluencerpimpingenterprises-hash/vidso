import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  assembleYoutubeBroll,
  brollQueriesFromScript,
  cleanBrollQuery,
  introSkipSeconds,
  pickYoutubeVideo,
  timelineFromPicks,
} from '../lib/youtube-broll.js'

test('cleanBrollQuery strips list numbers and skip headings', () => {
  assert.equal(cleanBrollQuery('1. Antonov An-225 Mriya'), 'Antonov An-225 Mriya')
  assert.equal(cleanBrollQuery('Number 12: Airbus A380'), 'Airbus A380')
  assert.equal(cleanBrollQuery('Intro'), '')
  assert.equal(cleanBrollQuery('  "Boeing 747"  '), 'Boeing 747')
})

test('brollQueriesFromScript prefers section headings then keywords', () => {
  const script = {
    topic: '12 biggest planes in the world',
    keywords: ['aviation', 'Antonov An-225'],
    sections: [
      { heading: '1. Antonov An-225 Mriya', text: 'The biggest plane ever built.' },
      { heading: '2. Airbus A380', text: 'A double-deck giant.' },
      { heading: 'Intro', text: 'Welcome back.' },
    ],
  }
  assert.deepEqual(brollQueriesFromScript(script), [
    'Antonov An-225 Mriya',
    'Airbus A380',
    'aviation',
  ])
})

test('brollQueriesFromScript falls back to the topic', () => {
  assert.deepEqual(brollQueriesFromScript({ topic: '12 biggest planes in the world' }), [
    '12 biggest planes in the world',
  ])
  assert.deepEqual(brollQueriesFromScript({}), [])
})

test('pickYoutubeVideo skips used ids and prefers longer videos', () => {
  const videos = [
    { id: 'short', url: 'https://youtu.be/short', duration: 12 },
    { id: 'long', url: 'https://youtu.be/long', duration: 420 },
    { id: 'mid', url: 'https://youtu.be/mid', duration: 90 },
  ]
  const usedIds = new Set()
  const first = pickYoutubeVideo(videos, { usedIds })
  assert.equal(first.id, 'long')
  usedIds.add(first.id)
  const second = pickYoutubeVideo(videos, { usedIds })
  assert.equal(second.id, 'mid')
})

test('timelineFromPicks even-splits voiceover and skips intros', () => {
  const picks = [
    {
      query: 'Antonov An-225',
      video: { id: 'a', url: 'https://youtu.be/a', duration: 300, title: 'An-225' },
      clip: { id: 'yt_a', url: 'https://stream/a', preview: 'https://img/a' },
    },
    {
      query: 'Airbus A380',
      video: { id: 'b', url: 'https://youtu.be/b', duration: 240, title: 'A380' },
      clip: { id: 'yt_b', url: 'https://stream/b', preview: 'https://img/b' },
    },
  ]
  const tl = timelineFromPicks({ duration: 180, picks })
  assert.equal(tl.length, 2)
  assert.equal(tl[0].start, 0)
  assert.equal(tl[0].end, 90)
  assert.equal(tl[1].end, 180)
  assert.equal(tl[0].source, 'youtube')
  assert.equal(tl[0].youtube_url, 'https://youtu.be/a')
  assert.ok(tl[0].clip_start >= 6)
  assert.equal(introSkipSeconds(10, 8), 0)
})

test('assembleYoutubeBroll searches each section and builds a timeline', async () => {
  const script = {
    sections: [
      { heading: 'Antonov An-225' },
      { heading: 'Airbus A380' },
    ],
  }
  const seen = []
  const result = await assembleYoutubeBroll({
    script,
    duration: 120,
    concurrency: 2,
    search: async (q) => {
      seen.push(q)
      return {
        videos: [{ id: q.slice(0, 4), url: 'https://youtu.be/' + q, duration: 200, title: q, thumbnail: 't' }],
      }
    },
    mapClip: (video, query) => ({
      id: 'yt_' + video.id,
      url: 'stream:' + video.url,
      preview: video.thumbnail,
      query,
    }),
  })
  assert.deepEqual(seen.sort(), ['Airbus A380', 'Antonov An-225'])
  assert.equal(result.found, 2)
  assert.equal(result.timeline.length, 2)
  assert.equal(result.clips[0].url.startsWith('stream:'), true)
})
