import test from 'node:test'
import assert from 'node:assert/strict'
import { newRun, advanceRun, publicRun } from '../lib/video-run.js'

/** Fake services: every call answers instantly; jobs finish on the second poll. */
function fakeIo({ failRender = false } = {}) {
  let t = 1_000_000
  const calls = []
  const polls = {}
  const words = (n) => Array.from({ length: n }, (_, i) => 'word' + i).join(' ')
  const io = {
    now: () => t,
    sleep: async (ms) => { t += ms },
    budgetMs: 60000,
    calls,
    async call(base, method, path, body) {
      calls.push(`${base} ${method} ${path}`)
      t += 50
      if (path === '/api/faceless/script') {
        return { title: 'Walking', sections: [{ id: 's1', heading: 'Start', text: 'You walk ten thousand steps. ' + words(220) }, { id: 's2', heading: 'Heart', text: words(230) }, { id: 's3', heading: 'Sleep', text: words(230) }] }
      }
      if (path === '/api/faceless/script/section') return { text: words(120) }
      if (path === '/api/youtube/titles') return { titles: [{ title: 'What 10,000 Steps Does To You' }] }
      if (path === '/api/faceless/media') return { jobId: 'm1' }
      if (path.startsWith('/api/faceless/media/')) {
        polls[path] = (polls[path] || 0) + 1
        return polls[path] < 2 ? { status: 'processing', progress: 40 } : { status: 'completed', duration: 180, voiceover_url: 'https://cdn/vo.mp3', words: [{ word: 'a', start: 0, end: 0.3 }] }
      }
      if (path === '/api/youtube/scenes') return { scenes: (body.scenes || []).map((s) => ({ i: s.i, prompt: 'scene ' + s.i })) }
      if (path === '/api/generate/image') return body.kind === 'video' ? { statusUrl: 'v', responseUrl: 'v' } : { statusUrl: 's', responseUrl: 'r' }
      if (path === '/api/generate/image-status') return { done: true, urls: [body.statusUrl === 'v' ? 'https://cdn/clip.mp4' : 'https://cdn/img.png'] }
      if (path === '/api/youtube/compose') return { url: 'https://cdn/still-run.mp4' }
      if (path === '/api/faceless/render') return { jobId: 'r1' }
      if (path.startsWith('/api/faceless/render/')) {
        polls[path] = (polls[path] || 0) + 1
        if (failRender) return { status: 'error', error: 'Renderer crashed' }
        return polls[path] < 2 ? { status: 'processing', progress: 50 } : { status: 'completed', progress: 100 }
      }
      throw Object.assign(new Error('unexpected ' + path), { status: 500 })
    },
    async saveRender(jobId, title) { calls.push('save ' + jobId + ' ' + title); return 'https://cdn/final.mp4' },
  }
  return io
}

const SETTINGS = { topic: 'What happens if you walk 10,000 steps a day', durationId: 'long_180', durationSeconds: 180, aspect: '16:9', voiceId: 'v1', visual: { style: 'cartoon', mode: 'balanced', pace: 'normal' }, caption: { font: 'Inter' } }

test('a run goes from topic to a saved video, one bounded step at a time', async () => {
  const io = fakeIo()
  const run = newRun({ id: 'run1', owner: 'u1', settings: SETTINGS, now: io.now() })
  const seen = new Set()
  for (let i = 0; i < 60 && run.status === 'running'; i++) {
    seen.add(run.stage)
    await advanceRun(run, io)
  }
  assert.equal(run.status, 'done', run.error)
  assert.equal(run.videoUrl, 'https://cdn/final.mp4')
  for (const s of ['script', 'title', 'media', 'scenes_plan', 'scenes_draw', 'compose', 'render', 'save']) assert.ok(seen.has(s), 'visited ' + s)
  assert.equal(run.script.title, 'What 10,000 Steps Does To You')
  assert.ok(run.scenes.length > 0 && run.scenes.every((s) => s.image))
  assert.ok(run.media.timeline.length > 0)
  assert.ok(io.calls.some((c) => c.startsWith('save r1')))
  const pub = publicRun(run)
  assert.equal(pub.videoUrl, 'https://cdn/final.mp4')
  assert.equal(pub.crew.editor.state, 'done')
  assert.ok(pub.log.some((e) => e.agent === 'title' && /Picked/.test(e.text)))
})

test('a failing step stops the run with a message for the chat', async () => {
  const io = fakeIo({ failRender: true })
  const run = newRun({ id: 'run2', settings: { ...SETTINGS, visual: { style: '' } }, now: io.now() })
  for (let i = 0; i < 40 && run.status === 'running'; i++) await advanceRun(run, io)
  assert.equal(run.status, 'error')
  assert.match(run.error, /Renderer crashed/)
  assert.equal(run.crew.editor.state, 'stuck')
})

test('no topic means no run', async () => {
  const io = fakeIo()
  const run = newRun({ id: 'run3', settings: { ...SETTINGS, topic: '' }, now: io.now() })
  await advanceRun(run, io)
  assert.equal(run.status, 'error')
})
