import { WHOP_CHECKOUT } from '/lib/whop-map.js'
import { normalizeTier } from '/lib/entitlements.js'
import { quotaView, unlockCopy } from '/lib/quota.js'
import { planIsActive, withCompedPlan } from '/lib/comped.js'
import { applyPaidGrant } from '/lib/paid-grant.js'
import { gateHref, studioGateHref } from '/lib/studio-gate.js'
import { isJsonSyntaxError, recoverScriptData } from '/lib/json-repair.js'
import {
  getToken,
  getRefreshToken,
  setSession,
  clearSession,
  sessionFromAuthPayload,
  tokenNeedsRefresh,
} from '/lib/session-store.js'

const BASE = 'https://vibrant-patience-production-a7f0.up.railway.app'
// Public Supabase project used by the Railway API (iss claim on JWTs).
// Google OAuth starts here; tokens return to the app via redirect hash/query.
const SUPABASE_URL = 'https://ymtmgpgcmrazqeklixwf.supabase.co'

async function reqTo(url, method, body, isFormData = false, opts = {}) {
  const token = getToken()
  const headers = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  const hasBody = method !== 'GET' && method !== 'HEAD' && body != null
  if (!isFormData && hasBody) headers['Content-Type'] = 'application/json'
  const timeoutMs = Number(opts.timeoutMs) > 0 ? Number(opts.timeoutMs) : 0
  const ctrl = timeoutMs ? new AbortController() : null
  const timer = timeoutMs ? setTimeout(() => ctrl.abort(), timeoutMs) : null
  let res
  let raw = ''
  try {
    res = await fetch(url, {
      method,
      headers,
      body: isFormData ? body : (hasBody ? JSON.stringify(body) : undefined),
      signal: ctrl ? ctrl.signal : undefined,
    })
    raw = await res.text()
  } catch (e) {
    if (e && e.name === 'AbortError') throw new Error('That request timed out. Try again.')
    throw new Error('Cannot reach Clipzo API. The backend may be down. Try again in a minute.')
  } finally {
    if (timer) clearTimeout(timer)
  }
  let data = {}
  try { data = raw ? JSON.parse(raw) : {} } catch { data = { raw } }
  const recovered = opts.recoverScript ? recoverScriptData(data, raw) : null
  if (!res.ok) {
    if (recovered) return recovered
    const fallback = raw && !raw.trim().startsWith('{') ? raw.trim().slice(0, 180) : 'Request failed'
    const msg = data.message || data.error || fallback
    const err = new Error(
      isJsonSyntaxError(msg)
        ? 'Script JSON was incomplete. Try Generate Script again.'
        : msg,
    )
    err.status = res.status
    err.code = isJsonSyntaxError(msg) ? 'json_parse' : data.error
    err.needsPlan = res.status === 402
    err.needsUpgrade = res.status === 403
    throw err
  }
  return recovered || data
}

async function req(method, path, body, isFormData = false) {
  return reqTo(BASE + path, method, body, isFormData)
}

function sameOriginApi(path) {
  try {
    if (typeof location !== 'undefined' && /^https?:/.test(location.origin)) return location.origin + path
  } catch (_) {}
  return ''
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function generateFalMedia(body, { timeoutMs, waitLabel } = {}) {
  const startUrl = sameOriginApi('/api/generate/image')
  if (!startUrl) throw new Error((waitLabel || 'Generation') + ' is only available on the live app.')
  const start = await reqTo(startUrl, 'POST', body)
  if (Array.isArray(start.urls) && start.urls.length) return start
  if (!start.statusUrl || !start.responseUrl) throw new Error('Could not start the job.')
  const pollUrl = sameOriginApi('/api/generate/image-status')
  const deadline = Date.now() + (Number(timeoutMs) > 0 ? Number(timeoutMs) : 180000)
  while (Date.now() < deadline) {
    await sleep(body.kind === 'video' ? 4000 : 1800)
    const st = await reqTo(pollUrl, 'POST', {
      statusUrl: start.statusUrl,
      responseUrl: start.responseUrl,
    })
    if (st.done && Array.isArray(st.urls) && st.urls.length) {
      return {
        ...st,
        width: st.width || start.width,
        height: st.height || start.height,
        model: start.model || body.model,
        kind: st.kind || start.kind || body.kind || 'image',
      }
    }
  }
  throw new Error('Timed out waiting for the ' + (waitLabel || 'result') + '. Try again.')
}

function generateImageFal(body) {
  return generateFalMedia(body, { timeoutMs: 180000, waitLabel: 'image' })
}

/**
 * The gate function only matches one segment after /api/gate, so a nested path
 * like /api/faceless/script has to travel as /api/gate/faceless?p=script. Sent
 * nested it 404s, and the caller silently falls through to the unmetered
 * upstream — which is how /api/media/concat surfaced as "Cannot POST".
 */
function gateUrl(path) {
  const origin = (typeof location !== 'undefined' && /^https?:/.test(location.origin)) ? location.origin : ''
  if (!origin) return ''
  return origin + gateHref(path)
}

async function gatedReq(method, path, body, opts = {}) {
  const url = gateUrl(path)
  if (url) {
    try {
      return await reqTo(url, method, body, false, opts)
    } catch (e) {
      if (e.status !== 404) throw e
      // Falling back skips quota and plan checks, so make it visible.
      try { console.warn('[gate] no route for', path, '— using upstream directly') } catch (_) {}
    }
  }
  return reqTo(BASE + path, method, body, false, opts)
}

// Checkout URLs come from lib/whop-map.js (env-overridable plan IDs).

function appOrigin() {
  try { return location.origin } catch { return 'https://vidso.pro' }
}

function emailFromToken() {
  try {
    const token = getToken()
    if (!token) return ''
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return String(payload.email || payload.user_email || '').trim()
  } catch { return '' }
}

function formatQuota(me, usage) {
  return quotaView(me, usage).compact
}

function planReady(me, expectedTier) {
  if (!planIsActive(me)) return false
  const want = normalizeTier(expectedTier)
  if (!want) return true
  const got = normalizeTier(me.plan || me.plan_tier)
  if (!got) return true
  return got === want
}

function checkoutUrl(tier, interval, opts = {}) {
  const email = String(opts.email || emailFromToken() || '').trim()
  if (!email || !email.includes('@')) return ''
  const base = WHOP_CHECKOUT[`${tier}_${interval}`]
  if (!base) return ''
  const u = new URL(base)
  const userId = opts.userId ? String(opts.userId) : ''
  u.searchParams.set('email', email)
  u.searchParams.set('email.disabled', '1')
  const ret = `${opts.origin || appOrigin()}/video-generation?billing=success`
  u.searchParams.set('redirect', ret)
  u.searchParams.set('return_url', ret)
  if (userId) {
    u.searchParams.set('metadata[user_id]', userId)
    u.searchParams.set('metadata[vidso_user_id]', userId)
  }
  u.searchParams.set('metadata[email]', email)
  if (tier) u.searchParams.set('metadata[tier]', String(tier))
  return u.toString()
}

// Why the last sync said "not paid" — the paywall shows this instead of
// guessing, so a bad API key never looks like a missing purchase.
let _lastSync = null

async function recordCheckoutIntent(opts = {}) {
  const url = sameOriginApi('/api/billing/intent')
  if (!url) return null
  try {
    return await reqTo(url, 'POST', {
      tier: opts.tier || '',
      cycle: opts.cycle || '',
      origin: opts.origin || appOrigin(),
    })
  } catch (_) {
    return null
  }
}

async function billingSync(opts = {}) {
  const url = sameOriginApi('/api/billing/sync')
  if (!url) {
    _lastSync = { active: false, configured: false, reason: 'local' }
    return _lastSync
  }
  try {
    _lastSync = await reqTo(url, 'POST', { force: !!opts.force, paidEmail: opts.paidEmail || '' })
    return _lastSync
  } catch (e) {
    if (e.status === 404 || e.status === 501) {
      _lastSync = { active: false, configured: false, reason: 'missing_route' }
      return _lastSync
    }
    _lastSync = { active: false, reason: 'sync_failed', message: e.message }
    throw e
  }
}

function lastSync() {
  return _lastSync
}

/** Human copy for a failed sync, used by the paywall. */
function syncProblem(sync) {
  const s = sync || _lastSync
  if (!s || s.active) return ''
  if (s.reason === 'missing_key' || s.reason === 'missing_route') {
    return 'Billing checks are not configured on this deployment yet. Contact support and we will unlock it by hand.'
  }
  if (s.reason === 'bad_key' || s.reason === 'missing_permission') {
    return 'We could not read your payment from Whop because of a billing configuration problem on our side, not yours. Contact support and we will unlock it right away.'
  }
  if (s.reason === 'whop_error' || s.reason === 'sync_failed') {
    return 'Whop did not answer when we checked your payment. Wait a moment and tap I already paid again.'
  }
  if (s.reason === 'missing_identity') {
    return 'This account has no email, so there is nothing to match against Whop. Contact support.'
  }
  if (s.reason === 'need_checkout') {
    return 'Start checkout from this signed-in account first, then enter the email on your Whop receipt (Apple Hide My Email is a different address).'
  }
  if (s.reason === 'membership_taken') {
    return 'That payment is already attached to another Vidso account. Sign in there, or contact support.'
  }
  return ''
}

function mergeSync(me, sync) {
  if (!me || !sync?.active) return me
  if (sync.tier) return applyPaidGrant(me, sync)
  return { ...me, plan_status: 'active', active: true }
}

async function waitForProvisioned({ expectedTier, timeoutMs = 120000, intervalMs = 2500, onTick, paidEmail } = {}) {
  const started = Date.now()
  let last = null
  let force = true
  while (Date.now() - started < timeoutMs) {
    try {
      last = withCompedPlan(await req('GET', '/api/user/me'))
      if (!planIsActive(last)) {
        last = mergeSync(last, await billingSync({ force, paidEmail }))
        force = false
      }
      if (typeof onTick === 'function') onTick(last)
      const active = planIsActive(last)
      const ready = planReady(last, expectedTier)
      const late = active && Date.now() - started > timeoutMs - 10000
      if (ready || late) return last
    } catch (e) {
      if (typeof onTick === 'function') onTick(null, e)
    }
    await new Promise(r => setTimeout(r, intervalMs))
  }
  return last
}

export const api = {
  auth: {
    signup:  async (email, password, name) => {
      const data = await req('POST', '/api/auth/signup',  { email, password, name })
      const session = sessionFromAuthPayload(data)
      if (!session) throw new Error('Signup returned no session')
      return { ...data, session }
    },
    login:   async (email, password) => {
      const data = await req('POST', '/api/auth/login',   { email, password })
      const session = sessionFromAuthPayload(data)
      if (!session) throw new Error('Login returned no session')
      return { ...data, session }
    },
    logout:  ()                      => req('POST', '/api/auth/logout'),
    refresh: async (refresh_token) => {
      const data = await req('POST', '/api/auth/refresh', { refresh_token })
      const session = sessionFromAuthPayload(data)
      if (!session) throw new Error('refresh returned no session')
      return { ...data, session }
    },
    // Google OAuth via Supabase Auth (implicit redirect with tokens in URL hash).
    googleStartUrl: (redirect_to) =>
      `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirect_to)}&prompt=select_account`,
  },
  user: {
    me: async () => {
      const me = await req('GET', '/api/user/me')
      try {
        const u = await gatedReq('GET', '/api/usage')
        if (u && (u.long_form_used != null || u.short_form_used != null)) {
          me.long_form_used = u.long_form_used
          me.short_form_used = u.short_form_used
        }
      } catch (_) {}
      let user = withCompedPlan({ ...me, email: me.email || emailFromToken() })
      if (!planIsActive(user)) {
        try { user = mergeSync(user, await billingSync()) } catch (_) {}
      }
      return user
    },
    usage: () => req('GET', '/api/user/usage'),
  },
  upload: {
    file: (formData) => req('POST', '/api/upload', formData, true),
    list: ()         => req('GET',  '/api/upload'),
    del:  (id)       => req('DELETE', `/api/upload/${id}`),
  },
  tts: {
    voices:   ()      => reqTo(BASE + '/api/tts/voices', 'GET', undefined, false, { timeoutMs: 12000 }),
    generate: (body)  => req('POST', '/api/tts/generate', body),
    library:  ()      => req('GET',  '/api/tts/library'),
    deleteVo: (id)    => req('DELETE', `/api/tts/library/${id}`),
  },
  generate: {
    image: (body) => generateImageFal(body),
    video: (body) => generateFalMedia({ ...body, kind: 'video' }, { timeoutMs: 480000, waitLabel: 'video' }),
    imageSave: (body) => {
      const url = sameOriginApi('/api/generate/image-save')
      if (!url) throw new Error('Image history is only available on the live app.')
      return reqTo(url, 'POST', body)
    },
    images: (opts = {}) => {
      const base = sameOriginApi('/api/generate/images')
      if (!base) throw new Error('Image history is only available on the live app.')
      const q = new URLSearchParams()
      if (opts.offset) q.set('offset', String(opts.offset))
      if (opts.limit) q.set('limit', String(opts.limit))
      if (opts.favorites) q.set('favorites', '1')
      const qs = q.toString()
      return reqTo(base + (qs ? '?' + qs : ''), 'GET')
    },
    imagePatch: (id, body) => {
      const url = sameOriginApi('/api/generate/images/' + encodeURIComponent(id))
      if (!url) throw new Error('Image history is only available on the live app.')
      return reqTo(url, 'PATCH', body)
    },
    imageDelete: (id) => {
      const url = sameOriginApi('/api/generate/images/' + encodeURIComponent(id))
      if (!url) throw new Error('Image history is only available on the live app.')
      return reqTo(url, 'DELETE')
    },
  },
  studio: {
    list: (opts = {}) => {
      const q = new URLSearchParams()
      if (opts.offset) q.set('offset', String(opts.offset))
      if (opts.limit) q.set('limit', String(opts.limit))
      if (opts.q) q.set('q', opts.q)
      if (opts.sort) q.set('sort', opts.sort)
      if (opts.favorites) q.set('favorites', '1')
      const rel = '/projects' + (q.toString() ? '?' + q.toString() : '')
      const url = sameOriginApi(studioGateHref(rel))
      if (!url) throw new Error('Faceless Studio is only available on the live app.')
      return reqTo(url, 'GET')
    },
    create: (body) => {
      const url = sameOriginApi(studioGateHref('/projects'))
      if (!url) throw new Error('Faceless Studio is only available on the live app.')
      return reqTo(url, 'POST', body)
    },
    get: (id) => {
      const url = sameOriginApi(studioGateHref('/projects/' + encodeURIComponent(id)))
      if (!url) throw new Error('Faceless Studio is only available on the live app.')
      return reqTo(url, 'GET')
    },
    patch: (id, body) => {
      const url = sameOriginApi(studioGateHref('/projects/' + encodeURIComponent(id)))
      if (!url) throw new Error('Faceless Studio is only available on the live app.')
      return reqTo(url, 'PATCH', body)
    },
    jobs: (opts = {}) => {
      const q = new URLSearchParams()
      if (opts.offset) q.set('offset', String(opts.offset))
      if (opts.limit) q.set('limit', String(opts.limit))
      if (opts.favorites) q.set('favorites', '1')
      if (opts.project_id) q.set('project_id', opts.project_id)
      const rel = '/jobs' + (q.toString() ? '?' + q.toString() : '')
      const url = sameOriginApi(studioGateHref(rel))
      if (!url) throw new Error('Faceless Studio is only available on the live app.')
      return reqTo(url, 'GET')
    },
  },
  transcribe: {
    start: (file_url) => req('POST', '/api/transcribe', { file_url }),
    poll:  (jobId)    => req('GET',  `/api/transcribe/${jobId}`),
  },
  download: {
    info:      (url) => req('POST', '/api/download/info', { url }),
    search:    (q, limit) => req('POST', '/api/download/search', { q, limit }),
    analyze:   (url) => gatedReq('POST', '/api/download/analyze', { url }),
    streamUrl: (url) => `${BASE}/api/download/stream?url=${encodeURIComponent(url)}&token=${encodeURIComponent(getToken())}`,
    clipUrl:   (url, start, end, frame, crop) => {
      const params = [
        `url=${encodeURIComponent(url)}`,
        `start=${start}`,
        `end=${end}`,
        `token=${encodeURIComponent(getToken())}`,
      ]
      if (frame && frame !== 'original') params.push(`frame=${frame}`)
      if (crop && crop !== 'fit') params.push(`crop=${encodeURIComponent(crop)}`)
      return `${BASE}/api/download/clip?${params.join('&')}`
    },
  },
  autoclip: {
    start: (file_url) => gatedReq('POST', '/api/autoclip', { file_url }),
    poll:  (jobId, count, genre) => req('GET',  `/api/autoclip/${jobId}?count=${count || 5}${genre ? `&genre=${encodeURIComponent(genre)}` : ''}`),
  },
  caption: {
    // Burn captions onto the video. Returns an object URL for a video blob.
    // style: preset key (karaoke|karaoke_yellow|clean|boxed|bangers|...)
    // position: optional { x, y } each 0..1, or null for the style default.
    // custom: optional { font, sizePct, outline, outlineWidthPct } manual overrides.
    burn: async (jobId, url, style, position, custom) => {
      const res = await fetch(BASE + '/api/caption/burn', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, url, style, position: position || undefined, custom: custom || undefined }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const err = new Error(data.message || data.error || 'Caption burn failed')
        err.status = res.status
        err.needsPlan = res.status === 402
        throw err
      }
      return URL.createObjectURL(await res.blob())
    },
  },
  reframe: {
    // Step 1: kick off download + subject tracking for a URL. Returns { jobId }.
    start: (url) => req('POST', '/api/reframe', { url }),
    // Step 2: poll analysis status. Returns { status: 'processing'|'ready'|'error', duration, width, height, error }.
    poll: (jobId) => req('GET', `/api/reframe/${jobId}`),
    // Step 3: render with chosen aspect/layout (fast — reuses the cached download
    // + tracking data). Returns an object URL for the mp4 blob, or throws with
    // err.needsPlan if the user is gated by the paid-only check.
    render: async (jobId, opts = {}) => {
      const res = await fetch(BASE + `/api/reframe/${jobId}/render`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ aspect: opts.aspect, layout: opts.layout, fitCrop: opts.fitCrop, start: opts.start, end: opts.end }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const err = new Error(data.message || data.error || 'Reframe failed')
        err.status = res.status
        err.needsPlan = res.status === 402
        throw err
      }
      return URL.createObjectURL(await res.blob())
    },
  },
  ranking: {
    start: (body) => req('POST', '/api/ranking', body),
    poll:  (jobId) => req('GET', `/api/ranking/${jobId}`),
    download: async (jobId) => {
      const res = await fetch(BASE + `/api/ranking/${jobId}/download`, {
        headers: { 'Authorization': `Bearer ${getToken()}` },
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const err = new Error(data.message || data.error || 'Download failed')
        err.status = res.status
        throw err
      }
      return URL.createObjectURL(await res.blob())
    },
  },
  commentary: {
    // body: { file_url, trim:{start,end}, script, subtitle:{...}, shape:{aspect,bg}, audio:{...} }
    start: (body) => req('POST', '/api/commentary', body),
    // body: { topic, tone, length, hook, cta } → { script }
    script: (body) => req('POST', '/api/commentary/script', body),
    poll:  (jobId) => req('GET', `/api/commentary/${jobId}`),
    download: async (jobId) => {
      const res = await fetch(BASE + `/api/commentary/${jobId}/download`, {
        headers: { 'Authorization': `Bearer ${getToken()}` },
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const err = new Error(data.message || data.error || 'Download failed')
        err.status = res.status
        throw err
      }
      return URL.createObjectURL(await res.blob())
    },
  },
  faceless: {
    presets: () => req('GET', '/api/faceless/presets'),
    // body: { topic, duration_id, duration (minutes), duration_seconds, target_words, aspect }
    script: (body, opts = {}) => gatedReq('POST', '/api/faceless/script', body, {
      timeoutMs: opts.timeoutMs || 120000,
      recoverScript: true,
    }),
    // body: { topic, section_id, heading, text, full_script } → rewritten section
    rewriteSection: (body, opts = {}) => reqTo(BASE + '/api/faceless/script/section', 'POST', body, false, {
      timeoutMs: opts.timeoutMs || 90000,
      recoverScript: true,
    }),
    // body: { script, voice_id, voice_settings, aspect, duration_id } → { jobId }
    startMedia: (body) => gatedReq('POST', '/api/faceless/media', body),
    pollMedia: (jobId) => req('GET', `/api/faceless/media/${jobId}`),
    concatVoiceovers: (urls) => gatedReq('POST', '/api/media/concat', { urls }),
    /** Same-origin proxy for CDN voiceover parts (avoids browser CORS on join). */
    voiceoverFetchUrl: (fileUrl) => {
      const origin = (typeof location !== 'undefined' && /^https?:/.test(location.origin)) ? location.origin : ''
      if (!origin) return String(fileUrl || '')
      return origin + '/api/gate/media?p=fetch&url=' + encodeURIComponent(String(fileUrl || ''))
    },
    // body: { query, aspect } → { clips }
    searchBroll: (body) => req('POST', '/api/faceless/broll/search', body),
    // body: { voiceover_url, duration, words, timeline, aspect, caption, music }
    startRender: (body) => gatedReq('POST', '/api/faceless/render', body),
    pollRender: (jobId) => req('GET', `/api/faceless/render/${jobId}`),
    downloadRender: async (jobId) => {
      const res = await fetch(BASE + `/api/faceless/render/${jobId}/download`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const err = new Error(data.message || data.error || 'Download failed')
        err.status = res.status
        err.needsPlan = res.status === 402
        throw err
      }
      return URL.createObjectURL(await res.blob())
    },
  },
  billing: {
    checkoutUrl,
    waitForProvisioned,
    sync: billingSync,
    recordCheckoutIntent,
    lastSync,
    syncProblem,
    formatQuota,
    quotaView,
    unlockCopy,
    canClip: async () => {
      try {
        const me = withCompedPlan(await req('GET', '/api/user/me'))
        return planIsActive(me)
      } catch { return false }
    },
  },
}

export { getToken, getRefreshToken, setSession, clearSession, tokenNeedsRefresh, WHOP_CHECKOUT }
