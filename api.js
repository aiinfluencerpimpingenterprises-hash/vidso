import { WHOP_CHECKOUT } from '/lib/whop-map.js'
import { normalizeTier } from '/lib/entitlements.js'
import { quotaView, unlockCopy } from '/lib/quota.js'
import { planIsActive, withCompedPlan } from '/lib/comped.js'

const BASE = 'https://vibrant-patience-production-a7f0.up.railway.app'
// Public Supabase project used by the Railway API (iss claim on JWTs).
// Google OAuth starts here; tokens return to the app via redirect hash/query.
const SUPABASE_URL = 'https://ymtmgpgcmrazqeklixwf.supabase.co'

function getToken() { return localStorage.getItem('clipzo_token') }
function setSession(session) {
  localStorage.setItem('clipzo_token', session.access_token)
  localStorage.setItem('clipzo_refresh', session.refresh_token)
}
function clearSession() {
  localStorage.removeItem('clipzo_token')
  localStorage.removeItem('clipzo_refresh')
}

async function reqTo(url, method, body, isFormData = false) {
  const token = getToken()
  const headers = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (!isFormData) headers['Content-Type'] = 'application/json'
  let res
  try {
    res = await fetch(url, {
      method,
      headers,
      body: isFormData ? body : (body ? JSON.stringify(body) : undefined),
    })
  } catch {
    throw new Error('Cannot reach Clipzo API. The backend may be down. Try again in a minute.')
  }
  const raw = await res.text()
  let data = {}
  try { data = raw ? JSON.parse(raw) : {} } catch { data = { raw } }
  if (!res.ok) {
    const fallback = raw && !raw.trim().startsWith('{') ? raw.trim().slice(0, 180) : 'Request failed'
    const err = new Error(data.message || data.error || fallback)
    err.status = res.status
    err.code = data.error
    err.needsPlan = res.status === 402
    err.needsUpgrade = res.status === 403
    throw err
  }
  return data
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

async function generateImageFal(body) {
  const startUrl = sameOriginApi('/api/generate/image')
  if (!startUrl) throw new Error('Image generation is only available on the live app.')
  const start = await reqTo(startUrl, 'POST', body)
  if (Array.isArray(start.urls) && start.urls.length) return start
  if (!start.statusUrl || !start.responseUrl) throw new Error('Could not start the image job.')
  const pollUrl = sameOriginApi('/api/generate/image-status')
  const deadline = Date.now() + 180000
  while (Date.now() < deadline) {
    await sleep(1800)
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
      }
    }
  }
  throw new Error('Timed out waiting for the image. Try again.')
}

function gateUrl(path) {
  const origin = (typeof location !== 'undefined' && /^https?:/.test(location.origin)) ? location.origin : ''
  if (!origin) return ''
  return origin + '/api/gate' + String(path || '').replace(/^\/api/, '')
}

async function gatedReq(method, path, body) {
  const url = gateUrl(path)
  if (url) {
    try {
      return await reqTo(url, method, body)
    } catch (e) {
      if (e.status !== 404) throw e
    }
  }
  return req(method, path, body)
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
  const base = WHOP_CHECKOUT[`${tier}_${interval}`]
  if (!base) return ''
  const u = new URL(base)
  const email = String(opts.email || emailFromToken() || '').trim()
  const userId = opts.userId ? String(opts.userId) : ''
  if (email) {
    u.searchParams.set('email', email)
    u.searchParams.set('email.disabled', '1')
  }
  const ret = `${opts.origin || appOrigin()}/dashboard?billing=success`
  u.searchParams.set('redirect', ret)
  u.searchParams.set('return_url', ret)
  if (userId) u.searchParams.set('metadata[user_id]', userId)
  if (email) u.searchParams.set('metadata[email]', email)
  if (tier) u.searchParams.set('metadata[tier]', String(tier))
  return u.toString()
}

async function waitForProvisioned({ expectedTier, timeoutMs = 120000, intervalMs = 2500, onTick } = {}) {
  const started = Date.now()
  let last = null
  while (Date.now() - started < timeoutMs) {
    try {
      last = withCompedPlan(await req('GET', '/api/user/me'))
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
    signup:  (email, password, name) => req('POST', '/api/auth/signup',  { email, password, name }),
    login:   (email, password)       => req('POST', '/api/auth/login',   { email, password }),
    logout:  ()                      => req('POST', '/api/auth/logout'),
    refresh: (refresh_token)         => req('POST', '/api/auth/refresh', { refresh_token }),
    // Google OAuth via Supabase Auth (implicit redirect with tokens in URL hash).
    googleStartUrl: (redirect_to) =>
      `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirect_to)}`,
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
      return withCompedPlan({ ...me, email: me.email || emailFromToken() })
    },
    usage: () => req('GET', '/api/user/usage'),
  },
  upload: {
    file: (formData) => req('POST', '/api/upload', formData, true),
    list: ()         => req('GET',  '/api/upload'),
    del:  (id)       => req('DELETE', `/api/upload/${id}`),
  },
  tts: {
    voices:   ()      => req('GET',  '/api/tts/voices'),
    generate: (body)  => req('POST', '/api/tts/generate', body),
    library:  ()      => req('GET',  '/api/tts/library'),
    deleteVo: (id)    => req('DELETE', `/api/tts/library/${id}`),
  },
  generate: {
    image: (body) => generateImageFal(body),
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
    // body: { topic, duration_id, aspect } → structured script
    script: (body) => gatedReq('POST', '/api/faceless/script', body),
    // body: { topic, section_id, heading, text, full_script } → rewritten section
    rewriteSection: (body) => req('POST', '/api/faceless/script/section', body),
    // body: { script, voice_id, aspect, duration_id } → { jobId }
    startMedia: (body) => gatedReq('POST', '/api/faceless/media', body),
    pollMedia: (jobId) => req('GET', `/api/faceless/media/${jobId}`),
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
    // tier: 'starter'|'creator'|'business', interval: 'monthly'|'yearly'
    checkoutUrl: (tier, interval, opts) => checkoutUrl(tier, interval, opts) || WHOP_CHECKOUT.creator_monthly,
    waitForProvisioned,
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

export { getToken, setSession, clearSession, WHOP_CHECKOUT }
