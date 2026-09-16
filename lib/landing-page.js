import {
  HERO_CARDS,
  HERO_VIDEO_SRC,
  HERO_VIDEO_POSTER,
  HERO_TRANSITION,
  SHOWCASE_CARDS,
  IDEA_CARDS,
  PROMPT_IDEAS,
  CREATE_HREF,
  VOICEOVER_SCRIPT,
  THUMBNAIL_DEMO_SRC,
  THUMBNAIL_DEMO_POSTER,
  LONGFORM_DEMO_SRC,
  LONGFORM_DEMO_POSTER,
  HOW_PANEL_SRC,
  HOW_PANEL_POSTER,
} from './landing-media.js'
import { mountLandingIntegrations } from './landing-integrations.js'

const SCATTER = [
  { x: -50, y: -38, r: -8 },
  { x: 52, y: -36, r: 8 },
  { x: -56, y: 8, r: -6 },
  { x: 54, y: 6, r: 7 },
  { x: -48, y: 40, r: 5 },
  { x: 46, y: 38, r: -7 },
  { x: -44, y: -18, r: 6 },
  { x: 44, y: -20, r: -5 },
  { x: -46, y: 24, r: 9 },
  { x: 42, y: 22, r: -8 },
]

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

function primeThumb(video, src) {
  if (!video || !src) return
  ensureSrc(video, src)
  const snap = () => {
    try {
      if (video.currentTime < 0.12) video.currentTime = 0.4
    } catch (_) {}
    video.pause()
  }
  if (video.readyState >= 2) snap()
  else video.addEventListener('loadeddata', snap, { once: true })
}

function pauseReset(video) {
  if (!video) return
  video.pause()
  try { video.currentTime = 0 } catch (_) {}
  video.muted = true
  if (audioOwner === video) audioOwner = null
  const btn = video.closest('.idea-card, .cover-card, .demo-frame')?.querySelector('[data-mute]')
  if (btn) syncMuteBtn(btn, video)
}

function syncMuteBtn(btn, video) {
  if (!btn || !video) return
  const on = !video.muted
  btn.innerHTML = on ? UNMUTE_SVG : MUTE_SVG
  btn.setAttribute('aria-label', on ? 'Mute' : 'Unmute')
}

function playHover(video, src) {
  ensureSrc(video, src)
  if (userHasInteracted) {
    if (audioOwner && audioOwner !== video) {
      audioOwner.muted = true
      const otherBtn = audioOwner.closest('.idea-card, .cover-card, .demo-frame')?.querySelector('[data-mute]')
      if (otherBtn) syncMuteBtn(otherBtn, audioOwner)
      audioOwner.pause()
    }
    video.muted = false
    audioOwner = video
  } else {
    video.muted = true
  }
  safePlay(video)
  const btn = video.closest('.idea-card, .cover-card, .demo-frame')?.querySelector('[data-mute]')
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
        const otherBtn = audioOwner.closest('.idea-card, .cover-card, .demo-frame')?.querySelector('[data-mute]')
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

function lazyAutoplay(video, src) {
  if (!video || !src) return
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) {
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

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n))
}
function range(t, a, b) {
  return clamp((t - a) / Math.max(0.0001, b - a), 0, 1)
}

function isImageSrc(src) {
  return /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(src || '')
}

function placeCards(cards, t, fade, scale) {
  cards.forEach((el, i) => {
    const a = SCATTER[i] || SCATTER[0]
    const x = a.x * (1 - t * 0.72)
    const y = a.y * (1 - t) - 10 * t
    const r = a.r * (1 - t)
    el.style.transform = `translate3d(calc(-50% + ${x}vw), calc(-50% + ${y}vh), 0) rotate(${r}deg) scale(${scale})`
    el.style.opacity = String(fade)
  })
}

function mountHero() {
  const root = document.getElementById('hero-cards')
  if (!root) return
  const cards = HERO_CARDS.filter((c) => c.src)
  root.innerHTML = cards.map((c, i) => {
    const kind = c.type === 'short' ? 'short' : 'long'
    const start = Number(c.start) || 0
    let media
    if (isImageSrc(c.src)) {
      media = `<img src="${c.src}" alt="" loading="lazy" decoding="async">`
    } else {
      media = `<video muted loop playsinline preload="none" poster="${c.poster || ''}" data-src="${c.src}" data-start="${start}"></video>`
    }
    return `<div class="hero-card is-${kind}" data-i="${i}"><div class="hero-card-inner">${media}</div></div>`
  }).join('')
  root.querySelectorAll('video[data-src]').forEach((v) => {
    const start = Number(v.getAttribute('data-start')) || 0
    if (start) {
      v.addEventListener('loadedmetadata', () => {
        try { if (v.currentTime < start) v.currentTime = start } catch (_) {}
      })
    }
    lazyAutoplay(v, v.getAttribute('data-src'))
  })
  placeCards([...root.querySelectorAll('.hero-card')], reduceMotion() ? 0.12 : 0, 1, 1)
}

function mountHeroTransition() {
  const pin = document.getElementById('hero-pin')
  const video = document.getElementById('demo-video')
  const demo = document.getElementById('demo-hero')
  const frame = document.getElementById('demo-frame')
  const overlay = document.getElementById('demo-overlay')
  const vignette = document.getElementById('demo-vignette')
  const beat = document.getElementById('hero-dark-beat')
  if (!pin || !demo || !frame) return

  const cards = [...document.querySelectorAll('#hero-cards .hero-card')]
  const exits = {
    title: document.querySelector('[data-hero-exit="title"]'),
    badge: document.querySelector('[data-hero-exit="badge"]'),
    sub: document.querySelector('[data-hero-exit="sub"]'),
    cta: document.querySelector('[data-hero-exit="cta"]'),
    plat: document.querySelector('[data-hero-exit="plat"]'),
  }
  const mobile = () => window.matchMedia('(max-width: 900px)').matches || isTouch()

  function setPinHeight() {
    const vh = mobile() ? HERO_TRANSITION.pinVhMobile : HERO_TRANSITION.pinVh
    pin.style.setProperty('--hero-pin-vh', String(vh))
  }

  if (reduceMotion()) {
    pin.classList.add('is-static', 'is-settled')
    setPinHeight()
    pin.style.height = 'auto'
    return
  }

  setPinHeight()
  ensureSrc(video, HERO_VIDEO_SRC)

  function fadeEl(el, opacity, y) {
    if (!el) return
    el.style.opacity = String(opacity)
    el.style.transform = `translate3d(0, ${y}px, 0)`
  }

  function apply(p) {
    const aEnd = HERO_TRANSITION.aEnd
    const bEnd = HERO_TRANSITION.bEnd
    const cEnd = HERO_TRANSITION.cEnd
    const a = range(p, 0, aEnd)
    const b = range(p, aEnd, bEnd)
    const c = range(p, bEnd, cEnd)

    if (p <= 0.002) {
      Object.values(exits).forEach((el) => {
        if (!el) return
        el.style.opacity = ''
        el.style.transform = ''
      })
      placeCards(cards, 0, 1, 1)
      demo.style.opacity = '0'
      frame.style.transform = 'scale(1.18)'
      if (overlay) { overlay.style.opacity = '0'; overlay.style.transform = 'translate3d(-50%, 16px, 0)' }
      if (vignette) vignette.style.opacity = '0'
      if (beat) beat.style.opacity = '0'
      pin.classList.remove('is-settled')
      if (video && p < aEnd) video.pause()
      return
    }

    const titleT = range(a, 0, 0.58)
    const restT = range(a, 0.1, 0.82)
    const ctaT = range(a, 0.22, 1)
    fadeEl(exits.title, 1 - titleT, -64 * titleT)
    fadeEl(exits.badge, 1 - restT, -36 * restT)
    fadeEl(exits.sub, 1 - restT, -44 * restT)
    fadeEl(exits.cta, 1 - ctaT, -28 * ctaT)
    fadeEl(exits.plat, 1 - restT, -32 * restT)

    const cardT = a
    placeCards(cards, cardT, Math.max(0, 1 - cardT * 1.35), 1 - 0.18 * cardT)

    const beatPeak = b < 0.5 ? b * 2 : (1 - b) * 2
    if (beat) beat.style.opacity = String(p < aEnd ? 0 : (p > bEnd ? Math.max(0, 1 - c * 2) * 0.25 : beatPeak))

    const showDemo = p >= bEnd
    demo.style.opacity = String(showDemo ? range(p, bEnd, bEnd + 0.06) : 0)
    frame.style.filter = 'none'
    const scale = 1.18 - 0.18 * c
    frame.style.transform = `scale(${scale})`

    const overlayIn = range(c, 0.05, 0.32)
    const overlayOut = range(c, 0.52, 0.92)
    const overlayOp = overlayIn * (1 - overlayOut) * (c > 0 ? 1 : 0)
    if (overlay) {
      overlay.style.opacity = String(overlayOp)
      overlay.style.transform = `translate3d(-50%, ${16 - 36 * c}px, 0)`
    }
    if (vignette) vignette.style.opacity = String(c > 0 ? 1 - c * 0.75 : 0)

    const settled = p >= cEnd
    pin.classList.toggle('is-settled', settled)
    if (video) {
      if (p >= bEnd - 0.04) {
        video.muted = true
        safePlay(video)
      } else if (p < aEnd) {
        video.pause()
      }
    }
  }

  const gsap = window.gsap
  const ST = window.ScrollTrigger
  if (gsap && ST) {
    const st = ST.create({
      trigger: pin,
      start: 'top top',
      end: 'bottom bottom',
      scrub: true,
      onUpdate: (self) => apply(self.progress),
    })
    window.addEventListener('resize', () => {
      setPinHeight()
      st.refresh()
    }, { passive: true })
  } else {
    const onScroll = () => {
      const rect = pin.getBoundingClientRect()
      const total = pin.offsetHeight - window.innerHeight
      const p = clamp(-rect.top / Math.max(1, total), 0, 1)
      apply(p)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', setPinHeight, { passive: true })
    onScroll()
  }
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
  video.setAttribute('preload', 'metadata')
  video.style.filter = 'none'
  ensureSrc(video, HERO_VIDEO_SRC)
  if (reduceMotion() || !document.getElementById('hero-pin')) lazyAutoplay(video, HERO_VIDEO_SRC)
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
  video.addEventListener('timeupdate', paint)
  video.addEventListener('loadedmetadata', paint)
  video.addEventListener('play', paint)
  video.addEventListener('pause', paint)
  pauseBtn?.addEventListener('click', (e) => {
    e.stopPropagation()
    if (video.paused) safePlay(video)
    else video.pause()
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
  rangeEl?.addEventListener('input', () => {
    const d = video.duration || 0
    video.currentTime = d * (Number(rangeEl.value) / 100)
  })
  rangeEl?.addEventListener('pointerup', () => { seeking = false })
  document.getElementById('demo-ctrl')?.addEventListener('click', (e) => e.stopPropagation())
  document.getElementById('demo-ctrl')?.addEventListener('pointerenter', () => frame.classList.add('is-over-ctrl'))
  document.getElementById('demo-ctrl')?.addEventListener('pointerleave', () => frame.classList.remove('is-over-ctrl'))

  const cursor = document.getElementById('demo-cursor')
  if (cursor && !isTouch() && !reduceMotion()) {
    let mx = 0, my = 0, cx = 0, cy = 0
    frame.addEventListener('pointerenter', () => {
      if (document.getElementById('hero-pin')?.classList.contains('is-settled')) cursor.classList.add('is-on')
    })
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
    if (!document.getElementById('hero-pin')?.classList.contains('is-settled') && !reduceMotion()) return
    location.href = CREATE_HREF
  })
}

function mountLoved() {
  const track = document.getElementById('loved-track')
  const files = [...new Set(window.VIDSO_TRUSTED_CREATOR_FILES || [])]
  const base = window.VIDSO_R2_BASE || ''
  if (!track || !base || !files.length) return
  const imgs = files.map((f, i) =>
    `<img src="${base}/${f}" alt="" width="52" height="52" loading="${i < 5 ? 'eager' : 'lazy'}" decoding="async">`
  ).join('')
  if (reduceMotion()) {
    track.classList.add('is-static')
    track.innerHTML = `<div class="loved-marquee"><div class="loved-set">${imgs}</div></div>`
    return
  }
  track.innerHTML = `<div class="loved-marquee"><div class="loved-set">${imgs}</div><div class="loved-set" aria-hidden="true">${imgs}</div></div>`
}

function mountPrompt() {
  const el = document.getElementById('prompt-typed')
  const box = document.getElementById('prompt-box')
  if (!box) return
  const go = () => { location.href = CREATE_HREF }
  box.addEventListener('click', go)
  box.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go() }
  })
  if (!el || reduceMotion()) {
    if (el) el.textContent = PROMPT_IDEAS[0]
    return
  }
  let i = 0, pos = 0, dir = 1
  function paint() {
    el.textContent = PROMPT_IDEAS[i].slice(0, pos)
  }
  function tick() {
    const s = PROMPT_IDEAS[i]
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
        i = (i + 1) % PROMPT_IDEAS.length
      } else {
        paint()
      }
    }
    setTimeout(tick, dir === 1 ? 42 : 22)
  }
  tick()
}

function mountIdeas() {
  const row = document.getElementById('ideas-row')
  if (!row) return
  const cards = IDEA_CARDS.filter((c) => c.src || c.poster)
  row.innerHTML = cards.map((c, i) => {
    const icon = IDEA_ICONS[c.icon] || IDEA_ICONS.film
    const media = c.src && !isImageSrc(c.src)
      ? `<video muted loop playsinline preload="none" poster="${c.poster || ''}" data-src="${c.src}"></video>`
      : `<img src="${c.poster || c.src}" alt="" loading="lazy" decoding="async">`
    return `<button type="button" class="idea-card" data-idea="${i}" aria-label="${c.category} idea">
      <div class="idea-shot" data-cat="${c.category}">${media}${c.src && !isImageSrc(c.src) ? muteBtn() : ''}</div>
      <div class="idea-meta">${icon}<span>${c.category}</span></div>
    </button>`
  }).join('')

  const items = [...row.querySelectorAll('.idea-card')]
  items.forEach((el, i) => {
    const spec = cards[i]
    const video = el.querySelector('video')
    if (video && spec.src) primeThumb(video, spec.src)
    bindMute(el, video)
    const tilt = reduceMotion() ? 0 : (i % 2 === 0 ? -11 : 11)
    el.style.setProperty('--tilt', tilt + 'deg')
    el.style.setProperty('--sc', i === 2 ? '1.04' : '1')
    el.addEventListener('pointerenter', () => {
      paused = true
      items.forEach((other) => {
        if (other === el) return
        const ov = other.querySelector('video')
        if (ov) pauseReset(ov)
      })
      if (video && spec.src) playHover(video, spec.src)
    })
    el.addEventListener('pointerleave', () => {
      paused = false
      if (video) pauseReset(video)
    })
  })

  let idx = 0
  let paused = false
  function center(i) {
    idx = (i + items.length) % items.length
    const el = items[idx]
    if (!el) return
    const left = el.offsetLeft - (row.clientWidth - el.offsetWidth) / 2
    row.scrollTo({ left: Math.max(0, left), behavior: reduceMotion() ? 'auto' : 'smooth' })
  }
  document.querySelector('[data-idea-prev]')?.addEventListener('click', () => { paused = true; center(idx - 1); setTimeout(() => { paused = false }, 2400) })
  document.querySelector('[data-idea-next]')?.addEventListener('click', () => { paused = true; center(idx + 1); setTimeout(() => { paused = false }, 2400) })

  if (!reduceMotion() && items.length > 3) {
    setInterval(() => {
      if (paused || document.hidden) return
      center(idx + 1)
    }, 3200)
  }
}

function mountShowcase() {
  const root = document.getElementById('coverflow')
  const dots = document.getElementById('cover-dots')
  if (!root) return
  let active = 0
  function go(i) {
    active = (i + SHOWCASE_CARDS.length) % SHOWCASE_CARDS.length
    render()
  }
  function render() {
    root.querySelectorAll('.cover-card').forEach((n) => n.remove())
    SHOWCASE_CARDS.forEach((c, i) => {
      const off = i - active
      const el = document.createElement('article')
      el.className = 'cover-card' + (off === 0 ? ' is-active' : '')
      el.style.zIndex = String(20 - Math.abs(off))
      el.style.opacity = Math.abs(off) > 2 ? '0' : String(1 - Math.abs(off) * 0.18)
      el.style.pointerEvents = Math.abs(off) > 2 ? 'none' : 'auto'
      el.style.transform = `translateX(calc(-50% + ${off * 38}%)) scale(${off === 0 ? 1 : 0.72}) rotateY(${off * -22}deg)`
      const media = c.src
        ? `<video muted loop playsinline preload="metadata" poster="${c.poster || ''}" data-src="${c.src}"></video>`
        : featMockHtml()
      el.innerHTML = `<span class="cover-badge">${c.category}</span>${media}${c.src ? muteBtn() : ''}
        <div class="cover-prompt"><p>${c.prompt}</p><a class="btn btn-primary btn-glow" href="${CREATE_HREF}"><span class="btn-ring" aria-hidden="true"></span>Create Now</a></div>`
      const video = el.querySelector('video')
      bindMute(el, video)
      if (c.src && video) {
        ensureSrc(video, c.src)
        if (i === active) {
          video.muted = true
          safePlay(video)
        } else {
          video.pause()
          video.muted = true
        }
      }
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

function mountChat() {
  const user = document.getElementById('mcp-chat-user')
  const bot = document.getElementById('mcp-chat-bot')
  if (!user || !bot) return
  const text = 'Make a 12 minute faceless YouTube video on airport secrets airlines hide from travelers. 16:9, B-roll and captions.'
  if (reduceMotion()) {
    user.textContent = text
    bot.hidden = false
    return
  }
  let pos = 0
  function tick() {
    pos += 1
    user.textContent = text.slice(0, pos)
    if (pos < text.length) setTimeout(tick, 18)
    else setTimeout(() => { bot.hidden = false }, 400)
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

function fillFeatPanel(host, src, poster) {
  if (!host) return
  if (src) {
    host.innerHTML = `<video muted loop playsinline preload="none" poster="${poster || ''}"></video>`
    lazyAutoplay(host.querySelector('video'), src)
    return
  }
  if (poster) {
    host.innerHTML = `<img class="feat-still" src="${poster}" alt="" loading="lazy" decoding="async">`
    return
  }
  host.innerHTML = featMockHtml()
}

function mountThumbDemo() {
  fillFeatPanel(document.getElementById('thumb-demo'), THUMBNAIL_DEMO_SRC, THUMBNAIL_DEMO_POSTER)
}

function mountLongformDemo() {
  fillFeatPanel(document.getElementById('longform-demo'), LONGFORM_DEMO_SRC, LONGFORM_DEMO_POSTER)
}

function mountFaq() {
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

export function mountLandingPage() {
  document.addEventListener('pointerdown', markInteracted, { passive: true })
  document.addEventListener('keydown', markInteracted)
  mountHero()
  mountDemo()
  mountHeroTransition()
  mountLoved()
  mountIdeas()
  mountPrompt()
  mountShowcase()
  mountVoiceover()
  mountChat()
  mountWhyTabs()
  mountThumbDemo()
  mountLongformDemo()
  mountFaq()
  mountLandingIntegrations()
}
