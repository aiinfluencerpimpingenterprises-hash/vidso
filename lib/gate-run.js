/** Shared Railway gate used by /api/gate and Claude MCP tools. */

import { evaluateFeature, evaluateGeneration, evaluateLength, evaluateStudioCredits, toHttp } from './enforce.js'
import { enrichScriptBody, scriptUpstreamBody } from './faceless-length.js'
import { durationFromBody, generationKindFromSeconds } from './quota.js'
import { sceneAllowance, sceneCount, studioCreditView, videoCredits } from './studio-credits.js'
import { addSceneAllowance, hydrateUsage, incrementUsage, releaseStudioCredits, reserveStudioCredits, settleUsageWrites } from './usage-store.js'
import { kvConfigured, kvReadJson, kvSetJsonTtl, kvLock } from './kv.js'
import { isJsonSyntaxError, recoverScriptData } from './json-repair.js'
import { withCompedPlan, planIsActive } from './comped.js'
import { applyPaidGrant } from './paid-grant.js'
import { membershipRevoked, saveGrant, withStoredGrant } from './grants.js'
import { lookupPaidMembership } from './whop-lookup.js'

export const UPSTREAM = process.env.UPSTREAM_API || 'https://vibrant-patience-production-a7f0.up.railway.app'

function emailFromJwt(token) {
  try {
    const part = String(token || '').split('.')[1]
    if (!part) return ''
    const json = JSON.parse(Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'))
    return String(json.email || json.user_email || '').trim()
  } catch {
    return ''
  }
}

export async function resolveVidsoUser(token) {
  const res = await fetch(UPSTREAM + '/api/user/me', {
    headers: { Authorization: 'Bearer ' + token },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.message || data.error || 'Unauthorized')
    err.status = res.status
    err.body = data
    throw err
  }
  let user = await withStoredGrant(withCompedPlan({ ...data, email: data.email || emailFromJwt(token) }))
  if (planIsActive(user)) return user
  try {
    const hit = await lookupPaidMembership(user)
    if (hit?.active && hit.tier) {
      user = applyPaidGrant(user, await saveGrant(user, hit))
    } else if (hit?.active && hit.legacy && !(await membershipRevoked(hit.membershipId))) {
      user = { ...user, plan_status: 'active', active: true }
    }
  } catch (_) {}
  return user
}

/** Narration words a voice job will read: 150 a minute, so seconds = words / 2.5. */
const WORDS_PER_SECOND = 2.5
export function narrationSeconds(body) {
  const script = body?.script && typeof body.script === 'object' ? body.script : body || {}
  let text = String(script.full_script || body?.full_script || '').trim()
  if (!text && Array.isArray(script.sections)) {
    text = script.sections.map((s) => (typeof s === 'string' ? s : [s?.text, s?.content, s?.narration, s?.script].filter(Boolean).join(' '))).join(' ')
  }
  const words = text.split(/\s+/).filter(Boolean).length
  return words ? words / WORDS_PER_SECOND : 0
}

export function ruleFor(method, subpath) {
  const p = String(subpath || '').replace(/^\/+|\/+$/g, '')
  if (method === 'GET' && (p === 'usage' || p === 'quota')) return { type: 'usage' }
  if (method === 'POST' && p === 'faceless/script') return { type: 'length' }
  if (method === 'POST' && p === 'faceless/media') return { type: 'media' }
  if (method === 'POST' && p === 'faceless/media/refund') return { type: 'media_refund' }
  if (method === 'POST' && p === 'faceless/render') return { type: 'generate' }
  if (method === 'POST' && p === 'download/analyze') return { type: 'feature', feature: 'viral_moment_clipping' }
  if (method === 'POST' && (p === 'autoclip' || p.startsWith('autoclip/'))) return { type: 'feature', feature: 'viral_moment_clipping' }
  return { type: 'forward' }
}

function queryString(query) {
  if (!query) return ''
  const params = query instanceof URLSearchParams
    ? new URLSearchParams(query)
    : typeof query === 'string'
      ? new URLSearchParams(query.replace(/^\?/, ''))
      : (() => {
        const next = new URLSearchParams()
        for (const [k, v] of Object.entries(query || {})) {
          if (v == null || v === '') continue
          next.set(k, String(v))
        }
        return next
      })()
  params.delete('p')
  params.delete('path')
  params.delete('paid') // vercel.json's case-insensitive rewrite adds it
  return params.toString()
}

/**
 * Proof for the Railway backend that a paid call passed this gate. Railway
 * should refuse its paid routes without it (docs/railway-gate-secret.md), so
 * the plan check cannot be skipped by calling Railway or /rapi directly.
 */
export function gateSecretHeader(env = process.env) {
  const secret = String(env?.TUBEOPS_GATE_SECRET || '').trim()
  return secret ? { 'X-TubeOps-Gate': secret } : {}
}

export async function railwayFetch(token, method, subpath, body, query) {
  const path = String(subpath || '').replace(/^\/+|\/+$/g, '')
  const qs = queryString(query)
  const url = UPSTREAM + '/api/' + path + (qs ? '?' + qs : '')
  const headers = { Authorization: 'Bearer ' + token, ...gateSecretHeader() }
  const verb = String(method || 'GET').toUpperCase()
  let payload
  if (verb !== 'GET' && verb !== 'HEAD') {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body || {})
  }
  const res = await fetch(url, { method: verb, headers, body: payload })
  const text = await res.text()
  let data
  try { data = JSON.parse(text) } catch { data = { raw: text } }
  return { status: res.status, data, text }
}

export function usageBody(user, usage) {
  const credits = studioCreditView(user, usage)
  return {
    long_form_used: usage.long_form_used,
    short_form_used: usage.short_form_used,
    studio_credits_used: usage.studio_credits_used,
    studio_credits_limit: credits.limit,
    studio_credits_remaining: credits.remaining,
    credits_carry: usage.credits_carry || 0,
    scene_free: usage.scene_free || 0,
    known: true,
    plan: user.plan || user.plan_tier,
    plan_status: user.plan_status,
  }
}

// ---------------------------------------------------------------- failed voice jobs

const MEDIA_NS = 'vidso:mediacharge:'
const MEDIA_TTL_SEC = 3 * 24 * 60 * 60
const mediaLocal = globalThis.__vidsoMediaCharges || (globalThis.__vidsoMediaCharges = new Map())

function mediaJobId(data) {
  return String(data?.jobId || data?.job_id || data?.id || '').trim()
}

function ownerKey(user) {
  return String(user?.id || user?.user_id || user?.email || '').trim().toLowerCase()
}

/** What a voice job cost, so it can be given back if the job fails. */
export async function rememberMediaCharge(user, data, credits) {
  const jobId = mediaJobId(data)
  if (!jobId || !credits) return false
  const rec = { owner: ownerKey(user), credits, at: new Date().toISOString() }
  mediaLocal.set(jobId, rec)
  if (kvConfigured()) await kvSetJsonTtl(MEDIA_NS + jobId, rec, MEDIA_TTL_SEC)
  return true
}

async function mediaCharge(jobId) {
  if (kvConfigured()) {
    const rec = await kvReadJson(MEDIA_NS + jobId)
    if (rec) return rec
  }
  return mediaLocal.get(jobId) || null
}

const FAILED_JOB = new Set(['error', 'failed', 'cancelled', 'canceled'])

/**
 * Give back a voice job's credits once, after Railway itself says the job
 * failed. The client only names the job; the status comes from Railway.
 */
export async function refundFailedMedia({ token, user, jobId }) {
  const id = String(jobId || '').trim()
  if (!id || !/^[\w-]{1,128}$/.test(id)) return { status: 400, body: { error: 'Missing job id' } }
  const rec = await mediaCharge(id)
  if (!rec || rec.owner !== ownerKey(user)) return { status: 200, body: { refunded: 0, reason: 'no_charge' } }
  const job = await railwayFetch(token, 'GET', 'faceless/media/' + id)
  const status = String(job.data?.status || '').trim().toLowerCase()
  if (job.status >= 400 || !FAILED_JOB.has(status)) return { status: 200, body: { refunded: 0, reason: 'not_failed', jobStatus: status || null } }
  // Only once, across instances and retries.
  const first = kvConfigured() ? await kvLock(MEDIA_NS + id + ':refunded', MEDIA_TTL_SEC) : !rec.refunded
  if (!first) return { status: 200, body: { refunded: 0, reason: 'already_refunded' } }
  rec.refunded = true
  mediaLocal.set(id, rec)
  await releaseStudioCredits(user, rec.credits)
  return { status: 200, body: { refunded: rec.credits } }
}

export async function runGatedApi({ token, user, method, subpath, body = {}, query }) {
  const verb = String(method || 'GET').toUpperCase()
  const path = String(subpath || '').replace(/^\/+|\/+$/g, '')
  const rule = ruleFor(verb, path)
  const usage = await hydrateUsage(user)

  if (rule.type === 'usage') {
    return { status: 200, body: usageBody(user, usage) }
  }

  let payload = body && typeof body === 'object' ? { ...body } : {}
  const seconds = durationFromBody(payload)
  const kind = generationKindFromSeconds(seconds)
  if (verb === 'POST' && path === 'faceless/script') {
    payload = enrichScriptBody(payload, seconds)
  }

  if (rule.type === 'feature') {
    const gate = evaluateFeature({ user, feature: rule.feature })
    if (!gate.ok) {
      const http = toHttp(gate)
      return { status: http.status, body: http.body }
    }
  }

  // A video's minutes are paid as its narration is recorded, from the words in each
  // voice job (long videos record in parts). The first part carries what the whole
  // video will cost (credits_needed) so it is refused before anything is spent.
  let videoCharge = 0
  let allowance = 0
  let held = 0
  if (rule.type === 'media_refund') return refundFailedMedia({ token, user, jobId: payload.jobId || payload.job_id })
  if (rule.type === 'media') {
    const length = evaluateLength({ user, durationSeconds: seconds })
    if (!length.ok) {
      const http = toHttp(length)
      return { status: http.status, body: http.body }
    }
    const spoken = narrationSeconds(payload) || seconds
    videoCharge = videoCredits(spoken)
    // Two spare scenes per video, not per voice part: only the first part (the
    // one that carries the whole video's cost) adds them.
    allowance = payload.credits_needed != null ? sceneAllowance(spoken, payload.scene_pace) : sceneCount(spoken, payload.scene_pace)
    const credits = evaluateStudioCredits({
      user,
      cost: videoCharge,
      used: usage.studio_credits_used,
      carry: usage.credits_carry,
      need: payload.credits_needed,
    })
    if (!credits.ok) {
      const http = toHttp(credits)
      return { status: http.status, body: http.body }
    }
    // Take the credits now, atomically, so parallel requests can't overspend;
    // they go back if Railway refuses the job or the job fails (media_refund).
    const hold = await reserveStudioCredits(user, videoCharge, credits.limit)
    if (!hold.ok) {
      const again = evaluateStudioCredits({ user, cost: videoCharge, used: hold.used, carry: usage.credits_carry })
      const http = again.ok
        ? { status: 402, body: { ok: false, error: 'credits_exhausted', message: 'Not enough credits left for this part. Another job just used them.' } }
        : toHttp(again)
      return { status: http.status, body: http.body }
    }
    held = videoCharge
    delete payload.credits_needed
    delete payload.scene_pace
  }

  if (rule.type === 'length' || rule.type === 'generate') {
    const gate = rule.type === 'generate'
      ? evaluateGeneration({
        user,
        durationSeconds: seconds,
        kind: kind || undefined,
        used: kind === 'short_form' ? usage.short_form_used : usage.long_form_used,
      })
      : evaluateLength({ user, durationSeconds: seconds })
    if (!gate.ok) {
      const http = toHttp(gate)
      return { status: http.status, body: http.body }
    }
  }

  const forwardBody = path === 'faceless/script' ? scriptUpstreamBody(payload) : payload
  const upstream = await railwayFetch(token, verb, path, forwardBody, query)
  if (path === 'faceless/script') {
    const recovered = recoverScriptData(upstream.data, upstream.text)
    if (recovered && (
      upstream.status < 400 ||
      isJsonSyntaxError(upstream.data?.error || upstream.data?.message || upstream.text)
    )) {
      upstream.status = 200
      upstream.data = recovered
    }
  }
  if (rule.type === 'media' && held) {
    if (upstream.status >= 200 && upstream.status < 300) {
      try {
        await addSceneAllowance(user, allowance)
        await rememberMediaCharge(user, upstream.data, held)
      } catch (_) {}
    } else {
      try { await releaseStudioCredits(user, held) } catch (_) {}
    }
  }
  if (upstream.status >= 200 && upstream.status < 300 && rule.type === 'generate') {
    const g = evaluateGeneration({
      user,
      durationSeconds: seconds,
      kind: kind || undefined,
      used: kind === 'short_form' ? usage.short_form_used : usage.long_form_used,
    })
    if (g.ok && g.increment) {
      incrementUsage(user, g.kind)
      await settleUsageWrites()
    }
  }
  if (upstream.status >= 400) upstream.data = upstreamError(upstream, path)
  return { status: upstream.status, body: upstream.data, text: upstream.text }
}

/**
 * An upstream failure the browser can show. Railway answers plain text (not JSON) when a
 * request times out or the server is overloaded; that used to reach the app as just
 * "Request failed".
 */
export function upstreamError(upstream, path = '') {
  const data = upstream?.data && typeof upstream.data === 'object' ? upstream.data : {}
  if (data.message || data.error) return data
  const status = Number(upstream?.status) || 0
  const what = /script/.test(path) ? 'writing the script' : /media/.test(path) ? 'recording the narration' : /render/.test(path) ? 'rendering the video' : 'that step'
  const raw = String(data.raw || upstream?.text || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160)
  const message = status === 504 || status === 524 || /timed? ?out|timeout/i.test(raw)
    ? `The server took too long ${what}. Try again; a shorter length goes faster.`
    : status === 502 || status === 503 || /application failed to respond|bad gateway|unavailable|overloaded/i.test(raw)
      ? `The server was busy while ${what}. Try again in a moment.`
      : `Something went wrong ${what} (error ${status || 'unknown'}). Try again.`
  return { ...data, error: 'upstream_failed', message, detail: raw || undefined, upstream_status: status }
}
