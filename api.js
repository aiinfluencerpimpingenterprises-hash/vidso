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

async function req(method, path, body, isFormData = false) {
  const token = getToken()
  const headers = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (!isFormData) headers['Content-Type'] = 'application/json'
  let res
  try {
    res = await fetch(BASE + path, {
      method,
      headers,
      body: isFormData ? body : (body ? JSON.stringify(body) : undefined),
    })
  } catch {
    throw new Error('Cannot reach Clipzo API. The backend may be down. Try again in a minute.')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    // 402 = paid-only gate (no active plan or monthly quota used up). Surface a
    // structured error so the UI can show an upgrade prompt instead of a raw message.
    const err = new Error(data.message || data.error || 'Request failed')
    err.status = res.status
    err.code = data.error // 'no_active_plan' | 'quota_exceeded' | ...
    err.needsPlan = res.status === 402
    throw err
  }
  return data
}

// Your 6 Whop checkout links. After creating the plans in Whop, copy each plan's
// public checkout URL and paste it here. Used by the pricing buttons + upgrade prompts.
const WHOP_CHECKOUT = {
  // Plus / Pro / Studio — wired to live Whop checkout plans.
  starter_monthly:  'https://whop.com/checkout/plan_2PQXzyYrseWZ6', // Vidso Plus $70/mo
  starter_yearly:   'https://whop.com/checkout/plan_5FMFAYw0z7AbJ', // Vidso Plus $588/yr
  creator_monthly:  'https://whop.com/checkout/plan_oYn5KJ7Wnv8NA', // Vidso Pro $99/mo
  creator_yearly:   'https://whop.com/checkout/plan_PBiAm2SiwS0jR', // Vidso Pro $828/yr
  business_monthly: 'https://whop.com/checkout/plan_pXuKK8Tk1Aj05', // Vidso Studio $150/mo
  business_yearly:  'https://whop.com/checkout/plan_7HLlhKgRF0XfQ', // Vidso Studio $1260/yr
}

// Monthly allotment the paywall advertises. Railway should grant these on
// membership.went_valid / payment.succeeded for the matching Whop plan ID.
const PLAN_QUOTAS = {
  starter:  { name: 'Plus',   credits: 300,  videos: 30 },
  creator:  { name: 'Pro',    credits: 1000, videos: 100 },
  business: { name: 'Studio', credits: null, videos: null },
}

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

function quotaFor(plan) {
  const p = String(plan || '').toLowerCase()
  if (PLAN_QUOTAS[p]) return PLAN_QUOTAS[p]
  if (p.includes('plus') || p.includes('starter')) return PLAN_QUOTAS.starter
  if (p.includes('pro') || p.includes('creator')) return PLAN_QUOTAS.creator
  if (p.includes('studio') || p.includes('business')) return PLAN_QUOTAS.business
  return null
}

function formatCredits(me) {
  if (!me) return '0'
  const q = quotaFor(me.plan || me.plan_tier)
  const n = Number(me.credits)
  const unlimited = me.plan_status === 'active' && (
    (q && q.credits == null) || n < 0 || n >= 99999
  )
  if (unlimited) return 'Unlimited'
  if (!Number.isFinite(n)) return String(me.credits ?? 0)
  return String(Math.max(0, Math.floor(n)))
}

function creditsGranted(me, expectedTier) {
  if (!me || me.plan_status !== 'active') return false
  const q = quotaFor(expectedTier) || quotaFor(me.plan || me.plan_tier)
  if (!q || q.credits == null) return true
  const n = Number(me.credits)
  if (!Number.isFinite(n)) return true
  if (n < 0 || n >= 99999) return true
  return n >= q.credits
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
      last = await req('GET', '/api/user/me')
      if (typeof onTick === 'function') onTick(last)
      const active = last?.plan_status === 'active'
      const ready = creditsGranted(last, expectedTier)
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
    me:    () => req('GET', '/api/user/me'),
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
    image: (body) => req('POST', '/api/generate/image', body),
  },
  transcribe: {
    start: (file_url) => req('POST', '/api/transcribe', { file_url }),
    poll:  (jobId)    => req('GET',  `/api/transcribe/${jobId}`),
  },
  download: {
    info:      (url) => req('POST', '/api/download/info', { url }),
    search:    (q, limit) => req('POST', '/api/download/search', { q, limit }),
    analyze:   (url) => req('POST', '/api/download/analyze', { url }),
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
    start: (file_url) => req('POST', '/api/autoclip', { file_url }),
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
    script: (body) => req('POST', '/api/faceless/script', body),
    // body: { topic, section_id, heading, text, full_script } → rewritten section
    rewriteSection: (body) => req('POST', '/api/faceless/script/section', body),
    // body: { script, voice_id, aspect } → { jobId }
    startMedia: (body) => req('POST', '/api/faceless/media', body),
    pollMedia: (jobId) => req('GET', `/api/faceless/media/${jobId}`),
    // body: { query, aspect } → { clips }
    searchBroll: (body) => req('POST', '/api/faceless/broll/search', body),
    // body: { voiceover_url, duration, words, timeline, aspect, caption, music }
    startRender: (body) => req('POST', '/api/faceless/render', body),
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
    formatCredits,
    quotaFor,
    // True when the user has an active paid plan with quota remaining.
    canClip: async () => {
      try {
        const me = await req('GET', '/api/user/me')
        return me.plan_status === 'active' && (me.videos_remaining ?? 0) > 0
      } catch { return false }
    },
  },
}

export { getToken, setSession, clearSession, WHOP_CHECKOUT, PLAN_QUOTAS }
