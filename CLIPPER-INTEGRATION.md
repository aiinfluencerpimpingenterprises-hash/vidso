# Clipper Discover — Integration Guide

Copy-paste guide for integrating the Clipzo “Sendclip-style” clipper landing into another site:

1. **Find clips** CTA (load URL + AI viral analysis)
2. **Content type** dropdown (steers AI genre)
3. **Browse popular videos** (curated grid + categories)
4. **Live YouTube search** in the search bar
5. Backend pieces that make YouTube fetch/search work

Auth stays normal — users must be signed in; all download/search routes use `requireAuth` (Bearer token).

**File location (this repo):** `c:\Users\91821\viblo-landing\CLIPPER-INTEGRATION.md`

---

## Architecture

```
Frontend (your site) — user must be logged in
  ├─ Paste URL / pick video / search
  ├─ POST /api/download/info      → title, thumb, duration
  ├─ POST /api/download/search    → YouTube search results
  └─ POST /api/download/analyze   → start viral-moment job
        └─ GET  /api/autoclip/:id → poll clips

Backend (Node/Express + yt-dlp)
  ├─ requireAuth  (JWT required)
  ├─ requirePlan  (where paid features apply)
  └─ yt-dlp for info / search / download
```

**Dependencies (backend):** `express`, `cors`, `dotenv`, `yt-dlp-exec`, `ffmpeg-static`, `@supabase/supabase-js`.

**Env vars that matter:**

| Variable | Required | Purpose |
|----------|----------|---------|
| `YTDLP_COOKIES` | Strongly recommended | Netscape cookies.txt contents — helps YouTube bot checks |
| `YTDLP_PROXY` | Optional | `http://user:pass@host:port` — only if proxy is healthy. A dead proxy = “Failed to fetch” / connection refused |
| `FRONTEND_URL` | Recommended | CORS origin for your site |
| `PORT` | Optional | Default `3001` |

> **Lesson learned:** A broken `YTDLP_PROXY` causes `Connection refused` and looks like “Failed to fetch” in the browser. Delete the var if the proxy dies; cookies alone often work.

---

## 1. Backend — Auth (standard JWT)

### `src/middleware/auth.js`

```js
import { supabase } from '../lib/supabase.js'

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice(7) : req.query.token
  if (!token) {
    return res.status(401).json({ error: 'Missing token' })
  }
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
  req.user = data.user
  next()
}
```

### CORS — allow your frontend origin

```js
app.use(cors({
  origin: [
    process.env.FRONTEND_URL,
    'https://your-site.com',
    'https://www.your-site.com',
    'http://localhost:3000',
    'http://localhost:5173',
  ],
  credentials: true,
}))
```

---

## 2. Backend — YouTube search + info

Assumes you already have `yt-dlp-exec` wired (`baseOpts()`, cookies, optional proxy).

### `POST /api/download/info`

```js
router.post('/info', requireAuth, async (req, res) => {
  const { url } = req.body
  if (!url) return res.status(400).json({ error: 'URL required' })
  try {
    const info = await ytDlp(url, { dumpSingleJson: true, ...baseOpts() })
    res.json({
      title: info.title || '',
      thumbnail: info.thumbnail || '',
      duration: info.duration || 0,
      uploader: info.uploader || info.channel || '',
      platform: info.extractor_key || info.extractor || '',
    })
  } catch (err) {
    console.error('ytdlp info error:', err.message)
    res.status(400).json({ error: friendlyError(err) })
  }
})
```

### `POST /api/download/search` (new)

```js
// YouTube search for the clipper discover grid (yt-dlp ytsearch).
router.post('/search', requireAuth, async (req, res) => {
  const q = String(req.body?.q || '').trim()
  if (!q) return res.status(400).json({ error: 'Search query required' })
  if (q.length > 120) return res.status(400).json({ error: 'Search query too long' })
  const limit = Math.min(18, Math.max(1, parseInt(req.body?.limit, 10) || 12))
  try {
    const info = await ytDlp(`ytsearch${limit}:${q}`, {
      dumpSingleJson: true,
      flatPlaylist: true,
      ...baseOpts(),
    })
    const videos = (info?.entries || [])
      .filter((e) => e && (e.id || e.url))
      .map((e) => {
        const id = e.id || String(e.url || '').match(/[?&]v=([\w-]{11})/)?.[1] || ''
        return {
          id,
          title: e.title || 'Untitled',
          channel: e.channel || e.uploader || e.uploader_id || '',
          thumbnail: e.thumbnail || (id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : ''),
          duration: e.duration || 0,
          url: id ? `https://www.youtube.com/watch?v=${id}` : (e.url || e.webpage_url || ''),
        }
      })
      .filter((v) => v.id)
    res.json({ videos })
  } catch (err) {
    console.error('ytdlp search error:', err.message)
    res.status(400).json({ error: friendlyError(err) || 'Search failed' })
  }
})
```

### Shared yt-dlp options (reference)

```js
function baseOpts() {
  return {
    noPlaylist: true,
    noCheckCertificates: true,
    extractorArgs: 'youtube:player_client=default,tv,web_embedded,android_vr',
    ...(cookiesFile ? { cookies: cookiesFile } : {}),
    ...(proxyUrl ? { proxy: proxyUrl } : {}),
  }
}
```

Mount the router:

```js
app.use('/api/download', downloadRouter)
```

### Quick API tests (with a real JWT)

```bash
# Health
curl -s https://YOUR-API.up.railway.app/health

# Video info
curl -s -X POST https://YOUR-API.up.railway.app/api/download/info \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.youtube.com/watch?v=DXVHmGoCTco"}'

# Search
curl -s -X POST https://YOUR-API.up.railway.app/api/download/search \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{"q":"mrbeast","limit":6}'
```

---

## 3. Frontend API client

Point `BASE` at your backend. Send the user’s JWT on every call. Add `search` next to `info` / `analyze`.

```js
const BASE = 'https://YOUR-API.up.railway.app'

function getToken() { return localStorage.getItem('clipzo_token') }

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
    throw new Error('Cannot reach API — the backend may be down. Try again in a minute.')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.message || data.error || 'Request failed')
    err.status = res.status
    err.code = data.error
    err.needsPlan = res.status === 402
    throw err
  }
  return data
}

export const api = {
  download: {
    info:    (url) => req('POST', '/api/download/info', { url }),
    search:  (q, limit) => req('POST', '/api/download/search', { q, limit }),
    analyze: (url) => req('POST', '/api/download/analyze', { url }),
  },
  autoclip: {
    poll: (jobId, count, genre) =>
      req('GET', `/api/autoclip/${jobId}?count=${count || 5}${genre ? `&genre=${encodeURIComponent(genre)}` : ''}`),
  },
}
```

Keep your existing login/signup flow. Do **not** open the clipper without a valid session — `/info` and `/search` return `401` without a token.

---

## 4. Frontend — CSS (discover UI)

Use your brand CSS variables (`--surface`, `--border`, `--a2`, `--muted`, `--ink`). Red accent example:

```css
/* Clipper discover (Sendclip-style browse) */
.clip-hero{margin-bottom:22px}
.clip-hero-row{display:flex;align-items:center;gap:10px;background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:8px 8px 8px 14px}
.clip-hero-row:focus-within{border-color:rgba(255,0,51,.45)}
.clip-hero-icon{flex-shrink:0;display:flex;align-items:center;justify-content:center;opacity:.9}
.clip-hero-input{flex:1;min-width:0;background:none;border:none;color:#fff;font-size:.95rem;padding:10px 8px;outline:none}
.clip-hero-input::placeholder{color:var(--muted)}
.clip-hero-btn{flex-shrink:0;display:inline-flex;align-items:center;gap:8px;white-space:nowrap}
.clip-ctype{display:flex;align-items:center;gap:10px;margin-top:12px;flex-wrap:wrap;font-size:.78rem;color:var(--muted)}
.clip-ctype label{font-weight:600;color:var(--ink)}
.clip-ctype select{background:var(--surface);border:1px solid var(--border);border-radius:8px;color:#fff;font-size:.8rem;font-weight:600;padding:7px 10px;outline:none;cursor:pointer}
.clip-ctype select:focus{border-color:var(--a2)}
.clip-discover{margin-top:8px;padding-top:20px;border-top:1px solid var(--border)}
.clip-discover-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:14px}
.clip-discover-title{font-size:.95rem;font-weight:700;color:#fff}
.clip-discover-sub{font-size:.78rem;color:var(--muted);margin-top:3px}
.clip-discover-search{display:flex;align-items:center;gap:8px;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:8px 12px;min-width:220px;flex:1;max-width:320px}
.clip-discover-search svg{flex-shrink:0;opacity:.55}
.clip-discover-search input{flex:1;min-width:0;background:none;border:none;color:#fff;font-size:.82rem;outline:none}
.clip-discover-search input::placeholder{color:var(--muted)}
.clip-discover-tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}
.clip-tab{border:1px solid var(--border);background:var(--surface);color:var(--muted);border-radius:999px;padding:7px 14px;font-size:.78rem;font-weight:600;cursor:pointer;transition:all .15s}
.clip-tab:hover{color:#fff;border-color:rgba(255,0,51,.4)}
.clip-tab.active{background:rgba(255,0,51,.15);border-color:var(--a2);color:#fff}
.clip-discover-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
@media(max-width:900px){.clip-discover-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:560px){.clip-discover-grid{grid-template-columns:1fr}.clip-hero-row{flex-wrap:wrap}.clip-hero-btn{width:100%;justify-content:center}}
.clip-pick{position:relative;border:none;background:none;padding:0;cursor:pointer;text-align:left;border-radius:12px;overflow:hidden;display:block;width:100%;transition:transform .15s,box-shadow .15s}
.clip-pick:hover{transform:translateY(-2px);box-shadow:0 10px 28px rgba(0,0,0,.35)}
.clip-pick:hover .clip-pick-overlay{opacity:1}
.clip-pick-thumb{position:relative;aspect-ratio:16/9;background:#1a1a1a;overflow:hidden;border-radius:12px}
.clip-pick-thumb img{width:100%;height:100%;object-fit:cover;display:block}
.clip-pick-overlay{position:absolute;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .15s;color:#fff;font-size:.8rem;font-weight:700;gap:6px}
.clip-pick-meta{display:flex;align-items:flex-start;gap:10px;padding:10px 2px 0}
.clip-pick-avatar{width:28px;height:28px;border-radius:50%;background:var(--a2);color:#fff;font-size:.65rem;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.clip-pick-title{font-size:.82rem;font-weight:700;color:#fff;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.clip-pick-channel{font-size:.7rem;color:var(--muted);margin-top:2px}
.clip-discover-empty{grid-column:1/-1;padding:28px;text-align:center;color:var(--muted);font-size:.85rem;background:var(--surface);border:1px dashed var(--border);border-radius:12px}
```

---

## 5. Frontend — HTML (loader section)

Drop this into your clipper panel (inside `#clip-loader` or equivalent):

```html
<div id="clip-loader">
  <div class="clip-hero">
    <div class="clip-hero-row">
      <span class="clip-hero-icon" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M22.5 6.5s-.2-1.5-.9-2.1c-.8-.9-1.7-.9-2.1-1C16.7 3 12 3 12 3h0s-4.7 0-7.5.4c-.4.1-1.3.1-2.1 1-.7.6-.9 2.1-.9 2.1S1.2 8.3 1.2 10v1.9c0 1.8.3 3.5.3 3.5s.2 1.5.9 2.1c.8.9 1.9.8 2.3.9 1.7.2 7.3.4 7.3.4s4.7 0 7.5-.4c.4-.1 1.3-.1 2.1-1 .7-.6.9-2.1.9-2.1s.3-1.8.3-3.5V10c0-1.7-.3-3.5-.3-3.5z" fill="#FF0033"/>
          <path d="M10 14.6l5.2-3-5.2-3v6z" fill="#fff"/>
        </svg>
      </span>
      <input type="text" id="clip-url" class="clip-hero-input"
        placeholder="Paste a video link — YouTube, TikTok, Instagram, X..."
        onkeydown="if(event.key==='Enter')findClipsFromUrl()"/>
      <button class="btn btn-primary clip-hero-btn" id="clip-url-btn" onclick="findClipsFromUrl()">
        Find clips
      </button>
    </div>
    <div class="clip-ctype">
      <label for="clip-content-type">Content type</label>
      <select id="clip-content-type" onchange="setClipContentType(this.value)">
        <option value="auto">Auto-detect</option>
        <option value="entertainment">Entertainment</option>
        <option value="sports">Sport</option>
        <option value="podcast">Podcast</option>
        <option value="gaming">Gaming</option>
        <option value="vlog">Vlog</option>
        <option value="commentary">Commentary</option>
        <option value="interview">Interview</option>
        <option value="educational">Educational</option>
        <option value="motivational">Motivational</option>
        <option value="other">Other</option>
      </select>
      <span>— helps the AI find better moments.</span>
    </div>
    <div class="status" id="clip-url-status" style="display:none;margin-top:10px"></div>
  </div>

  <div class="clip-discover" id="clip-discover">
    <div class="clip-discover-head">
      <div>
        <div class="clip-discover-title">Or start from a video</div>
        <div class="clip-discover-sub">Pick a popular video to clip.</div>
      </div>
      <div class="clip-discover-search">
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/>
        </svg>
        <input type="text" id="clip-discover-q" placeholder="Search a video..."
          oninput="onClipDiscoverSearch()"
          onkeydown="if(event.key==='Enter'){event.preventDefault();searchClipDiscover(true)}"/>
      </div>
    </div>
    <div class="clip-discover-tabs" id="clip-discover-tabs">
      <button type="button" class="clip-tab active" data-cat="recommended" onclick="setClipDiscoverCat('recommended',this)">Recommended</button>
      <button type="button" class="clip-tab" data-cat="entertainment" onclick="setClipDiscoverCat('entertainment',this)">Entertainment</button>
      <button type="button" class="clip-tab" data-cat="sport" onclick="setClipDiscoverCat('sport',this)">Sport</button>
      <button type="button" class="clip-tab" data-cat="podcasts" onclick="setClipDiscoverCat('podcasts',this)">Podcasts</button>
    </div>
    <div class="clip-discover-grid" id="clip-discover-grid"></div>
  </div>
</div>

<button type="button" class="btn btn-ghost btn-sm" onclick="resetClipper()">Change video</button>
```

---

## 6. Frontend — JavaScript (Find clips + discover + search)

Assumes you already have:

- `api` imported / on `window` (with auth token)
- `setStatus(id, msg, type)`
- `clipFindViral()` (starts analyze + polls autoclip)
- `cvGenre` (string genre key passed to autoclip poll)
- Clip editor helpers and state vars

### Load URL + Find clips

```js
window.loadClipFromUrl = async () => {
  const url = document.getElementById('clip-url').value.trim()
  if (!url) { setStatus('clip-url-status', 'Paste a video link first', 'err'); return false }
  const btn = document.getElementById('clip-url-btn')
  btn.disabled = true
  setStatus('clip-url-status', 'Reading video info…', 'loading')
  try {
    const info = await api.download.info(url)
    if (!info?.duration) throw new Error('Could not read this video. Make sure it is public.')
    clipMode = 'url'
    clipSourceUrl = url
    clipDuration = info.duration
    clipInPoint = 0
    clipOutPoint = Math.min(info.duration, 60)
    // Show editor UI, hide loader, show thumbnail from info.thumbnail …
    document.getElementById('clip-editor').style.display = ''
    document.getElementById('clip-loader').style.display = 'none'
    document.getElementById('clip-viral-section').style.display = ''
    btn.disabled = false
    return true
  } catch (e) {
    setStatus('clip-url-status', e.message || 'Could not load video', 'err')
    btn.disabled = false
    return false
  }
}

window.findClipsFromUrl = async () => {
  const sel = document.getElementById('clip-content-type')
  if (sel) setClipContentType(sel.value)
  const ok = await loadClipFromUrl()
  if (ok) clipFindViral()
}

window.setClipContentType = (g) => {
  cvGenre = g || 'auto'
  const sel = document.getElementById('clip-content-type')
  if (sel && sel.value !== cvGenre) sel.value = cvGenre
}
```

### Curated catalog + live search

```js
const CLIP_DISCOVER = [
  { id: 'DXVHmGoCTco', title: '50 Streamers Fight for $1,000,000', channel: 'MrBeast', cats: ['recommended', 'entertainment'] },
  { id: 'MmGzzlRNjFA', title: 'MAKE US LAUGH, WIN $1,000 (ft. Deji)', channel: 'KSI', cats: ['recommended', 'entertainment'] },
  { id: '5hTAg2ThHAo', title: 'I Spent 30 Days Exploring All Of Africa!', channel: 'IShowSpeed', cats: ['recommended', 'entertainment'] },
  { id: 'asioCrI0MfY', title: 'Sidemen Charity Match 2023', channel: 'Sidemen', cats: ['recommended', 'sport'] },
  { id: 'UF8uR6Z6KLc', title: "Steve Jobs' 2005 Stanford Commencement Address", channel: 'Stanford', cats: ['recommended', 'podcasts'] },
  { id: 'T4CID6Qvq8E', title: 'Joe Rogan Experience #1169 — Elon Musk', channel: 'PowerfulJRE', cats: ['recommended', 'podcasts'] },
  // Add more { id, title, channel, cats: [...] } as needed
]

let clipDiscoverCat = 'recommended'
let clipDiscoverSearchTimer = null
let clipDiscoverSearchSeq = 0
let clipDiscoverResults = null // null = curated; array = YouTube search results

window.setClipDiscoverCat = (cat, btn) => {
  clipDiscoverCat = cat
  document.querySelectorAll('#clip-discover-tabs .clip-tab').forEach((b) => b.classList.remove('active'))
  btn?.classList.add('active')
  const input = document.getElementById('clip-discover-q')
  if (input) input.value = ''
  clipDiscoverResults = null
  renderClipDiscover()
}

function paintClipDiscoverCards(list) {
  const grid = document.getElementById('clip-discover-grid')
  if (!grid) return
  if (!list.length) {
    grid.innerHTML = '<div class="clip-discover-empty">No videos found. Try another keyword or paste a link above.</div>'
    return
  }
  grid.innerHTML = list.slice(0, 12).map((v) => {
    const thumb = v.thumbnail || `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`
    const initial = (v.channel || '?').trim().charAt(0).toUpperCase()
    const safeTitle = String(v.title || '').replace(/"/g, '&quot;')
    const safeId = String(v.id || '').replace(/'/g, '')
    return `<button type="button" class="clip-pick" onclick="pickClipDiscover('${safeId}')" title="${safeTitle}">
      <div class="clip-pick-thumb">
        <img src="${thumb}" alt="" loading="lazy" referrerpolicy="no-referrer"/>
        <div class="clip-pick-overlay">Find clips</div>
      </div>
      <div class="clip-pick-meta">
        <div class="clip-pick-avatar">${initial}</div>
        <div>
          <div class="clip-pick-title">${String(v.title || '').replace(/</g, '&lt;')}</div>
          <div class="clip-pick-channel">${String(v.channel || '').replace(/</g, '&lt;')}</div>
        </div>
      </div>
    </button>`
  }).join('')
}

window.renderClipDiscover = () => {
  if (clipDiscoverResults) {
    paintClipDiscoverCards(clipDiscoverResults)
    return
  }
  const seen = new Set()
  const list = CLIP_DISCOVER.filter((v) => {
    if (seen.has(v.id)) return false
    seen.add(v.id)
    return v.cats.includes(clipDiscoverCat)
  })
  paintClipDiscoverCards(list)
}

window.onClipDiscoverSearch = () => {
  clearTimeout(clipDiscoverSearchTimer)
  const q = (document.getElementById('clip-discover-q')?.value || '').trim()
  if (!q) {
    clipDiscoverResults = null
    renderClipDiscover()
    return
  }
  clipDiscoverSearchTimer = setTimeout(() => searchClipDiscover(false), 450)
}

window.searchClipDiscover = async () => {
  clearTimeout(clipDiscoverSearchTimer)
  const q = (document.getElementById('clip-discover-q')?.value || '').trim()
  const grid = document.getElementById('clip-discover-grid')
  if (!q) {
    clipDiscoverResults = null
    renderClipDiscover()
    return
  }
  if (!grid) return
  const seq = ++clipDiscoverSearchSeq
  grid.innerHTML = '<div class="clip-discover-empty">Searching YouTube…</div>'
  try {
    const { videos } = await api.download.search(q, 12)
    if (seq !== clipDiscoverSearchSeq) return
    clipDiscoverResults = videos || []
    paintClipDiscoverCards(clipDiscoverResults)
  } catch (e) {
    if (seq !== clipDiscoverSearchSeq) return
    grid.innerHTML = `<div class="clip-discover-empty">${(e.message || 'Search failed').replace(/</g, '&lt;')}</div>`
  }
}

window.pickClipDiscover = (id) => {
  document.getElementById('clip-url').value = `https://www.youtube.com/watch?v=${id}`
  const sel = document.getElementById('clip-content-type')
  if (sel && (!sel.value || sel.value === 'auto')) {
    if (clipDiscoverCat === 'sport') sel.value = 'sports'
    else if (clipDiscoverCat === 'podcasts') sel.value = 'podcast'
    else if (clipDiscoverCat === 'entertainment') sel.value = 'entertainment'
  }
  findClipsFromUrl()
}

window.resetClipper = () => {
  document.getElementById('clip-editor').style.display = 'none'
  document.getElementById('clip-loader').style.display = ''
}

;(function initClipDiscover() { renderClipDiscover() })()
```

### Viral analysis flow (must already exist or be ported)

```js
window.clipFindViral = async () => {
  if (!clipSourceUrl) return
  const { jobId } = await api.download.analyze(clipSourceUrl)
  // Poll: api.autoclip.poll(jobId, count, cvGenre)
  // until status === 'completed', then render clips
}
```

Genre values for `cvGenre` / content type should match your backend `GENRE_HINTS` map (e.g. `auto`, `podcast`, `sports`, `entertainment`, …).

---

## 7. Deploy checklist

1. Deploy backend with `yt-dlp-exec` + `ffmpeg-static` (Linux host).
2. Set env:
   ```bash
   FRONTEND_URL=https://your-site.com
   YTDLP_COOKIES=<netscape cookies.txt contents>
   # Only if proxy is healthy:
   # YTDLP_PROXY=http://user:pass@host:port
   ```
3. If YouTube fails with `Connection refused`, **delete** `YTDLP_PROXY` and redeploy.
4. Point frontend `BASE` at the API URL.
5. Confirm CORS includes your frontend origin.
6. Users must sign in — API calls need `Authorization: Bearer <jwt>`.

### Railway CLI (reference)

```bash
cd your-backend
railway link -p YOUR_PROJECT -e production -s YOUR_SERVICE
railway variable delete YTDLP_PROXY   # if proxy is dead
railway up -d -y -s YOUR_SERVICE
```

---

## 8. Integration checklist

- [ ] Backend: `POST /api/download/info` (auth required)
- [ ] Backend: `POST /api/download/search` (auth required)
- [ ] Backend: analyze + autoclip poll (existing viral pipeline)
- [ ] Backend: healthy cookies; no dead proxy
- [ ] Frontend: `api.download.search` (sends JWT)
- [ ] Frontend: keep normal login/signup gate
- [ ] Frontend: CSS + HTML loader/discover
- [ ] Frontend: `findClipsFromUrl` → load + `clipFindViral`
- [ ] Frontend: debounced YouTube search (~450ms)
- [ ] CORS + `BASE` URL point at live API

---

## 9. Files touched in Clipzo (for reference)

| Area | Path |
|------|------|
| Frontend dashboard | `dashboard.html` (CSS, HTML, JS) |
| Frontend API client | `api.js` |
| Backend download/search | `clipzo-backend/src/routes/download.js` |
| This guide | `CLIPPER-INTEGRATION.md` |
