/** Shared Railway gate used by /api/gate and Claude MCP tools. */

import { evaluateFeature, evaluateGeneration, evaluateLength, evaluatePlan, evaluateStudioCredits, toHttp } from './enforce.js'
import { enrichScriptBody, scriptUpstreamBody } from './faceless-length.js'
import { durationFromBody, generationKindFromSeconds } from './quota.js'
import { sceneAllowance, sceneCount, studioCreditView, videoCredits } from './studio-credits.js'
import { addSceneAllowance, hydrateUsage, incrementUsage, releaseStudioCredits, reserveStudioCredits, settleUsageWrites, takeSceneAllowance } from './usage-store.js'
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

// Chinese and Japanese are written without spaces, so splitting on whitespace
// counted a whole paragraph as one word. A CJK ideograph or kana is about half
// a spoken word, a Thai character about a quarter.
const CJK_CHAR = /[\u3040-\u30ff\u31f0-\u31ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f]|[\u{20000}-\u{2fa1f}]/gu
const THAI_CHAR = /[\u0e00-\u0e7f]/g

/** Spoken words in a text, for billing: space-separated words plus CJK and Thai characters. */
export function narrationWords(text) {
  const raw = String(text || '')
  if (!raw.trim()) return 0
  const cjk = (raw.match(CJK_CHAR) || []).length
  const thai = (raw.match(THAI_CHAR) || []).length
  const rest = raw.replace(CJK_CHAR, ' ').replace(THAI_CHAR, ' ')
  const words = rest.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length
  return words + cjk * 0.5 + thai * 0.25
}

function sectionText(sections) {
  if (!Array.isArray(sections)) return ''
  return sections.map((s) => (typeof s === 'string' ? s : [s?.text, s?.content, s?.narration, s?.script].filter(Boolean).join(' '))).join(' ')
}

export function narrationSeconds(body) {
  const script = body?.script && typeof body.script === 'object' ? body.script : body || {}
  const full = narrationWords(script.full_script || body?.full_script || '')
  // Either field may be what gets read aloud, so a short full_script can't
  // stand in for long sections: charge the larger of the two.
  const sections = Math.max(narrationWords(sectionText(script.sections)), narrationWords(sectionText(body?.sections)))
  const words = Math.max(full, sections)
  return words ? words / WORDS_PER_SECOND : 0
}

/**
 * Railway routes that spend money (TTS, transcription, LLM, video work) but have
 * no metered rule of their own still need an active plan. GET reads (voices,
 * files, job polls) stay open to any signed-in user.
 */
export const PAID_FORWARD_POSTS = new Set([
  'tts/generate',
  'transcribe',
  'ranking',
  'commentary',
  'commentary/script',
  'reframe',
  'faceless/script/section',
  'faceless/broll/search',
  'download/info',
  'download/search',
  'caption/burn',
])

export function ruleFor(method, subpath) {
  // Express on Railway ignores case, so the rules must too.
  const p = String(subpath || '').replace(/^\/+|\/+$/g, '').toLowerCase()
  if (method === 'GET' && (p === 'usage' || p === 'quota')) return { type: 'usage' }
  if (method === 'POST' && p === 'faceless/script') return { type: 'length' }
  if (method === 'POST' && p === 'faceless/media') return { type: 'media' }
  if (method === 'POST' && p === 'faceless/media/refund') return { type: 'media_refund' }
  if (method === 'POST' && p === 'faceless/render') return { type: 'generate' }
  if (method === 'POST' && p === 'download/analyze') return { type: 'feature', feature: 'viral_moment_clipping' }
  if (method === 'POST' && (p === 'autoclip' || p.startsWith('autoclip/'))) return { type: 'feature', feature: 'viral_moment_clipping' }
  if (method === 'POST' && PAID_FORWARD_POSTS.has(p)) return { type: 'plan' }
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

// Last line of defence: this request carries the gate secret, so it may only
// name a plain route that fetch and Express will not rewrite into another one.
const RAILWAY_PATH = /^[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)*$/

export async function railwayFetch(token, method, subpath, body, query) {
  const path = String(subpath || '').replace(/^\/+|\/+$/g, '')
  if (!RAILWAY_PATH.test(path)) {
    const err = new Error('Invalid API path')
    err.status = 400
    err.code = 'invalid_path'
    throw err
  }
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

/** What a voice job cost (credits and the free scenes it added), so both can be given back if it fails. */
export async function rememberMediaCharge(user, data, credits, scenes = 0) {
  const jobId = mediaJobId(data)
  if (!jobId || !credits) return false
  const rec = { owner: ownerKey(user), credits, scenes: Math.max(0, Math.floor(Number(scenes) || 0)), at: new Date().toISOString() }
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
  // The free scenes this job added go too, or failing jobs on purpose would farm them.
  const scenesBack = await takeBackScenes(user, rec.scenes)
  return { status: 200, body: { refunded: rec.credits, scenes_removed: scenesBack } }
}

/** Remove up to `count` free scenes (fewer if some were already used). */
async function takeBackScenes(user, count) {
  const n = Math.min(500, Math.max(0, Math.floor(Number(count) || 0)))
  let taken = 0
  for (let i = 0; i < n; i++) {
    if (!(await takeSceneAllowance(user))) break
    taken++
  }
  return taken
}

export async function runGatedApi({ token, user, method, subpath, body = {}, query }) {
  const verb = String(method || 'GET').toUpperCase()
  const path = String(subpath || '').replace(/^\/+|\/+$/g, '')
  const lower = path.toLowerCase()
  const rule = ruleFor(verb, path)
  const usage = await hydrateUsage(user)

  if (rule.type === 'usage') {
    return { status: 200, body: usageBody(user, usage) }
  }

  let payload = body && typeof body === 'object' ? { ...body } : {}
  const seconds = durationFromBody(payload)
  const kind = generationKindFromSeconds(seconds)
  if (verb === 'POST' && lower === 'faceless/script') {
    payload = enrichScriptBody(payload, seconds)
  }

  if (rule.type === 'plan') {
    const plan = evaluatePlan(user)
    if (!plan.ok) {
      const http = toHttp(plan)
      return { status: http.status, body: http.body }
    }
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
    // one that carries the whole video's cost) adds them, and only when it was
    // actually charged, so free calls can't farm spare scenes.
    allowance = payload.credits_needed != null && videoCharge > 0
      ? sceneAllowance(spoken, payload.scene_pace)
      : videoCharge > 0 ? sceneCount(spoken, payload.scene_pace) : 0
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

  const forwardBody = lower === 'faceless/script' ? scriptUpstreamBody(payload) : payload
  const upstream = await railwayFetch(token, verb, path, forwardBody, query)
  if (lower === 'faceless/script') {
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
        await rememberMediaCharge(user, upstream.data, held, allowance)
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
