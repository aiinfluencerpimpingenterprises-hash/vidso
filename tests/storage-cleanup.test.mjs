import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ORPHAN_DAYS, cleanupStorage, isMedia, planCleanup } from '../lib/storage-cleanup.js'

const now = Date.parse('2026-12-01T00:00:00Z')
const old = '2026-11-01T00:00:00Z'
const fresh = '2026-11-28T00:00:00Z'

test('only old media that nobody saved is cleaned up', () => {
  const objects = [
    { path: 'u1/voice-part-1.mp3', mime: 'audio/mpeg', createdAt: old },          // leftover → delete
    { path: 'u1/render.mp4', mime: 'video/mp4', createdAt: old },                 // in library → keep
    { path: 'u1/today.mp3', mime: 'audio/mpeg', createdAt: fresh },               // too new → keep
    { path: 'u1/vidso-fs-proj-1.json', mime: 'application/json', createdAt: old }, // project → keep
    { path: 'u1/thumb.jpg', mime: 'image/jpeg', createdAt: old },                 // image → keep
    { path: 'u1/clip.webm', mime: '', createdAt: old },                           // media by extension → delete
    { path: 'u1/nodate.mp4', mime: 'video/mp4', createdAt: '' },                  // unknown age → keep
  ]
  const doomed = planCleanup(objects, new Set(['u1/render.mp4']), { now })
  assert.deepEqual(doomed.map((o) => o.path), ['u1/voice-part-1.mp3', 'u1/clip.webm'])
  assert.equal(ORPHAN_DAYS, 14)
  assert.equal(isMedia('a.MP3', ''), true)
})

test('the cleanup stops if the library cannot be read', async (t) => {
  const real = globalThis.fetch
  const prev = process.env.SUPABASE_SERVICE_ROLE_KEY
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_test'
  const calls = []
  globalThis.fetch = async (url, init) => {
    calls.push(`${init.method} ${new URL(url).pathname}`)
    if (String(url).includes('/rest/v1/user_files')) return new Response('{}', { status: 500 })
    return new Response('[]', { status: 200 })
  }
  t.after(() => { globalThis.fetch = real; if (prev === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = prev })
  await assert.rejects(cleanupStorage({ now }))
  assert.ok(!calls.some((c) => c.startsWith('DELETE')), 'nothing may be deleted')
})

test('a daily cron calls the cleanup route', () => {
  const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'))
  assert.ok(vercel.crons.some((c) => c.path === '/api/youtube/cron/storage'))
})
