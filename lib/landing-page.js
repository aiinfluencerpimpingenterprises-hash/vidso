import {
  HERO_CARDS,
  HERO_PROMPTS,
  GENERATE_HREF,
  HERO_VIDEO_SRC,
  HERO_VIDEO_POSTER,
  SHOWCASE_CARDS,
  SHORTS_CARDS,
  SHORTS_PROMPTS,
  VOICEOVER_SCRIPT,
  THUMBNAIL_DEMO_SRC,
  THUMBNAIL_DEMO_POSTER,
  LONGFORM_DEMO_SRC,
  LONGFORM_DEMO_POSTER,
  LONGFORM_DEMO_START,
  HOW_PANEL_SRC,
  HOW_PANEL_POSTER,
  LANDING_ANNOUNCE,
} from './landing-media.js'
import { mountLandingIntegrations } from './landing-integrations.js'
import { mountLandingReveals, checkHeadingCenters } from './landing-reveal.js?v=d1f40'
import { mountLandingToolsMenu } from './landing-tools-menu.js'
import { mountLandingFooter } from './landing-footer.js'
import {
  HERO_PROMPT_MODES,
  featuredModels,
  modelSlug,
  modelTileSrc,
} from './vidso-models.js'

const MUTE_SVG = '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M22 9l-6 6M16 9l6 6"/></svg>'
const UNMUTE_SVG = '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13"/></svg>'

const IDEA_ICONS = {
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>',
  film: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M7 4v16M17 4v16M2 12h20"/></svg>',
  cam: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>',
  rank: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 21V10M16 21V3M12 21v-6"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3-3"/></svg>',
  atom: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="2"/><ellipse cx="12" cy="12" rx="9" ry="4"/><ellipse cx="12" cy="12" rx="9" ry="4" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9" ry="4" transform="rotate(120 12 12)"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 19V5M4 19h16"/><path d="M8 15l4-5 3 3 5-7"/></svg>',
}

function reduceMotion() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch (_) { return false }
}
function isTouch() {
  try { return window.matchMedia('(hover: none), (pointer: coarse)').matches } catch (_) { return false }
}

let userHasInteracted = false
let audioOwner = null
let demoUserPaused = false

function markInteracted() {
  userHasInteracted = true
  try { window.VidsoMediaAudio && window.VidsoMediaAudio.prime() } catch (_) {}
}

function safePlay(v) {
  if (!v) return
  try {
    const p = v.play()
    if (p && typeof p.catch === 'function') p.catch(function () {})
  } catch (_) {}
}

function ensureSrc(video, src) {
  if (!video || !src) return
  if (video.getAttribute('src') === src) return
  video.setAttribute('src', src)
  video.load()
}

function pauseReset(video) {
  if (!video) return
  video.pause()
  try { video.currentTime = 0 } catch (_) {}
  video.muted = true
  if (audioOwner === video) audioOwner = null
  const btn = video.closest('.shorts-card, .cover-card, .demo-frame')?.querySelector('[data-mute]')
  if (btn) syncMuteBtn(btn, video)
}

function syncMuteBtn(btn, video) {
  if (!btn || !video) return
  const on = !video.muted
  btn.innerHTML = on ? UNMUTE_SVG : MUTE_SVG
  btn.setAttribute('aria-label', on ? 'Mute' : 'Unmute')
}

function playHover(video, src) {
  if (!video || !src) return
  ensureSrc(video, src)
  if (userHasInteracted) {
    if (audioOwner && audioOwner !== video) {
      audioOwner.muted = true
      const otherBtn = audioOwner.closest('.shorts-card, .cover-card, .demo-frame')?.querySelector('[data-mute]')
      if (otherBtn) syncMuteBtn(otherBtn, audioOwner)
      audioOwner.pause()
    }
    video.muted = false
    audioOwner = video
  } else {
    video.muted = true
  }
  safePlay(video)
  const btn = video.closest('.shorts-card, .cover-card, .demo-frame')?.querySelector('[data-mute]')
  if (btn) syncMuteBtn(btn, video)
}

function featMockHtml() {
  return `<div class="feat-mock" aria-hidden="true">
    <span class="feat-mock-glow"></span>
    <span class="feat-mock-bar"></span>
    <span class="feat-mock-line w80"></span>
    <span class="feat-mock-line w60"></span>
    <span class="feat-mock-line w70"></span>
    <span class="feat-mock-tile"></span>
  </div>`
}

function muteBtn() {
  return `<button type="button" class="mute-fab" data-mute aria-label="Unmute">${MUTE_SVG}</button>`
}

function bindMute(root, video) {
  const btn = root.querySelector('[data-mute]')
  if (!btn || !video) return
  btn.addEventListener('click', (e) => {
    e.stopPropagation()
    e.preventDefault()
    markInteracted()
    if (video.muted) {
      if (audioOwner && audioOwner !== video) {
        audioOwner.muted = true
        const otherBtn = audioOwner.closest('.shorts-card, .cover-card, .demo-frame')?.querySelector('[data-mute]')
        if (otherBtn) syncMuteBtn(otherBtn, audioOwner)
      }
      video.muted = false
      audioOwner = video
      safePlay(video)
    } else {
      video.muted = true
      if (audioOwner === video) audioOwner = null
    }
    syncMuteBtn(btn, video)
  })
}

function lazyAutoplay(video, src, opts) {
  if (!video || !src) return
  const skip = opts && typeof opts.shouldPlay === 'function' ? opts.shouldPlay : () => true
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) {
        if (!skip()) return
        ensureSrc(video, src)
        video.muted = true
        safePlay(video)
      } else {
        video.pause()
        if (audioOwner === video) {
          video.muted = true
          audioOwner = null
        }
      }
    })
  }, { rootMargin: '120px', threshold: 0.15 })
  io.observe(video)
}

function probeUrl(url) {
  if (!url) return Promise.resolve(false)
  return fetch(url, { method: 'GET', mode: 'cors', headers: { Range: 'bytes=0-0' } })
    .then((r) => r.ok || r.status === 206)
    .catch(() => false)
}

function fadeMedia(el) {
  if (!el) return
  el.style.opacity = '0'
  el.style.transition = 'opacity .35s ease'
  requestAnimationFrame(() => { el.style.opacity = '1' })
}

function attachOptionalMedia(host, poster, src, opts) {
  if (!host) return
  const wantVideo = !!(src && !isImageSrc(src) && opts && opts.video)
  const afterIdle = (fn) => {
    if (typeof requestIdleCallback === 'function') requestIdleCallback(fn, { timeout: 2500 })
    else setTimeout(fn, 200)
  }
  afterIdle(() => {
    probeUrl(poster).then((okPoster) => {
      if (okPoster) {
        const img = document.createElement('img')
        img.alt = ''
        img.decoding = 'async'
        if (opts && opts.lazy) img.loading = 'lazy'
        img.src = poster
        img.width = opts && opts.width ? opts.width : 320
        img.height = opts && opts.height ? opts.height : 180
        host.appendChild(img)
        host.classList.remove('is-blank')
        host.closest('.hero-card, .hero-mq-card, .top-models-tile, .models-mega-promo')?.classList.remove('is-blank')
        fadeMedia(img)
      }
      if (!wantVideo) return
      if (!opts.forceVideo && (isTouch() || window.matchMedia('(max-width: 820px)').matches)) return
      const tryVideo = () => {
        probeUrl(src).then((okVid) => {
          if (!okVid) return
          if (host.querySelector('video')) return
          const v = document.createElement('video')
          v.muted = true
          v.loop = true
          v.playsInline = true
          v.preload = 'metadata'
          v.setAttribute('src', src)
          host.appendChild(v)
          host.classList.remove('is-blank')
          host.closest('.hero-card, .hero-mq-card, .top-models-tile, .models-mega-promo')?.classList.remove('is-blank')
          fadeMedia(v)
          lazyAutoplay(v, src)
        })
      }
      if (okPoster) afterIdle(tryVideo)
      else tryVideo()
    })
  })
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n))
}
function isImageSrc(src) {
  return /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(src || '')
}

function createHref(modeId) {
  const mode = HERO_PROMPT_MODES.find((m) => m.id === modeId) || HERO_PROMPT_MODES[0]
  return mode.href
}

function heroModeHref(modeId, idea) {
  const mode = HERO_PROMPT_MODES.find((m) => m.id === modeId) || HERO_PROMPT_MODES[0]
  const params = new URLSearchParams()
  if (mode.id === 'thumbnail') {
    if (idea) params.set('prompt', idea)
    const q = params.toString()
    return mode.href + (q ? '?' + q : '')
  }
  if (idea) params.set('idea', idea)
  if (mode.format) params.set('format', mode.format)
  const q = params.toString()
  return mode.href + (q ? '?' + q : '')
}

function cardHtml(c, key) {
  const kind = c.type === 'short' ? 'short' : 'long'
  return `<article class="hero-mq-card is-${kind} is-blank" data-key="${key}" data-video="${c.src || ''}" data-poster="${c.poster || ''}" tabindex="0" aria-label="${c.label}">
    <div class="hero-mq-shot is-blank"></div>
    <span class="hero-mq-lab">${c.label}</span>
  </article>`
}

function bindHeroCard(el) {
  const host = el.querySelector('.hero-mq-shot')
  const poster = el.getAttribute('data-poster')
  const src = el.getAttribute('data-video')
  attachOptionalMedia(host, poster, src, {
    video: !reduceMotion(),
    forceVideo: true,
    lazy: true,
    width: el.classList.contains('is-short') ? 120 : 360,
    height: 200,
  })
  el.addEventListener('pointerenter', () => {
    const v = host.querySelector('video')
    if (v && src) playHover(v, src)
  })
  el.addEventListener('pointerleave', () => {
    const v = host.querySelector('video')
    if (v) {
      v.muted = true
      if (audioOwner === v) audioOwner = null
    }
  })
}

function mountHero() {
  const track = document.getElementById('hero-marquee-track')
  if (!track) return
  track.innerHTML = HERO_CARDS.map((c, i) => cardHtml(c, 'a' + i)).join('') + HERO_CARDS.map((c, i) => cardHtml(c, 'b' + i)).join('')
  track.querySelectorAll('.hero-mq-card').forEach(bindHeroCard)
  if (reduceMotion()) document.getElementById('hero-marquee')?.classList.add('is-static')
}

function mountHeroPrompt() {
  const form = document.getElementById('hero-prompt')
  const input = document.getElementById('hero-prompt-input')
  const ph = document.getElementById('hero-prompt-ph')
  const modeEl = document.getElementById('hero-prompt-mode')
  if (modeEl && !modeEl.options.length) {
    modeEl.innerHTML = HERO_PROMPT_MODES.map((m) => `<option value="${m.id}">${m.label}</option>`).join('')
  }
  if (!form || !input) return
  let i = 0
  let pos = 0
  let dir = 1
  let stopped = false
  let timer = 0
  const ideas = HERO_PROMPTS
  function currentIdea() {
    return ideas[i] || ideas[0]
  }
  function paint() {
    if (ph) ph.textContent = currentIdea().slice(0, pos)
  }
  function stopType() {
    stopped = true
    if (timer) clearTimeout(timer)
    if (ph) ph.hidden = true
    if (!input.value) input.placeholder = currentIdea()
  }
  function tick() {
    if (stopped || reduceMotion()) return
    const s = currentIdea()
    if (dir === 1) {
      pos += 1
      if (pos >= s.length) {
        pos = s.length
        paint()
        dir = -1
        timer = setTimeout(tick, 1600)
        return
      }
      paint()
    } else {
      pos -= 1
      if (pos <= 0) {
        pos = 0
        paint()
        dir = 1
        i = (i + 1) % ideas.length
      }
    }
    paint()
    timer = setTimeout(tick, dir === 1 ? 42 : 22)
  }
  if (reduceMotion()) {
    if (ph) ph.textContent = ideas[0]
    input.placeholder = ideas[0]
  } else {
    tick()
  }
  input.addEventListener('focus', stopType)
  input.addEventListener('pointerdown', stopType)
  form.addEventListener('submit', (e) => {
    e.preventDefault()
    const idea = String(input.value || '').trim()
    const modeId = modeEl?.value || 'long'
    try {
      if (idea) sessionStorage.setItem('vidso_guest_topic', idea)
    } catch (_) {}
    location.href = heroModeHref(modeId, idea)
  })
}

function mountHeroTrust() {
  const row = document.getElementById('hero-trust-avs')
  const files = [...new Set(window.VIDSO_TRUSTED_CREATOR_FILES || [])].slice(0, 5)
  const base = window.VIDSO_R2_BASE || ''
  if (!row || !base || !files.length) return
  row.innerHTML = files.map((f, i) =>
    `<img src="${base}/${f}" alt="" width="28" height="28" loading="${i < 5 ? 'eager' : 'lazy'}" decoding="async">`
  ).join('')
}

function fmtTime(s) {
  if (!isFinite(s) || s < 0) s = 0
  s = Math.floor(s)
  const m = Math.floor(s / 60)
  const r = s % 60
  return m + ':' + (r < 10 ? '0' : '') + r
}

function mountDemo() {
  const frame = document.getElementById('demo-frame')
  const video = document.getElementById('demo-video')
  if (!frame || !video) return
  video.poster = HERO_VIDEO_POSTER
  video.setAttribute('preload', 'none')
  video.style.filter = 'none'
  frame.setAttribute('tabindex', '0')
  lazyAutoplay(video, HERO_VIDEO_SRC, { shouldPlay: () => !demoUserPaused })
  if (isTouch()) frame.classList.add('is-touch')

  const cur = document.getElementById('demo-cur')
  const dur = document.getElementById('demo-dur')
  const rangeEl = document.getElementById('demo-range')
  const pauseBtn = document.getElementById('demo-pause')
  const backBtn = document.getElementById('demo-back')
  const fwdBtn = document.getElementById('demo-fwd')
  let seeking = false

  function paint() {
    const d = video.duration || 0
    const c = video.currentTime || 0
    if (cur) cur.textContent = fmtTime(c)
    if (dur) dur.textContent = fmtTime(d)
    if (rangeEl && d) {
      const pct = (c / d) * 100
      if (!seeking) rangeEl.value = String(pct)
      rangeEl.style.background = 'linear-gradient(90deg,var(--a1) ' + pct + '%,rgba(255,255,255,.22) ' + pct + '%)'
    }
    if (pauseBtn) {
      pauseBtn.classList.toggle('is-paused', video.paused)
      pauseBtn.setAttribute('aria-label', video.paused ? 'Play video' : 'Pause video')
    }
  }

  function togglePlay() {
    if (video.paused) {
      demoUserPaused = false
      safePlay(video)
    } else {
      demoUserPaused = true
      video.pause()
    }
  }

  video.addEventListener('timeupdate', paint)
  video.addEventListener('loadedmetadata', paint)
  video.addEventListener('play', paint)
  video.addEventListener('pause', paint)
  pauseBtn?.addEventListener('click', (e) => {
    e.stopPropagation()
    e.preventDefault()
    togglePlay()
  })
  backBtn?.addEventListener('click', (e) => {
    e.stopPropagation()
    video.currentTime = Math.max(0, video.currentTime - 10)
  })
  fwdBtn?.addEventListener('click', (e) => {
    e.stopPropagation()
    video.currentTime = Math.min(video.duration || 0, video.currentTime + 10)
  })
  rangeEl?.addEventListener('pointerdown', (e) => { e.stopPropagation(); seeking = true })
  rangeEl?.addEventListener('input', (e) => {
    e.stopPropagation()
    const d = video.duration || 0
    video.currentTime = d * (Number(rangeEl.value) / 100)
  })
  rangeEl?.addEventListener('pointerup', (e) => {
    e.stopPropagation()
    seeking = false
  })
  const ctrl = document.getElementById('demo-ctrl')
  ctrl?.addEventListener('click', (e) => e.stopPropagation())
  ctrl?.addEventListener('pointerdown', (e) => e.stopPropagation())
  ctrl?.addEventListener('pointerenter', () => frame.classList.add('is-over-ctrl'))
  ctrl?.addEventListener('pointerleave', () => frame.classList.remove('is-over-ctrl'))

  frame.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' && e.key !== ' ') return
    if (document.activeElement !== frame && !frame.contains(document.activeElement)) return
    e.preventDefault()
    e.stopPropagation()
    togglePlay()
  })

  const cursor = document.getElementById('demo-cursor')
  if (cursor && !isTouch() && !reduceMotion()) {
    let mx = 0, my = 0, cx = 0, cy = 0
    frame.addEventListener('pointerenter', () => cursor.classList.add('is-on'))
    frame.addEventListener('pointerleave', () => cursor.classList.remove('is-on'))
    frame.addEventListener('pointermove', (e) => { mx = e.clientX; my = e.clientY })
    function tick() {
      cx += (mx - cx) * 0.18
      cy += (my - cy) * 0.18
      cursor.style.left = cx + 'px'
      cursor.style.top = cy + 'px'
      requestAnimationFrame(tick)
    }
    tick()
  }
  frame.addEventListener('click', (e) => {
    if (e.target.closest('#demo-ctrl, .mute-fab')) return
    location.href = GENERATE_HREF
  })
}

function fitLine(el) {
  if (!el) return
  el.style.fontSize = ''
  let size = parseFloat(getComputedStyle(el).fontSize)
  for (let i = 0; i < 18 && el.scrollWidth > el.clientWidth + 1; i++) {
    size -= 1.5
    if (size < 16) break
    el.style.fontSize = size + 'px'
  }
}

function fitHeadings() {
  document.querySelectorAll('.hero-lp h1 .h1-l, .two-line .l1, .two-line .l2, .h-split .l1, .h-split .l2, .shorts-title').forEach(fitLine)
  document.querySelectorAll('.lp-red h1, .lp-red h2').forEach((h) => {
    if (h.scrollWidth > h.clientWidth + 1) fitLine(h)
  })
}

function mountPrompt() {
  const el = document.getElementById('prompt-typed')
  const box = document.getElementById('prompt-box')
  if (!box) return
  const go = () => { location.href = GENERATE_HREF }
  box.addEventListener('click', go)
  box.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go() }
  })
  if (!el || reduceMotion()) {
    if (el) el.textContent = SHORTS_PROMPTS[0]
    return
  }
  let i = 0, pos = 0, dir = 1
  function paint() {
    el.textContent = SHORTS_PROMPTS[i].slice(0, pos)
  }
  function tick() {
    const s = SHORTS_PROMPTS[i]
    if (dir === 1) {
      pos += 1
      if (pos >= s.length) {
        pos = s.length
        paint()
        dir = -1
        setTimeout(tick, 1600)
        return
      }
      paint()
    } else {
      pos -= 1
      if (pos <= 0) {
        pos = 0
        paint()
        dir = 1
        i = (i + 1) % SHORTS_PROMPTS.length
      } else {
        paint()
      }
    }
    setTimeout(tick, dir === 1 ? 42 : 22)
  }
  tick()
}

function drawShortsArc() {
  const svg = document.getElementById('shorts-arc')
  if (!svg) return
  if (reduceMotion()) {
    svg.classList.add('is-drawn')
    return
  }
  const io = new IntersectionObserver((ents) => {
    ents.forEach((en) => {
      if (!en.isIntersecting) return
      svg.classList.add('is-drawn')
      io.disconnect()
    })
  }, { threshold: 0.35 })
  io.observe(svg)
}

function mountShorts() {
  const row = document.getElementById('shorts-row')
  const stage = document.querySelector('.shorts-stage')
  if (!row) return
  drawShortsArc()
  row.innerHTML = SHORTS_CARDS.map((c, i) => {
    const icon = IDEA_ICONS[c.icon] || IDEA_ICONS.film
    return `<article class="shorts-card" data-short="${i}" tabindex="0" aria-label="${c.category} Short">
      <div class="shorts-3d">
        <div class="shorts-shot is-blank" data-poster="${c.poster}" data-src="${c.src}"></div>
      </div>
      <div class="shorts-meta">
        <div class="shorts-ico" aria-hidden="true">${icon}</div>
        <div class="shorts-lab">${c.category}</div>
      </div>
    </article>`
  }).join('')

  const items = [...row.querySelectorAll('.shorts-card')]
  items.forEach((el) => {
    const host = el.querySelector('.shorts-shot')
    attachOptionalMedia(host, host.getAttribute('data-poster'), host.getAttribute('data-src'), {
      video: false,
      lazy: true,
      width: 220,
      height: 390,
    })
  })

  let idx = 0
  let paused = false
  function layout() {
    const n = items.length
    const compact = window.innerWidth < 768
    const cardW = compact ? 150 : 240
    const vis = compact ? 1 : 2
    let gap = 16
    const place = (step) => {
      items.forEach((el, i) => {
        let off = i - idx
        if (off > n / 2) off -= n
        if (off < -n / 2) off += n
        const rotY = clamp(off * -14, -28, 28)
        const lift = Math.abs(off) * -10
        const z = -Math.abs(off) * 30
        el.style.width = cardW + 'px'
        el.style.marginLeft = (-cardW / 2) + 'px'
        el.style.transform = `translate3d(${off * step}px, ${lift}px, 0)`
        el.style.zIndex = String(20 - Math.abs(off))
        el.style.opacity = Math.abs(off) > vis ? '0' : '1'
        el.style.pointerEvents = Math.abs(off) > vis ? 'none' : 'auto'
        el.classList.toggle('is-on', off === 0)
        const face = el.querySelector('.shorts-3d')
        if (face) face.style.transform = `translateZ(${z}px) rotateY(${rotY}deg)`
      })
    }
    place(cardW + gap)
    for (let t = 0; t < 6; t++) {
      const shots = items
        .map((el) => ({ el, shot: el.querySelector('.shorts-shot'), op: Number(el.style.opacity || 1) }))
        .filter((x) => x.op > 0 && x.shot)
        .sort((a, b) => a.shot.getBoundingClientRect().left - b.shot.getBoundingClientRect().left)
      let tight = false
      for (let i = 0; i < shots.length - 1; i++) {
        const a = shots[i].shot.getBoundingClientRect()
        const b = shots[i + 1].shot.getBoundingClientRect()
        if (b.left - a.right < 8) tight = true
      }
      if (!tight) break
      gap += 8
      place(cardW + gap)
    }
  }
  function go(i) {
    idx = (i + items.length) % items.length
    layout()
  }
  function playActive(on) {
    items.forEach((el, i) => {
      const host = el.querySelector('.shorts-shot')
      const spec = SHORTS_CARDS[i]
      let video = host.querySelector('video')
      if (on && i === idx && spec.src) {
        if (!video) {
          probeUrl(spec.src).then((ok) => {
            if (!ok || host.querySelector('video')) return
            video = document.createElement('video')
            video.muted = true
            video.loop = true
            video.playsInline = true
            video.preload = 'metadata'
            host.appendChild(video)
            fadeMedia(video)
            playHover(video, spec.src)
          })
        } else {
          playHover(video, spec.src)
        }
      } else if (video) {
        pauseReset(video)
      }
    })
  }

  document.querySelector('[data-short-prev]')?.addEventListener('click', () => { paused = true; go(idx - 1); setTimeout(() => { paused = false }, 2400) })
  document.querySelector('[data-short-next]')?.addEventListener('click', () => { paused = true; go(idx + 1); setTimeout(() => { paused = false }, 2400) })
  stage?.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); paused = true; go(idx - 1) }
    if (e.key === 'ArrowRight') { e.preventDefault(); paused = true; go(idx + 1) }
  })
  items.forEach((el, i) => {
    el.addEventListener('pointerenter', () => {
      paused = true
      go(i)
      playActive(true)
    })
    el.addEventListener('pointerleave', () => {
      paused = false
      playActive(false)
    })
    el.addEventListener('focus', () => go(i))
  })
  window.addEventListener('resize', layout, { passive: true })
  layout()
  if (!reduceMotion()) {
    setInterval(() => {
      if (paused || document.hidden) return
      go(idx + 1)
    }, 3800)
  }
}

function mountShowcase() {
  const root = document.getElementById('coverflow')
  const dots = document.getElementById('cover-dots')
  const stage = root?.closest('.ideas-stage')
  if (!root) return
  let active = 0
  function go(i) {
    active = (i + SHOWCASE_CARDS.length) % SHOWCASE_CARDS.length
    render()
  }
  function wrappedOff(i) {
    const n = SHOWCASE_CARDS.length
    let off = i - active
    if (off > n / 2) off -= n
    if (off < -n / 2) off += n
    return off
  }
  function render() {
    root.querySelectorAll('.cover-card').forEach((n) => n.remove())
    SHOWCASE_CARDS.forEach((c, i) => {
      const off = wrappedOff(i)
      const el = document.createElement('article')
      el.className = 'cover-card' + (off === 0 ? ' is-active' : '')
      el.style.zIndex = String(20 - Math.abs(off))
      el.style.opacity = Math.abs(off) > 1 ? '0' : (off === 0 ? '1' : '0.5')
      el.style.pointerEvents = Math.abs(off) > 1 ? 'none' : 'auto'
      el.style.visibility = Math.abs(off) > 1 ? 'hidden' : ''
      const tuck = off === 0 ? 0 : (off * 42)
      el.style.transform = `translateX(calc(-50% + ${tuck}%)) scale(${off === 0 ? 1 : 0.7}) rotateY(${off * -25}deg)`
      const frag = c.src ? c.src + '#t=0.5' : ''
      const vid = c.src
        ? `<video muted loop playsinline preload="${off === 0 ? 'metadata' : 'none'}" src="${off === 0 ? frag : ''}" data-src="${c.src}"></video>`
        : featMockHtml()
      el.innerHTML = `<span class="cover-badge">${c.category}</span>${vid}${c.src ? muteBtn() : ''}
        <div class="cover-prompt"><p>${c.prompt}</p><a class="btn btn-primary btn-glow" href="${GENERATE_HREF}"><span class="btn-ring" aria-hidden="true"></span><span class="btn-label">Create Now</span></a></div>`
      const videos = [...el.querySelectorAll('video')]
      videos.forEach((video) => {
        bindMute(el, video)
        if (c.src && Math.abs(off) <= 1) {
          ensureSrc(video, c.src)
          if (i === active) {
            video.muted = true
            safePlay(video)
          } else {
            video.pause()
            video.muted = true
          }
        }
      })
      el.addEventListener('click', (e) => {
        if (e.target.closest('a, [data-mute]')) return
        if (off !== 0) go(i)
      })
      root.appendChild(el)
    })
    if (dots) {
      dots.innerHTML = SHOWCASE_CARDS.map((_, i) =>
        `<button type="button" class="${i === active ? 'is-on' : ''}" data-dot="${i}" aria-label="Show video ${i + 1}"></button>`
      ).join('')
      dots.querySelectorAll('button').forEach((b) => {
        b.addEventListener('click', () => go(Number(b.getAttribute('data-dot'))))
      })
    }
  }
  document.querySelector('[data-show-prev]')?.addEventListener('click', () => go(active - 1))
  document.querySelector('[data-show-next]')?.addEventListener('click', () => go(active + 1))
  stage?.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(active - 1) }
    if (e.key === 'ArrowRight') { e.preventDefault(); go(active + 1) }
  })
  let sx = 0
  root.addEventListener('touchstart', (e) => { sx = e.changedTouches[0].clientX }, { passive: true })
  root.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - sx
    if (Math.abs(dx) < 40) return
    go(active + (dx < 0 ? 1 : -1))
  })
  render()
}

function mountVoiceover() {
  const el = document.getElementById('vo-typed')
  if (!el) return
  if (reduceMotion()) { el.textContent = VOICEOVER_SCRIPT; return }
  let pos = 0
  function tick() {
    pos += 1
    if (pos > VOICEOVER_SCRIPT.length) {
      setTimeout(() => { pos = 0; tick() }, 1600)
      return
    }
    el.textContent = VOICEOVER_SCRIPT.slice(0, pos)
    setTimeout(tick, 28)
  }
  tick()
}

function mountWhyTabs() {
  const list = document.getElementById('how-tabs')
  const bg = document.getElementById('how-bg')
  if (bg) {
    if (HOW_PANEL_SRC) lazyAutoplay(bg, HOW_PANEL_SRC)
    else if (HOW_PANEL_POSTER) {
      bg.removeAttribute('src')
      bg.setAttribute('poster', HOW_PANEL_POSTER)
      bg.style.opacity = '0'
    }
  }
  if (!list) return
  list.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      list.querySelectorAll('button').forEach((b) => b.classList.toggle('is-on', b === btn))
      document.querySelectorAll('[data-how-pane]').forEach((p) => {
        p.hidden = p.getAttribute('data-how-pane') !== btn.getAttribute('data-how')
      })
    })
  })
}

export function wrapGlowLabels(root = document) {
  root.querySelectorAll('.btn-glow').forEach((btn) => {
    if (btn.querySelector('.btn-label')) return
    const label = document.createElement('span')
    label.className = 'btn-label'
    ;[...btn.childNodes].forEach((n) => {
      if (n.nodeType === 1 && n.classList && n.classList.contains('btn-ring')) return
      label.appendChild(n)
    })
    btn.appendChild(label)
  })
}

export function checkGlowLabels(root = document) {
  const report = []
  root.querySelectorAll('.btn-glow').forEach((btn, i) => {
    const label = btn.querySelector('.btn-label')
    const text = (label?.textContent || '').replace(/\s+/g, ' ').trim()
    if (!label) {
      report.push({ i, text: '', ok: false, reason: 'missing-label' })
      return
    }
    const cs = getComputedStyle(label)
    const visible = cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.2
    const r = label.getBoundingClientRect()
    const inView = r.width > 2 && r.height > 2 && r.bottom > 0 && r.top < window.innerHeight
    let hitOk = !inView
    if (inView) {
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      hitOk = !!(hit && (hit === label || label.contains(hit)))
    }
    report.push({ i, text, ok: visible && hitOk, visible, hitOk, inView })
  })
  return report
}

function announceHeight() {
  const bar = document.getElementById('lp-announce')
  if (!bar || bar.hidden) return 0
  return bar.offsetHeight || 0
}

function applyAnnounceOffset() {
  const chrome = document.getElementById('lp-sitehead')
  const header = chrome?.querySelector('header')
  const barH = announceHeight()
  const navH = header?.offsetHeight || 82
  const chromeH = Math.max(chrome?.offsetHeight || 0, barH + navH)
  document.documentElement.style.setProperty('--announce-h', chromeH + 'px')
  document.documentElement.style.setProperty('--chrome-h', chromeH + 'px')
  document.documentElement.style.setProperty('--anchor-offset', (chromeH + 16) + 'px')
  try { window.ScrollTrigger?.refresh?.() } catch (_) {}
}

export function mountAnnounce() {
  const bar = document.getElementById('lp-announce')
  if (!bar) return
  const spec = LANDING_ANNOUNCE
  let dismissed = false
  try { dismissed = localStorage.getItem(spec.key) === '1' } catch (_) {}
  if (dismissed) {
    bar.hidden = true
    bar.classList.add('is-off')
    applyAnnounceOffset()
    return
  }
  const desk = bar.querySelector('[data-announce-desk]')
  const mob = bar.querySelector('[data-announce-mob]')
  const cta = bar.querySelector('[data-announce-cta]')
  if (desk) desk.textContent = spec.text
  if (mob) mob.textContent = spec.textMobile
  if (cta) {
    cta.textContent = spec.cta
    cta.setAttribute('href', spec.href)
  }
  bar.hidden = false
  bar.classList.remove('is-off')
  requestAnimationFrame(() => {
    applyAnnounceOffset()
    requestAnimationFrame(applyAnnounceOffset)
  })
  setTimeout(applyAnnounceOffset, 80)
  bar.querySelector('[data-announce-close]')?.addEventListener('click', () => {
    bar.classList.add('is-off')
    try { localStorage.setItem(spec.key, '1') } catch (_) {}
    applyAnnounceOffset()
    setTimeout(applyAnnounceOffset, 320)
  })
  window.addEventListener('resize', applyAnnounceOffset, { passive: true })
}

function fillFeatPanel(host, src, poster, start) {
  if (!host) return
  if (src) {
    const frag = start ? (src + '#t=' + start) : src
    host.innerHTML = `<video class="feat-zoom" muted loop playsinline preload="metadata" poster="${poster || ''}" src="${frag}"></video>`
    const video = host.querySelector('video')
    if (start) {
      video.addEventListener('loadedmetadata', () => {
        try { if (video.currentTime < start) video.currentTime = start } catch (_) {}
      })
    }
    lazyAutoplay(video, src)
    return
  }
  if (poster) {
    host.innerHTML = `<img class="feat-still" src="${poster}" alt="" width="960" height="540" loading="lazy" decoding="async">`
    return
  }
  host.innerHTML = featMockHtml()
}

function mountThumbDemo() {
  fillFeatPanel(document.getElementById('thumb-demo'), THUMBNAIL_DEMO_SRC, THUMBNAIL_DEMO_POSTER)
}

function mountLongformDemo() {
  fillFeatPanel(document.getElementById('longform-demo'), LONGFORM_DEMO_SRC, LONGFORM_DEMO_POSTER, LONGFORM_DEMO_START)
}

export function mountFaq() {
  document.querySelectorAll('.faq-col').forEach((col) => {
    const items = [...col.querySelectorAll('details')]
    items.forEach((d) => {
      d.addEventListener('toggle', () => {
        if (!d.open) return
        items.forEach((other) => {
          if (other !== d) other.open = false
        })
      })
    })
  })
}

function mountTopModels() {
  const orbit = document.getElementById('top-models-orbit')
  if (!orbit) return
  orbit.innerHTML = featuredModels().map((m) => `
    <a class="top-models-tile is-blank" data-slot="${m.slot}" href="/models#${modelSlug(m.id)}">
      <div class="top-models-shot is-blank" data-tile="${modelSlug(m.id)}"></div>
      <span class="top-models-name">${m.name}</span>
    </a>`).join('')
  orbit.querySelectorAll('[data-tile]').forEach((host) => {
    const src = modelTileSrc(host.getAttribute('data-tile'))
    attachOptionalMedia(host, src, '', { lazy: true, width: 320, height: 180 })
  })
}

export function mountLandingPage() {
  document.addEventListener('pointerdown', markInteracted, { passive: true })
  document.addEventListener('keydown', markInteracted)
  mountAnnounce()
  mountLandingToolsMenu()
  mountLandingFooter()
  try {
    window.applyVidsoSocialLinks && window.applyVidsoSocialLinks()
    window.applyVidsoSupportLinks && window.applyVidsoSupportLinks()
  } catch (_) {}
  mountHero()
  mountHeroPrompt()
  mountHeroTrust()
  mountTopModels()
  mountDemo()
  fitHeadings()
  window.addEventListener('resize', fitHeadings, { passive: true })
  mountShorts()
  mountPrompt()
  mountShowcase()
  wrapGlowLabels()
  mountVoiceover()
  mountWhyTabs()
  mountThumbDemo()
  mountLongformDemo()
  document.querySelectorAll('.fmt-vis video[data-src]').forEach((v) => {
    const src = v.getAttribute('data-src')
    const io = new IntersectionObserver((ents) => {
      ents.forEach((en) => {
        if (!en.isIntersecting) return
        ensureSrc(v, src)
        io.disconnect()
      })
    }, { rootMargin: '180px' })
    io.observe(v)
  })
  mountFaq()
  mountLandingIntegrations()
  wrapGlowLabels()
  mountLandingReveals()
  window.__checkGlowLabels = checkGlowLabels
  window.__checkHeadingCenters = checkHeadingCenters
}
