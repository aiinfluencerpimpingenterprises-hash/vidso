/**
 * A small custom audio player for narration (replaces the browser's grey <audio controls>).
 *
 * One shared Audio per URL lives here, outside the page markup, so the chat can
 * re-render as often as it likes without stopping playback. Every player on the
 * page for that URL shows the same state. Clicks are handled once at the document.
 */

const audios = new Map() // url -> HTMLAudioElement
const RATES = [1, 1.25, 1.5, 2]
const BARS = 64

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

export function fmtTime(sec) {
  const s = Math.max(0, Math.floor(Number(sec) || 0))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`
}

/** Bar heights (0.18-1) that look like speech, the same every time for a URL. */
export function waveHeights(url, n = BARS) {
  let h = 2166136261
  for (const ch of String(url || '')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  const rnd = () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296 }
  const out = []
  let prev = 0.5
  for (let i = 0; i < n; i++) {
    // Phrases: louder runs with short dips between them, smoothed so neighbours look related.
    const phrase = 0.55 + 0.35 * Math.sin(i / 3.1 + rnd() * 0.6)
    const v = Math.min(1, Math.max(0.18, prev * 0.45 + (phrase * (0.55 + rnd() * 0.6)) * 0.55))
    out.push(Math.round(v * 100) / 100)
    prev = v
  }
  return out
}

function audioFor(url, create = true) {
  let a = audios.get(url)
  if (!a && create) {
    a = new Audio()
    a.preload = 'metadata'
    a.src = url
    const sync = () => syncAll(url)
    for (const ev of ['play', 'pause', 'ended', 'timeupdate', 'loadedmetadata', 'durationchange', 'ratechange', 'waiting', 'playing', 'error']) a.addEventListener(ev, sync)
    a.addEventListener('ended', () => { a.currentTime = 0; syncAll(url) })
    audios.set(url, a)
  }
  return a
}

function stateOf(url) {
  const a = audioFor(url, false)
  const dur = a && Number.isFinite(a.duration) ? a.duration : 0
  const t = a ? a.currentTime || 0 : 0
  return {
    playing: !!a && !a.paused && !a.ended,
    loading: !!a && !a.paused && a.readyState < 3,
    failed: !!a?.error,
    dur,
    t,
    pct: dur ? Math.min(100, (t / dur) * 100) : 0,
    rate: a ? a.playbackRate : 1,
  }
}

const PLAY = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>'
const PAUSE = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><rect x="6.5" y="5" width="4" height="14" rx="1.2"/><rect x="13.5" y="5" width="4" height="14" rx="1.2"/></svg>'

function timeText(s) {
  if (s.failed) return 'Can’t play this file'
  return s.dur ? `${fmtTime(s.t)} / ${fmtTime(s.dur)}` : (s.t ? fmtTime(s.t) : '0:00')
}

/** The player markup. `label` is read out to screen readers; `title` shows above the wave when given. */
export function audioPlayerHtml(url, { label = 'Narration', title = '' } = {}) {
  if (!url) return ''
  injectStyle()
  bindOnce()
  // Fetch only the length up front so the time reads "0:00 / 3:12" before playing.
  try { audioFor(url) } catch (_) {}
  const s = stateOf(url)
  const bars = waveHeights(url).map((v) => `<i style="height:${Math.round(v * 100)}%"></i>`).join('')
  return `<div class="tp${s.playing ? ' is-playing' : ''}${s.loading ? ' is-loading' : ''}${s.failed ? ' is-failed' : ''}" data-tp="${esc(url)}" style="--tp-pct:${s.pct.toFixed(2)}%">
    <button type="button" class="tp-play" data-tp-play aria-label="${s.playing ? 'Pause' : 'Play'} ${esc(label)}">${s.playing ? PAUSE : PLAY}</button>
    <div class="tp-body">
      ${title ? `<div class="tp-title">${esc(title)}</div>` : ''}
      <div class="tp-wave" data-tp-seek role="slider" tabindex="0" aria-label="Seek ${esc(label)}" aria-valuemin="0" aria-valuemax="${Math.round(s.dur)}" aria-valuenow="${Math.round(s.t)}" aria-valuetext="${esc(timeText(s))}"><div class="tp-bars">${bars}</div><div class="tp-bars tp-fill" aria-hidden="true">${bars}</div></div>
      <div class="tp-meta"><span class="tp-time">${esc(timeText(s))}</span><span class="tp-tools"><button type="button" class="tp-rate" data-tp-rate aria-label="Playback speed">${s.rate}×</button><a class="tp-dl" href="${esc(url)}" download target="_blank" rel="noopener" aria-label="Download ${esc(label)}"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11m0 0 4.5-4.5M12 15l-4.5-4.5M5 19h14"/></svg></a></span></div>
    </div>
  </div>`
}

function playersFor(url) {
  const sel = `.tp[data-tp="${typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(url) : url.replace(/"/g, '\\"')}"]`
  return document.querySelectorAll(sel)
}

function syncAll(url) {
  const s = stateOf(url)
  for (const el of playersFor(url)) {
    el.classList.toggle('is-playing', s.playing)
    el.classList.toggle('is-loading', s.loading)
    el.classList.toggle('is-failed', s.failed)
    el.style.setProperty('--tp-pct', s.pct.toFixed(2) + '%')
    const btn = el.querySelector('.tp-play')
    if (btn) {
      const want = s.playing ? 'Pause' : 'Play'
      if (!btn.getAttribute('aria-label')?.startsWith(want)) {
        btn.innerHTML = s.playing ? PAUSE : PLAY
        btn.setAttribute('aria-label', btn.getAttribute('aria-label').replace(/^(Play|Pause)/, want))
      }
    }
    const time = el.querySelector('.tp-time')
    if (time) time.textContent = timeText(s)
    const wave = el.querySelector('.tp-wave')
    if (wave) {
      wave.setAttribute('aria-valuemax', String(Math.round(s.dur)))
      wave.setAttribute('aria-valuenow', String(Math.round(s.t)))
      wave.setAttribute('aria-valuetext', timeText(s))
    }
    const rate = el.querySelector('.tp-rate')
    if (rate) rate.textContent = s.rate + '×'
  }
}

function toggle(url) {
  const a = audioFor(url)
  if (a.paused) {
    for (const [u, other] of audios) if (u !== url && !other.paused) other.pause()
    a.play().catch(() => syncAll(url))
  } else a.pause()
  syncAll(url)
}

function seekTo(url, frac) {
  const a = audioFor(url)
  const go = () => { if (Number.isFinite(a.duration)) { a.currentTime = Math.max(0, Math.min(1, frac)) * a.duration; syncAll(url) } }
  if (Number.isFinite(a.duration)) go()
  else { a.addEventListener('loadedmetadata', go, { once: true }); a.load() }
}

let bound = false
function bindOnce() {
  if (bound || typeof document === 'undefined') return
  bound = true
  document.addEventListener('click', (e) => {
    const root = e.target.closest?.('.tp[data-tp]')
    if (!root) return
    const url = root.dataset.tp
    if (e.target.closest('[data-tp-play]')) { e.preventDefault(); toggle(url) }
    else if (e.target.closest('[data-tp-rate]')) {
      e.preventDefault()
      const a = audioFor(url)
      a.playbackRate = RATES[(RATES.indexOf(a.playbackRate) + 1) % RATES.length] || 1
      syncAll(url)
    }
  })
  // Click or drag on the wave to seek.
  document.addEventListener('pointerdown', (e) => {
    const wave = e.target.closest?.('.tp [data-tp-seek]')
    if (!wave || e.button !== 0) return
    const url = wave.closest('.tp').dataset.tp
    const at = (x) => { const r = wave.getBoundingClientRect(); return r.width ? (x - r.left) / r.width : 0 }
    e.preventDefault()
    seekTo(url, at(e.clientX))
    const move = (ev) => seekTo(url, at(ev.clientX))
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  })
  document.addEventListener('keydown', (e) => {
    const wave = e.target.closest?.('.tp [data-tp-seek]')
    if (!wave) return
    const a = audioFor(wave.closest('.tp').dataset.tp)
    const step = { ArrowLeft: -5, ArrowRight: 5 }[e.key]
    if (step && Number.isFinite(a.duration)) { e.preventDefault(); a.currentTime = Math.max(0, Math.min(a.duration, a.currentTime + step)) }
    else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(wave.closest('.tp').dataset.tp) }
  })
}

const CSS_TEXT = `
.tp{display:flex;align-items:center;gap:12px;width:100%;padding:10px 12px 10px 10px;border-radius:14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);box-sizing:border-box;font-family:Inter,system-ui,sans-serif}
.ag-card .tp,.ag-ed-voice .tp{padding:4px 0 0;background:none;border:0;border-radius:0}
.tp-play{display:grid;place-items:center;flex:none;width:38px;height:38px;padding:0;border:0;border-radius:50%;background:#ff2d48;color:#fff;cursor:pointer;transition:transform .12s ease,filter .15s}
.tp-play svg{margin-left:2px}
.tp.is-playing .tp-play svg{margin-left:0}
.tp-play:hover{filter:brightness(1.08)}
.tp-play:active{transform:scale(.94)}
.tp-play:focus-visible,.tp-wave:focus-visible,.tp-rate:focus-visible,.tp-dl:focus-visible{outline:2px solid rgba(255,255,255,.8);outline-offset:2px}
.tp.is-loading .tp-play{animation:tp-pulse 1s ease-in-out infinite}
@keyframes tp-pulse{50%{filter:brightness(.8)}}
.tp-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:5px}
.tp-title{font-size:12px;color:rgba(255,255,255,.5);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tp-wave{position:relative;height:28px;cursor:pointer;touch-action:none;border-radius:4px}
.tp-bars{position:absolute;inset:0;display:flex;align-items:center;gap:2px}
.tp-bars i{flex:1;min-width:1px;border-radius:2px;background:rgba(255,255,255,.18)}
.tp-fill{clip-path:inset(0 calc(100% - var(--tp-pct,0%)) 0 0)}
.tp-fill i{background:#ff2d48}
.tp-wave:hover .tp-bars:not(.tp-fill) i{background:rgba(255,255,255,.26)}
.tp-meta{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:11.5px;color:rgba(255,255,255,.45);font-variant-numeric:tabular-nums}
.tp.is-failed .tp-time{color:#ff8a9a}
.tp-tools{display:flex;align-items:center;gap:2px}
.tp-rate,.tp-dl{display:grid;place-items:center;min-width:26px;height:20px;padding:0 5px;border:0;border-radius:6px;background:transparent;color:rgba(255,255,255,.45);font:500 11px Inter,system-ui,sans-serif;cursor:pointer;text-decoration:none}
.tp-rate:hover,.tp-dl:hover{background:rgba(255,255,255,.07);color:#fff}
`

function injectStyle() {
  if (typeof document === 'undefined' || document.getElementById('tp-style')) return
  const s = document.createElement('style')
  s.id = 'tp-style'
  s.textContent = CSS_TEXT
  document.head.appendChild(s)
}
