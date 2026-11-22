/**
 * Server-side video runs (lib/video-run.js), so a video keeps being made after
 * the tab is closed. Served by the /api/youtube function (Vercel's function cap)
 * under /api/youtube/runs/…:
 *
 *   POST /api/youtube/runs/start           start a run  { settings, refresh_token }   (Bearer)
 *   GET  /api/youtube/runs/latest          the signed-in user's newest run            (Bearer)
 *   GET  /api/youtube/runs/:id             one run's progress                         (Bearer, owner)
 *   POST /api/youtube/runs/:id/cancel      stop it                                    (Bearer, owner)
 *   POST /api/youtube/runs/:id/tick?k=…    do the next step (the run's own key; no user token)
 *
 * Each tick does one bounded step under a lock, saves the record, then calls
 * the next tick itself. Anyone watching (GET) also nudges a run that has gone
 * quiet, so a dropped hand-off only costs a minute.
 */
import { randomBytes } from 'node:crypto'
import { readJson, requireUser, send } from '../api/_lib/http.js'
import { kvConfigured, kvGetJson, kvSetJsonTtl, kvLock, kvDel } from './kv.js'
import { encryptRecord, decryptRecord } from './youtube.js'
import { gateHref } from './studio-gate.js'
import { sessionFromAuthPayload } from './session-store.js'
import { generationFileName } from './files-gallery.js'
import { newRun, advanceRun, publicRun } from './video-run.js'

const UPSTREAM = process.env.UPSTREAM_API || 'https://vibrant-patience-production-a7f0.up.railway.app'
const TTL = 7 * 24 * 3600
const STEP_BUDGET_MS = 200000 // leaves room under maxDuration for saving and the hand-off
const STALE_MS = 75000 // a running record not touched for this long gets nudged by viewers

const runKey = (id) => 'vrun:' + id
const ownerKey = (owner) => 'vrun-latest:' + owner
const lockKey = (id) => 'vrun-lock:' + id
const ownerOf = (user) => String(user?.id || user?.user_id || user?.email || '').trim()

function originOf(req) {
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim()
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim()
  return host ? `${proto}://${host}` : ''
}

async function load(id) {
  return id ? kvGetJson(runKey(id)) : null
}
async function save(run) {
  return kvSetJsonTtl(runKey(run.id), run, TTL)
}

/** Start the next step without waiting for it to finish. */
async function kick(run) {
  if (!run?.origin || run.status !== 'running') return
  try {
    await fetch(`${run.origin}/api/youtube/runs/${encodeURIComponent(run.id)}/tick?k=${encodeURIComponent(run.tickKey)}`, {
      method: 'POST',
      signal: AbortSignal.timeout(1500),
    })
  } catch (_) {} // the abort is expected: the tick keeps running on its own
}

/** Network for the engine, as the user who started the run (tokens refreshed as needed). */
function makeIo(run) {
  let creds = null
  const getCreds = () => {
    if (!creds) creds = decryptRecord(run.auth)
    return creds
  }
  const refresh = async () => {
    const c = getCreds()
    if (!c.refresh_token) return false
    const res = await fetch(UPSTREAM + '/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: c.refresh_token }),
      signal: AbortSignal.timeout(15000),
    })
    const data = await res.json().catch(() => ({}))
    const session = res.ok ? sessionFromAuthPayload(data) : null
    if (!session) return false
    creds = { access_token: session.access_token, refresh_token: session.refresh_token || c.refresh_token }
    run.auth = encryptRecord(creds)
    return true
  }
  const urlFor = (base, path) => {
    if (base === 'upstream') return UPSTREAM + path
    if (base === 'gate') return run.origin + gateHref(path)
    return run.origin + path
  }
  async function call(base, method, path, body, { timeoutMs = 60000 } = {}, retried = false) {
    const res = await fetch(urlFor(base, path), {
      method,
      headers: { Authorization: 'Bearer ' + getCreds().access_token, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (res.status === 401 && !retried && await refresh()) return call(base, method, path, body, { timeoutMs }, true)
    const text = await res.text()
    let data = null
    try { data = text ? JSON.parse(text) : {} } catch (_) { data = null }
    if (!res.ok) {
      const err = new Error((data && (data.message || data.error)) || `Request failed (${res.status})`)
      err.status = res.status
      err.body = data
      err.raw = text
      throw err
    }
    return data ?? text
  }
  async function saveRender(jobId, title) {
    const dl = await fetch(`${UPSTREAM}/api/faceless/render/${encodeURIComponent(jobId)}/download`, {
      headers: { Authorization: 'Bearer ' + getCreds().access_token },
      signal: AbortSignal.timeout(120000),
    })
    if (!dl.ok) throw new Error('Could not fetch the finished video.')
    const blob = await dl.blob()
    const fd = new FormData()
    fd.append('file', new Blob([await blob.arrayBuffer()], { type: blob.type || 'video/mp4' }), generationFileName('longform', title))
    const up = await fetch(UPSTREAM + '/api/upload', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + getCreds().access_token },
      body: fd,
      signal: AbortSignal.timeout(120000),
    })
    const rec = await up.json().catch(() => ({}))
    if (!up.ok) throw new Error(rec.message || rec.error || 'Could not save the video to My Files.')
    return rec?.url || rec?.file?.url || rec?.storage_url || rec?.file_url || ''
  }
  return {
    call,
    saveRender,
    now: () => Date.now(),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    budgetMs: STEP_BUDGET_MS,
  }
}

async function tick(id, key) {
  const run = await load(id)
  if (!run || !key || key !== run.tickKey) return { status: 404, body: { error: 'No such run' } }
  if (run.status !== 'running') return { status: 200, body: { stage: run.stage, status: run.status } }
  if (!(await kvLock(lockKey(id), Math.ceil(STEP_BUDGET_MS / 1000) + 60))) return { status: 202, body: { busy: true } }
  try {
    await advanceRun(run, makeIo(run))
    await save(run)
  } finally {
    await kvDel(lockKey(id))
  }
  await kick(run)
  return { status: 200, body: { stage: run.stage, status: run.status } }
}

async function owned(req, id) {
  const { user } = await requireUser(req)
  const run = await load(id)
  if (!run || run.owner !== ownerOf(user)) {
    const err = new Error('No such run')
    err.status = 404
    throw err
  }
  return run
}

/** `parts` is the path after /api/youtube/runs, e.g. ['abc', 'tick']. */
export async function handleRuns(req, res, parts) {
  if (!kvConfigured()) return send(res, 501, { error: 'Background runs are not set up on this deployment.', code: 'runs_off' })
  const query = new URLSearchParams(String(req.url || '').split('?')[1] || '')
  try {
    // POST /api/youtube/runs/:id/tick — the engine's own hand-off.
    if (req.method === 'POST' && parts.length === 2 && parts[1] === 'tick') {
      const out = await tick(parts[0], query.get('k'))
      return send(res, out.status, out.body)
    }

    // POST /api/youtube/runs/start — start a run as the signed-in user.
    if (req.method === 'POST' && parts.length === 1 && parts[0] === 'start') {
      const { user, token } = await requireUser(req)
      const body = await readJson(req)
      const owner = ownerOf(user)
      if (!owner) return send(res, 400, { error: 'Your account has no id.' })
      const latest = await kvGetJson(ownerKey(owner))
      const prev = latest?.id ? await load(latest.id) : null
      if (prev && prev.status === 'running' && prev.settings?.channel === String(body?.settings?.channel || '')) {
        return send(res, 409, { error: 'The team is still making the last video for this channel.', run: publicRun(prev) })
      }
      const run = newRun({ id: randomBytes(9).toString('base64url'), owner, settings: body.settings || {} })
      run.origin = originOf(req)
      run.tickKey = randomBytes(18).toString('base64url')
      run.auth = encryptRecord({ access_token: token, refresh_token: String(body.refresh_token || '') })
      if (!(await save(run))) return send(res, 503, { error: 'Could not save the run. Try again.' })
      await kvSetJsonTtl(ownerKey(owner), { id: run.id, channel: run.settings.channel, at: Date.now() }, TTL)
      await kick(run)
      return send(res, 201, { run: publicRun(run) })
    }

    // GET /api/youtube/runs/latest
    if (req.method === 'GET' && parts.length === 1 && parts[0] === 'latest') {
      const { user } = await requireUser(req)
      const latest = await kvGetJson(ownerKey(ownerOf(user)))
      const run = latest?.id ? await load(latest.id) : null
      if (run && run.status === 'running' && Date.now() - (run.updated || 0) > STALE_MS) await kick(run)
      return send(res, 200, { run: run ? publicRun(run) : null })
    }

    // GET /api/youtube/runs/:id
    if (req.method === 'GET' && parts.length === 1) {
      const run = await owned(req, parts[0])
      if (run.status === 'running' && Date.now() - (run.updated || 0) > STALE_MS) await kick(run)
      return send(res, 200, { run: publicRun(run) })
    }

    // POST /api/youtube/runs/:id/cancel
    if (req.method === 'POST' && parts.length === 2 && parts[1] === 'cancel') {
      const run = await owned(req, parts[0])
      if (run.status === 'running') {
        run.status = 'cancelled'
        run.stage = 'cancelled'
        run.updated = Date.now()
        await save(run)
      }
      return send(res, 200, { run: publicRun(run) })
    }

    return send(res, 404, { error: 'Not found' })
  } catch (e) {
    return send(res, e.status || 500, e.body || { error: e.message || 'Something went wrong' })
  }
}

export const _test = { originOf, makeIo, tick }
