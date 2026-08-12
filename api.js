const BASE = 'https://vibrant-patience-production-a7f0.up.railway.app'

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
  starter_monthly:  'https://whop.com/checkout/plan_Qk5UKuHDvvjq4', // $29.99/mo
  starter_yearly:   'https://whop.com/checkout/plan_H6ZitU3lkTM8g', // $149.99/yr
  creator_monthly:  'https://whop.com/checkout/plan_gghoT9UzJUjIJ', // $49.99/mo
  creator_yearly:   'https://whop.com/checkout/plan_ePC34XsWeqHFB', // $294.99/yr
  business_monthly: 'https://whop.com/checkout/plan_tzNBvuv4dEl9e', // $99.99/mo
  business_yearly:  'https://whop.com/checkout/plan_lwshiUS61ibEa', // $594.99/yr
}

export const api = {
  auth: {
    signup:  (email, password, name) => req('POST', '/api/auth/signup',  { email, password, name }),
    login:   (email, password)       => req('POST', '/api/auth/login',   { email, password }),
    logout:  ()                      => req('POST', '/api/auth/logout'),
    refresh: (refresh_token)         => req('POST', '/api/auth/refresh', { refresh_token }),
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
    checkoutUrl: (tier, interval) => WHOP_CHECKOUT[`${tier}_${interval}`] || WHOP_CHECKOUT.creator_monthly,
    // True when the user has an active paid plan with quota remaining.
    canClip: async () => {
      try {
        const me = await req('GET', '/api/user/me')
        return me.plan_status === 'active' && (me.videos_remaining ?? 0) > 0
      } catch { return false }
    },
  },
}

export { getToken, setSession, clearSession, WHOP_CHECKOUT }
