import test from 'node:test'
import assert from 'node:assert/strict'

process.env.VIDSO_USAGE_FILE = '/nonexistent-dir/vidso-usage-gate-security.json'
process.env.VIDSO_GRANTS_FILE = '/nonexistent-dir/vidso-grants-gate-security.json'

const { gateFullSubpath, isSafeGatePath, studioRouteFromReq } = await import('../lib/studio-gate.js')
const { narrationSeconds, narrationWords, railwayFetch, refundFailedMedia, rememberMediaCharge, ruleFor, runGatedApi } = await import('../lib/gate-run.js')
const store = await import('../lib/usage-store.js')

const PAID = { id: 'gate-paid', plan: 'pro', plan_status: 'active', created_at: '2026-01-15T00:00:00Z' }
const FREE = { id: 'gate-free', plan: 'free', plan_status: 'inactive' }

function stubFetch(t, respond = () => ({ ok: true })) {
  const real = globalThis.fetch
  const seen = []
  globalThis.fetch = async (url, init = {}) => {
    seen.push({ url: String(url), method: init.method || 'GET', body: init.body })
    return new Response(JSON.stringify(respond(String(url), init)), { status: 200 })
  }
  t.after(() => { globalThis.fetch = real })
  return seen
}

test('gate paths with dot segments, encoded separators or odd characters are refused', () => {
  const bad = [
    { url: '/api/gate/faceless?p=x/../media' },
    { url: '/api/gate/faceless?p=x%2F..%2Fmedia' },
    { url: '/api/gate/faceless?p=media%23' },
    { url: '/api/gate/faceless?p=media%3Fx=1' },
    { url: '/api/gate/faceless?p=./media' },
    { url: '/api/gate/faceless?p=media//refund' },
    { url: '/api/gate/faceless', headers: { 'x-vidso-path': 'faceless/x/../media' } },
    { url: '/api/gate/faceless', headers: { 'x-vidso-path': 'faceless/./media' } },
    { url: '/rapi/api/x', query: { paid: 'faceless/../media' } },
    { url: '/api/gate/..%2Ffaceless?p=media' },
    { url: '/api/gate/x', query: { path: ['..'], p: 'media' } },
  ]
  for (const req of bad) {
    assert.throws(() => gateFullSubpath({ headers: {}, ...req }), (e) => e.status === 400 && e.code === 'invalid_path', JSON.stringify(req))
    assert.throws(() => studioRouteFromReq({ headers: {}, ...req }), (e) => e.status === 400, JSON.stringify(req))
  }
  assert.equal(isSafeGatePath('faceless/media/job_123-abc'), true)
  assert.equal(isSafeGatePath('faceless/media.json'), false)
  // Normal paths still route.
  assert.equal(gateFullSubpath({ url: '/api/gate/faceless?p=media', headers: {} }), 'faceless/media')
  assert.equal(gateFullSubpath({ url: '/api/gate/faceless', headers: { 'x-vidso-path': 'faceless/media/refund' } }), 'faceless/media/refund')
})

test('rules ignore case, so Faceless/Media is still the paid media route', () => {
  assert.equal(ruleFor('POST', 'Faceless/Media').type, 'media')
  assert.equal(ruleFor('POST', 'FACELESS/RENDER').type, 'generate')
  assert.equal(ruleFor('POST', 'faceless/Script').type, 'length')
})

test('railwayFetch refuses any path that is not plain segments, before calling out', async (t) => {
  const seen = stubFetch(t)
  for (const p of ['faceless/x/../media', 'faceless/./media', 'faceless/media#x', 'faceless/media?x=1', 'faceless//media', 'a/%2e%2e/b']) {
    await assert.rejects(() => railwayFetch('tok', 'POST', p, {}), (e) => e.status === 400, p)
  }
  assert.equal(seen.length, 0)
  await railwayFetch('tok', 'GET', 'faceless/media/job_1')
  assert.equal(seen.length, 1)
})

test('paid Railway routes that were forwarded free now need an active plan', async (t) => {
  const seen = stubFetch(t, () => ({ jobId: 'j1' }))
  for (const path of ['tts/generate', 'transcribe', 'ranking', 'commentary', 'commentary/script', 'reframe', 'faceless/script/section', 'faceless/broll/search', 'download/info', 'TTS/Generate']) {
    assert.equal(ruleFor('POST', path).type, 'plan', path)
    const out = await runGatedApi({ token: 'tok', user: FREE, method: 'POST', subpath: path, body: { text: 'hi' } })
    assert.equal(out.status, 402, path)
  }
  assert.equal(seen.length, 0, 'nothing reached Railway for a free account')
  // Reads still work for a signed-in user without a plan.
  const voices = await runGatedApi({ token: 'tok', user: FREE, method: 'GET', subpath: 'tts/voices' })
  assert.equal(voices.status, 200)
  // A paying user goes through.
  const paid = await runGatedApi({ token: 'tok', user: PAID, method: 'POST', subpath: 'tts/generate', body: { text: 'hi' } })
  assert.equal(paid.status, 200)
  assert.equal(seen.length, 2)
})

test('narration billing counts Chinese, Japanese and Thai, which have no spaces', () => {
  assert.equal(narrationWords('hello there world'), 3)
  assert.equal(narrationWords('你好世界'), 2) // 4 ideographs
  assert.equal(narrationWords('こんにちは'), 2.5) // 5 kana
  assert.equal(narrationWords('สวัสดีครับ'), 2.5) // 10 Thai characters
  assert.equal(narrationWords('Hello 世界 again'), 3)
  const chinese = '这是一个很长的中文旁白。'.repeat(200)
  assert.ok(narrationSeconds({ script: { full_script: chinese } }) > 400)
})

test('a short full_script cannot stand in for long sections', () => {
  const long = Array.from({ length: 1500 }, (_, i) => 'word' + i).join(' ')
  const seconds = narrationSeconds({ full_script: 'hi', sections: [{ text: long }] })
  assert.equal(seconds, 1500 / 2.5)
  const nested = narrationSeconds({ script: { full_script: 'hi', sections: [{ text: long }] } })
  assert.equal(nested, 1500 / 2.5)
  // Same text in both is not counted twice.
  assert.equal(narrationSeconds({ script: { full_script: long, sections: [{ text: long }] } }), 1500 / 2.5)
})

test('a failed voice job gives back its free scenes as well as its credits', async (t) => {
  store._resetStoreForTests()
  stubFetch(t, () => ({ status: 'error' }))
  const u = { id: 'scene-farm', plan: 'pro', plan_status: 'active', created_at: '2026-01-15T00:00:00Z' }
  await store.reserveStudioCredits(u, 10, 750)
  await store.addSceneAllowance(u, 12)
  await rememberMediaCharge(u, { jobId: 'job_farm' }, 10, 12)
  const out = await refundFailedMedia({ token: 't', user: u, jobId: 'job_farm' })
  assert.equal(out.body.refunded, 10)
  assert.equal(out.body.scenes_removed, 12)
  assert.equal(store.readUsage(u).scene_free, 0)
})

test('the media route adds free scenes for a charged job; the +2 spare only on the first part', async (t) => {
  const { sceneAllowance, sceneCount } = await import('../lib/studio-credits.js')
  store._resetStoreForTests()
  stubFetch(t, () => ({ jobId: 'job_media' }))
  const u = { id: 'scene-paid', plan: 'pro', plan_status: 'active', created_at: '2026-01-15T00:00:00Z' }
  const text = Array.from({ length: 150 }, (_, i) => 'w' + i).join(' ') // 60 seconds
  const first = await runGatedApi({ token: 't', user: u, method: 'POST', subpath: 'faceless/media', body: { script: { full_script: text }, duration_seconds: 60, credits_needed: 1 } })
  assert.equal(first.status, 200)
  assert.ok(store.readUsage(u).studio_credits_used > 0)
  assert.equal(store.readUsage(u).scene_free, sceneAllowance(60))
  await runGatedApi({ token: 't', user: u, method: 'POST', subpath: 'faceless/media', body: { script: { full_script: text }, duration_seconds: 60 } })
  assert.equal(store.readUsage(u).scene_free, sceneAllowance(60) + sceneCount(60))
})
