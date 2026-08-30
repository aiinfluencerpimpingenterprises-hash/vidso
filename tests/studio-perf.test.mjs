import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  fetchJsonUrls,
  invalidateFileList,
  railwayList,
} from '../lib/railway-files.js'

function withFetch(impl, run) {
  const original = globalThis.fetch
  globalThis.fetch = impl
  return Promise.resolve()
    .then(run)
    .finally(() => { globalThis.fetch = original })
}

function jsonResponse(body) {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    arrayBuffer: async () => Buffer.from(JSON.stringify(body)),
  }
}

test('sidecar reads run in parallel instead of one at a time', async () => {
  let live = 0
  let peak = 0
  const urls = Array.from({ length: 12 }, (_, i) => 'https://files.test/' + i)
  await withFetch(async () => {
    live += 1
    peak = Math.max(peak, live)
    await new Promise((r) => setTimeout(r, 5))
    live -= 1
    return jsonResponse({ id: 'p' })
  }, async () => {
    const out = await fetchJsonUrls(urls, { concurrency: 4 })
    assert.equal(out.length, 12)
    assert.equal(out.every((r) => r?.id === 'p'), true)
  })
  assert.equal(peak > 1, true, 'expected overlapping sidecar reads')
  assert.equal(peak <= 4, true, 'expected concurrency to stay bounded')
})

test('a failed sidecar does not drop the rest of the batch', async () => {
  await withFetch(async (url) => {
    if (String(url).endsWith('/1')) return { ok: false, status: 500, json: async () => ({}) }
    return jsonResponse({ id: String(url).split('/').pop() })
  }, async () => {
    const out = await fetchJsonUrls(['https://files.test/0', 'https://files.test/1', 'https://files.test/2'])
    assert.equal(out[0].id, '0')
    assert.equal(out[1], null)
    assert.equal(out[2].id, '2')
  })
})

test('the file list is reused across calls and dropped on invalidate', async () => {
  const token = 'tok-' + Date.now()
  let calls = 0
  await withFetch(async () => {
    calls += 1
    return jsonResponse({ files: [{ id: 'f1', url: 'https://files.test/f1', original_name: 'vidso-fs-proj-a.txt' }] })
  }, async () => {
    invalidateFileList(token)
    const first = await railwayList(token)
    await railwayList(token)
    await railwayList(token)
    assert.equal(calls, 1, 'repeat listings should reuse the cached response')
    assert.equal(first.length, 1)

    invalidateFileList(token)
    await railwayList(token)
    assert.equal(calls, 2, 'invalidate should force a fresh listing')

    await railwayList(token, { fresh: true })
    assert.equal(calls, 3, 'fresh should bypass the cache')
  })
})

test('cached listings do not leak between tokens', async () => {
  let calls = 0
  await withFetch(async () => {
    calls += 1
    return jsonResponse({ files: [] })
  }, async () => {
    await railwayList('token-a-' + Date.now())
    await railwayList('token-b-' + Date.now())
    assert.equal(calls, 2)
  })
})
