import test from 'node:test'
import assert from 'node:assert/strict'

process.env.VIDSO_USAGE_FILE = '/nonexistent-dir/vidso-usage-hardening.json'
process.env.FAL_KEY = process.env.FAL_KEY || 'test-fal-key'

const store = await import('../lib/usage-store.js')
const { safeFetch, safeFetchAllowed } = await import('../lib/safe-fetch.js')
const { falJobHandle, _resetFalRefundsForTests } = await import('../api/_lib/fal-job.js')
const { default: imageStatus } = await import('../api/generate/image-status.js')
const { default: imageStart } = await import('../api/generate/image.js')
const { clampComposeSegments } = await import('../lib/scene-agent.js')
const { appReturn, boundedManagerContext, safeReturnPath } = await import('../api/youtube/[...path].js')
const { issueYoutubeConnectTicket, readYoutubeConnectTicket, buildYoutubeConnect } = await import('../lib/youtube.js')
const { adminKeyMatches, kvKind } = await import('../api/billing/diagnose.js')
const { newRun, advanceRun, withRetry, STAGE_DEADLINES_MS } = await import('../lib/video-run.js')

const PAID = { id: 'hard-1', plan: 'pro', plan_status: 'active', created_at: '2026-01-15T00:00:00Z' }

function fakeRes() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(k, v) { this.headers[k.toLowerCase()] = v },
    getHeader(k) { return this.headers[k.toLowerCase()] },
    end(b) { this.body = b || '' },
  }
}

// ---------------------------------------------------------------- SSRF

test('safe fetch only allows https on our storage and provider hosts', () => {
  for (const ok of [
    'https://vibrant-patience-production-a7f0.up.railway.app/files/a.mp3',
    'https://abc.supabase.co/storage/v1/object/public/x.mp3',
    'https://pub-1.r2.dev/a.mp3',
    'https://v3.fal.media/files/x.png',
    'https://fal.media/files/x.png',
    'https://bucket.s3.amazonaws.com/a.mp3',
  ]) assert.equal(safeFetchAllowed(ok), true, ok)
  for (const bad of [
    'http://abc.supabase.co/x.mp3',
    'https://169.254.169.254/latest/meta-data',
    'https://127.0.0.1/x',
    'https://[::1]/x',
    'https://localhost/x',
    'https://evil.test/x',
    'https://supabase.co.evil.test/x',
    'https://evilsupabase.co/x',
    'https://x.railway.app/x',
    'https://abc.supabase.co:8443/x',
    'file:///etc/passwd',
  ]) assert.equal(safeFetchAllowed(bad), false, bad)
})

test('safe fetch re-checks redirects and stops reading past the cap', async () => {
  const redirecting = async () => new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/' } })
  await assert.rejects(() => safeFetch('https://v3.fal.media/a', { fetchImpl: redirecting }), (e) => e.code === 'host_not_allowed')
  let pulled = 0
  const big = async () => new Response(new ReadableStream({
    pull(ctrl) {
      pulled++
      if (pulled > 100) return ctrl.close()
      ctrl.enqueue(new Uint8Array(1024))
    },
  }), { status: 200 })
  await assert.rejects(() => safeFetch('https://v3.fal.media/a', { fetchImpl: big, maxBytes: 4096 }), (e) => e.code === 'too_large')
  assert.ok(pulled < 20, 'stopped reading early')
  const declared = async () => new Response('x', { status: 200, headers: { 'content-length': String(50 * 1024 * 1024) } })
  await assert.rejects(() => safeFetch('https://v3.fal.media/a', { fetchImpl: declared, maxBytes: 1024 }), (e) => e.code === 'too_large')
  const fine = async (url, init) => {
    assert.equal(init.redirect, 'manual')
    assert.ok(init.signal)
    return new Response('hello', { status: 200, headers: { 'content-type': 'audio/mpeg' } })
  }
  const got = await safeFetch('https://v3.fal.media/a', { fetchImpl: fine })
  assert.equal(got.buffer.toString(), 'hello')
})

test('voiceover concat refuses hosts outside the allow-list without fetching', async (t) => {
  const { default: gate } = await import('../api/gate/[...path].js')
  const real = globalThis.fetch
  const seen = []
  globalThis.fetch = async (url) => {
    seen.push(String(url))
    return new Response(JSON.stringify({ id: 'hard-concat', plan: 'pro', plan_status: 'active' }), { status: 200 })
  }
  t.after(() => { globalThis.fetch = real })
  const res = fakeRes()
  await gate({
    method: 'POST',
    url: '/api/gate/media?p=concat',
    headers: { authorization: 'Bearer concat-tok', 'x-vidso-path': 'media/concat' },
    query: { path: ['media'], p: 'concat' },
    body: { urls: ['https://v3.fal.media/a.mp3', 'http://169.254.169.254/latest/meta-data'] },
  }, res)
  assert.equal(res.statusCode, 400)
  assert.ok(!seen.some((u) => u.includes('169.254')))
})

// ---------------------------------------------------------------- fal refunds

function statusReq(token, body) {
  return { method: 'POST', headers: { authorization: 'Bearer ' + token }, body }
}

test('a failed fal job gives its credits back once, to its owner, with a 422', async (t) => {
  store._resetStoreForTests()
  _resetFalRefundsForTests()
  const real = globalThis.fetch
  globalThis.fetch = async (url) => {
    const u = String(url)
    if (u.endsWith('/api/user/me')) return new Response(JSON.stringify(PAID), { status: 200 })
    if (u.includes('/status')) return new Response(JSON.stringify({ status: 'FAILED', error: 'NSFW content' }), { status: 200 })
    return new Response('{}', { status: 200 })
  }
  t.after(() => { globalThis.fetch = real })
  await store.reserveStudioCredits(PAID, 40, 750)
  const statusUrl = 'https://queue.fal.run/fal-ai/flux/requests/req-123/status'
  const responseUrl = 'https://queue.fal.run/fal-ai/flux/requests/req-123'
  const handle = falJobHandle({ user: PAID, requestId: 'req-123', charge: 40 })
  assert.ok(handle && !handle.includes('req-123'), 'handle is opaque')

  const res = fakeRes()
  await imageStatus(statusReq('refund-tok', { statusUrl, responseUrl, handle }), res)
  const out = JSON.parse(res.body)
  assert.equal(res.statusCode, 422)
  assert.equal(out.code, 'generation_failed')
  assert.equal(out.refunded, 40)
  assert.equal(store.readUsage(PAID).studio_credits_used, 0)

  const again = fakeRes()
  await imageStatus(statusReq('refund-tok', { statusUrl, responseUrl, handle }), again)
  assert.equal(again.statusCode, 422)
  assert.equal(JSON.parse(again.body).refunded, 0)

  // An old client without a handle gets the 422 and no refund.
  const old = fakeRes()
  await imageStatus(statusReq('refund-tok', { statusUrl, responseUrl }), old)
  assert.equal(old.statusCode, 422)
  assert.equal(JSON.parse(old.body).refunded, 0)
})

test("someone else's handle refunds nothing", async (t) => {
  store._resetStoreForTests()
  _resetFalRefundsForTests()
  const real = globalThis.fetch
  globalThis.fetch = async (url) => {
    const u = String(url)
    if (u.endsWith('/api/user/me')) return new Response(JSON.stringify({ id: 'stranger' }), { status: 200 })
    return new Response(JSON.stringify({ status: 'FAILED' }), { status: 200 })
  }
  t.after(() => { globalThis.fetch = real })
  const handle = falJobHandle({ user: PAID, requestId: 'req-999', charge: 40 })
  const res = fakeRes()
  await imageStatus(statusReq('stranger-tok', {
    statusUrl: 'https://queue.fal.run/fal-ai/flux/requests/req-999/status',
    responseUrl: 'https://queue.fal.run/fal-ai/flux/requests/req-999',
    handle,
  }), res)
  assert.equal(res.statusCode, 422)
  assert.equal(JSON.parse(res.body).refunded, 0)
})

test('a free scene draw is always one image, and the start answer carries a handle', async (t) => {
  store._resetStoreForTests()
  const u = { id: 'hard-scene', plan: 'pro', plan_status: 'active', created_at: '2026-01-15T00:00:00Z' }
  await store.addSceneAllowance(u, 1)
  const real = globalThis.fetch
  let falBody = null
  globalThis.fetch = async (url, init = {}) => {
    const s = String(url)
    if (s.endsWith('/api/user/me')) return new Response(JSON.stringify(u), { status: 200 })
    if (s.startsWith('https://queue.fal.run/')) {
      falBody = JSON.parse(init.body)
      return new Response(JSON.stringify({ request_id: 'rq1', status_url: 'https://queue.fal.run/x/requests/rq1/status', response_url: 'https://queue.fal.run/x/requests/rq1' }), { status: 200 })
    }
    return new Response('{}', { status: 200 })
  }
  t.after(() => { globalThis.fetch = real })
  const res = fakeRes()
  await imageStart({ method: 'POST', headers: { authorization: 'Bearer scene-tok' }, body: { prompt: 'a cat', model: 'z-image-turbo', scene: true, num_images: 4, resolution: '1K' } }, res)
  const out = JSON.parse(res.body)
  assert.equal(res.statusCode, 200, res.body)
  assert.equal(out.creditsCharged, 0)
  assert.equal(falBody.num_images, 1)
  assert.ok(out.handle)
})

// ---------------------------------------------------------------- YouTube

test('the YouTube connect ticket and bridge are sealed, not readable', () => {
  const env = { GOOGLE_YOUTUBE_CLIENT_ID: 'cid.apps.googleusercontent.com', GOOGLE_YOUTUBE_CLIENT_SECRET: 'sec', YOUTUBE_TOKEN_SECRET: 'unit-yt' }
  const ticket = issueYoutubeConnectTicket({ token: 'bearer-secret-token', env })
  for (const part of ticket.split('.')) assert.equal(Buffer.from(part, 'base64url').toString('utf8').includes('bearer-secret'), false)
  assert.equal(readYoutubeConnectTicket(ticket, env).token, 'bearer-secret-token')
  const started = buildYoutubeConnect({ token: 'bearer-secret-token', req: { headers: { host: 'www.tubeops.pro' } }, env })
  const state = new URL(started.url).searchParams.get('state')
  for (const value of [started.bridge, state]) {
    for (const part of value.split('.')) assert.equal(Buffer.from(part, 'base64url').toString('utf8').includes('bearer-secret'), false)
  }
})

test('the app return path stays on this site', () => {
  const req = { headers: { host: 'www.tubeops.pro', 'x-forwarded-proto': 'https' } }
  for (const bad of ['//evil.com', '/\\evil.com', 'https://evil.com', '/\t/evil.com', '\\\\evil.com']) {
    assert.equal(safeReturnPath(bad), '', bad)
    assert.equal(new URL(appReturn(req, bad)).origin, 'https://www.tubeops.pro', bad)
  }
  assert.equal(appReturn(req, '/video-generation?x=1', { youtube: 'connected' }), 'https://www.tubeops.pro/video-generation?x=1&youtube=connected')
})

test('compose segments are clamped to 0.2–20s each and 40 minutes in total', () => {
  const out = clampComposeSegments([
    { url: 'https://a', ms: 10 },
    { url: 'https://b', ms: 999999 },
    { url: 'https://c', ms: 5000 },
  ])
  assert.deepEqual(out.map((s) => s.ms), [200, 20000, 5000])
  const many = clampComposeSegments(Array.from({ length: 200 }, (_, i) => ({ url: 'https://x/' + i, ms: 20000 })))
  assert.equal(many.reduce((n, s) => n + s.ms, 0) <= 40 * 60 * 1000, true)
  assert.equal(many.length, 120)
})

test('the manager context is capped at 8000 characters of JSON', () => {
  assert.deepEqual(boundedManagerContext({ a: 1 }), { a: 1 })
  const big = { channel: 'Lab', notes: 'x'.repeat(20000), nested: { deep: 'y'.repeat(9000) } }
  const out = boundedManagerContext(big)
  assert.ok(JSON.stringify(out).length <= 8000)
  assert.equal(out.channel, 'Lab')
  assert.equal(out.nested, undefined)
  assert.deepEqual(boundedManagerContext('nope'), {})
})

// ---------------------------------------------------------------- diagnose

test('the diagnose admin key compares in constant time and kvKind names no secret', () => {
  assert.equal(adminKeyMatches('abc', 'abc'), true)
  assert.equal(adminKeyMatches('abd', 'abc'), false)
  assert.equal(adminKeyMatches('', 'abc'), false)
  assert.equal(adminKeyMatches('abcd', 'abc'), false)
  assert.equal(kvKind({}), 'none')
  assert.equal(kvKind({ UPSTASH_REDIS_REST_URL: 'https://u', UPSTASH_REDIS_REST_TOKEN: 't' }), 'upstash')
  assert.equal(kvKind({ SUPABASE_SERVICE_ROLE_KEY: 'k' }), 'supabase')
})

test('diagnose ignores an admin key in the query string', async (t) => {
  const { default: diagnose } = await import('../api/billing/diagnose.js')
  const prev = process.env.VIDSO_ADMIN_KEY
  process.env.VIDSO_ADMIN_KEY = 'the-admin-key'
  t.after(() => { if (prev === undefined) delete process.env.VIDSO_ADMIN_KEY; else process.env.VIDSO_ADMIN_KEY = prev })
  const res = fakeRes()
  await diagnose({ method: 'GET', headers: {}, query: { admin_key: 'the-admin-key' } }, res)
  assert.equal(res.statusCode, 401)
  const ok = fakeRes()
  await diagnose({ method: 'GET', headers: { 'x-admin-key': 'the-admin-key' }, query: { email: '' } }, ok)
  const body = JSON.parse(ok.body)
  assert.ok(['upstash', 'supabase', 'none'].includes(body.kvKind))
  assert.equal(ok.body.includes('the-admin-key'), false)
})

// ---------------------------------------------------------------- video runs

function composeRun(now) {
  const run = newRun({ id: 'c1', settings: { topic: 't', visual: { style: 'cartoon' } }, now })
  run.stage = 'compose'
  run.scenes = [
    { i: 0, start: 0, end: 4, image: 'https://cdn/a.png', clip: '' },
    { i: 1, start: 4, end: 8, image: 'https://cdn/b.png', clip: '' },
    { i: 2, start: 8, end: 12, image: '', clip: 'https://cdn/c.mp4' },
  ]
  run.media = { duration: 12 }
  return run
}

test('compose stores the queued fal job and polls it across steps until it has a url', async () => {
  let t = 1_000_000
  let polls = 0
  const calls = []
  const io = {
    now: () => t,
    sleep: async (ms) => { t += ms },
    budgetMs: 10000,
    async call(base, method, path, body) {
      calls.push(body)
      if (body.segments) return { id: 'job-abc-123', ms: 8000 }
      polls++
      return polls < 4 ? { pending: true, status: 'IN_PROGRESS' } : { url: 'https://cdn/joined.mp4', ms: 8000 }
    },
  }
  const run = composeRun(t)
  await advanceRun(run, io)
  assert.equal(run.stage, 'compose', 'still waiting on fal')
  assert.equal(run.composePlan[0].job.id, 'job-abc-123')
  for (let i = 0; i < 5 && run.stage === 'compose'; i++) await advanceRun(run, io)
  assert.equal(run.stage, 'render', run.error)
  assert.equal(calls.filter((b) => b.segments).length, 1, 'submitted once')
  assert.ok(calls.some((b) => b.id === 'job-abc-123' && b.ms === 8000))
  assert.deepEqual(run.timeline.map((x) => x.url), ['https://cdn/joined.mp4', 'https://cdn/c.mp4'])
})

test('a stage past its deadline fails the run with a clear message', async () => {
  let t = 1_000_000
  const io = {
    now: () => t,
    sleep: async (ms) => { t += ms },
    budgetMs: 1000,
    async call(base, method, path, body) { return body.segments ? { id: 'job-slow-123', ms: 8000 } : { pending: true } },
  }
  const run = composeRun(t)
  await advanceRun(run, io)
  t += STAGE_DEADLINES_MS.compose + 1000
  await advanceRun(run, io)
  assert.equal(run.status, 'error')
  assert.match(run.error, /Joining the scenes took too long/)
  assert.equal(STAGE_DEADLINES_MS.media, 45 * 60 * 1000)
  assert.equal(STAGE_DEADLINES_MS.render, 60 * 60 * 1000)
})

test('upstream calls retry twice on network errors and 502/503, not on 4xx or a POST 504', async () => {
  let n = 0
  const slept = []
  const flaky = (fails, status) => ({
    sleep: async (ms) => { slept.push(ms) },
    async call(base, method) {
      n++
      if (n <= fails) throw Object.assign(new Error('busy'), status ? { status } : {})
      return { ok: true, method }
    },
  })
  n = 0
  assert.deepEqual(await withRetry(flaky(2, 503)).call('gate', 'GET', '/x'), { ok: true, method: 'GET' })
  assert.deepEqual(slept, [1000, 2000])
  n = 0
  assert.ok(await withRetry(flaky(1)).call('gate', 'POST', '/x'))
  n = 0
  await assert.rejects(() => withRetry(flaky(3, 502)).call('gate', 'GET', '/x'))
  assert.equal(n, 3)
  n = 0
  await assert.rejects(() => withRetry(flaky(1, 404)).call('gate', 'GET', '/x'))
  assert.equal(n, 1)
  n = 0
  await assert.rejects(() => withRetry(flaky(1, 504)).call('gate', 'POST', '/x'))
  assert.equal(n, 1)
  n = 0
  assert.ok(await withRetry(flaky(1, 504)).call('gate', 'POST', '/x', {}, { idempotent: true }))
})
