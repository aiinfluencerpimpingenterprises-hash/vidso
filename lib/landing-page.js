import {
  HERO_CARDS,
  HERO_VIDEO_SRC,
  HERO_VIDEO_POSTER,
  HERO_TRANSITION,
  SHOWCASE_CARDS,
  SHORTS_CARDS,
  SHORTS_PROMPTS,
  CREATE_HREF,
  VOICEOVER_SCRIPT,
  THUMBNAIL_DEMO_SRC,
  THUMBNAIL_DEMO_POSTER,
  LONGFORM_DEMO_SRC,
  LONGFORM_DEMO_POSTER,
  LONGFORM_DEMO_START,
  HOW_PANEL_SRC,
  HOW_PANEL_POSTER,
} from './landing-media.js'
import { mountLandingIntegrations } from './landing-integrations.js'

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
        fadeMedia(img)
      }
      if (!wantVideo) return
      if (isTouch() || window.matchMedia('(max-width: 820px)').matches) return
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
function range(t, a, b) {
  return clamp((t - a) / Math.max(0.0001, b - a), 0, 1)
}

function isImageSrc(src) {
  return /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(src || '')
}

function heroSafeRect() {
  const copy = document.getElementById('hero-copy')
  const nav = document.querySelector('header')
  const pad = 32
  const copyR = copy ? copy.getBoundingClientRect() : { left: 200, right: window.innerWidth - 200, top: 160, bottom: 640 }
  const navR = nav ? nav.getBoundingClientRect() : { bottom: 72 }
  return {
    left: copyR.left - pad,
    right: copyR.right + pad,
    top: Math.max(copyR.top - pad, navR.bottom + 12),
    bottom: copyR.bottom + pad,
    navBottom: navR.bottom + 12,
  }
}

function rectsOverlap(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
}

function overlapRatio(a, b) {
  const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
  const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
  const inter = x * y
  const minArea = Math.min((a.right - a.left) * (a.bottom - a.top), (b.right - b.left) * (b.bottom - b.top))
  return minArea ? inter / minArea : 0
}

function separateCards(boxes) {
  for (let n = 0; n < 10; n++) {
    let moved = false
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]
        const b = boxes[j]
        if (overlapRatio(a, b) <= 0.15) continue
        const acy = (a.top + a.bottom) / 2
        const bcy = (b.top + b.bottom) / 2
        const push = 12
        if (acy <= bcy) {
          a.top -= push
          a.bottom -= push
          b.top += push
          b.bottom += push
        } else {
          b.top -= push
          b.bottom -= push
          a.top += push
          a.bottom += push
        }
        moved = true
      }
    }
    if (!moved) break
  }
}

function placeCards(cards, t, fade, scale) {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const safe = heroSafeRect()
  const boxes = cards.map((el, i) => {
    const spec = HERO_CARDS[i] || HERO_CARDS[0]
    const w = el.offsetWidth || (spec.type === 'short' ? 112 : 250)
    const h = el.offsetHeight || (spec.type === 'short' ? 198 : 140)
    let x = spec.side === 'left' ? 24 : vw - w - 24
    let y = clamp(vh * spec.y - h / 2, safe.navBottom, vh - h - 16)
    return { el, spec, w, h, x, y, left: x, right: x + w, top: y, bottom: y + h }
  })

  if (t < 0.04) {
    boxes.forEach((box) => {
      if (rectsOverlap(box, safe)) {
        if (box.spec.side === 'left') box.x = Math.min(box.x, safe.left - box.w - 16)
        else box.x = Math.max(box.x, safe.right + 16)
        if (box.y < safe.navBottom) box.y = safe.navBottom
        box.left = box.x
        box.right = box.x + box.w
        box.top = box.y
        box.bottom = box.y + box.h
      }
    })
    separateCards(boxes)
    boxes.forEach((box) => {
      box.y = clamp(box.top, safe.navBottom, vh - box.h - 16)
      box.x = box.left
      box.left = box.x
      box.right = box.x + box.w
      box.top = box.y
      box.bottom = box.y + box.h
    })
  }

  boxes.forEach((box) => {
    const hidden = t < 0.04 && (
      box.y < safe.navBottom - 1 ||
      rectsOverlap(box, safe) ||
      box.x < -box.w * 0.35 ||
      box.x + box.w > vw + box.w * 0.35
    )
    const cx = vw / 2
    const cy = vh / 2
    const restCx = box.x + box.w / 2
    const restCy = box.y + box.h / 2
    const px = restCx + (cx - restCx) * t
    const py = restCy + (cy - restCy) * t
    const r = box.spec.r * (1 - t)
    box.el.style.left = '0'
    box.el.style.top = '0'
    box.el.style.transform = `translate3d(${px - box.w / 2}px, ${py - box.h / 2}px, 0) rotate(${r}deg) scale(${scale})`
    box.el.style.opacity = hidden ? '0' : String(fade)
    box.el.style.visibility = hidden ? 'hidden' : ''
  })
}

function mountHero() {
  const root = document.getElementById('hero-cards')
  if (!root) return
  root.innerHTML = HERO_CARDS.map((c, i) => {
    const kind = c.type === 'short' ? 'short' : 'long'
    return `<div class="hero-card is-${kind} is-blank" data-i="${i}" data-video="${c.src || ''}" data-poster="${c.poster || ''}"><div class="hero-card-inner"></div></div>`
  }).join('')
  const nodes = [...root.querySelectorAll('.hero-card')]
  const layout = () => placeCards(nodes, reduceMotion() ? 0.12 : 0, 1, 1)
  layout()
  window.addEventListener('resize', layout, { passive: true })
  requestAnimationFrame(layout)

  nodes.forEach((el) => {
    const host = el.querySelector('.hero-card-inner')
    attachOptionalMedia(host, el.getAttribute('data-poster'), el.getAttribute('data-video'), {
      video: !reduceMotion() && !isTouch() && window.innerWidth > 820,
      width: el.classList.contains('is-short') ? 112 : 250,
      height: el.classList.contains('is-short') ? 198 : 140,
    })
  })
}

function mountHeroTransition() {
  const pin = document.getElementById('hero-pin')
  const video = document.getElementById('demo-video')
  const demo = document.getElementById('demo-hero')
  const frame = document.getElementById('demo-frame')
  const vignette = document.getElementById('demo-vignette')
  const beat = document.getElementById('hero-dark-beat')
  const ghost = document.getElementById('hero-ghost-cta')
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
    if (ghost) ghost.style.opacity = '0'
    return
  }

  setPinHeight()
  let demoArmed = false
  function armDemo() {
    if (demoArmed || !video) return
    demoArmed = true
    ensureSrc(video, HERO_VIDEO_SRC)
  }

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
      if (vignette) vignette.style.opacity = '0'
      if (beat) beat.style.opacity = '0'
      if (ghost) ghost.style.opacity = '0'
      pin.classList.remove('is-settled')
      if (video && p < aEnd) video.pause()
      return
    }

    const titleT = range(a, 0, 0.58)
    const restT = range(a, 0.1, 0.82)
    const ctaT = range(a, 0.18, 0.92)
    fadeEl(exits.title, 1 - titleT, -64 * titleT)
    fadeEl(exits.badge, 1 - restT, -36 * restT)
    fadeEl(exits.sub, 1 - restT, -44 * restT)
    fadeEl(exits.cta, 1 - ctaT, -28 * ctaT)
    fadeEl(exits.plat, 1 - restT, -32 * restT)
    if (p >= aEnd) {
      Object.values(exits).forEach((el) => fadeEl(el, 0, -40))
    }

    const cardT = a
    placeCards(cards, cardT, p >= aEnd ? 0 : Math.max(0, 1 - cardT * 1.35), 1 - 0.18 * cardT)

    const beatPeak = b < 0.5 ? b * 2 : (1 - b) * 2
    if (beat) beat.style.opacity = String(p < aEnd ? 0 : (p > bEnd ? Math.max(0, 1 - c * 2) * 0.25 : beatPeak))
    if (ghost) {
      const ghostOp = p >= aEnd && p < bEnd ? Math.max(0.18, beatPeak * 0.42) : 0
      ghost.style.opacity = String(ghostOp)
    }

    const showDemo = p >= bEnd
    demo.style.opacity = String(showDemo ? range(p, bEnd, bEnd + 0.06) : 0)
    frame.style.filter = 'none'
    const scale = 1.18 - 0.18 * c
    frame.style.transform = `scale(${scale})`
    if (vignette) vignette.style.opacity = String(c > 0 ? 1 - c * 0.75 : 0)

    const settled = p >= cEnd
    pin.classList.toggle('is-settled', settled)
    if (video) {
      if (p > 0.02) armDemo()
      if (p >= bEnd - 0.04) {
        armDemo()
        video.muted = true
        if (!demoUserPaused) safePlay(video)
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
  video.setAttribute('preload', 'none')
  video.style.filter = 'none'
  frame.setAttribute('tabindex', '0')
  if (reduceMotion() || !document.getElementById('hero-pin')) {
    lazyAutoplay(video, HERO_VIDEO_SRC, { shouldPlay: () => !demoUserPaused })
  }
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

function mountLoved() {
  const track = document.getElementById('loved-track')
  const files = [...new Set(window.VIDSO_TRUSTED_CREATOR_FILES || [])].slice(0, 5)
  const base = window.VIDSO_R2_BASE || ''
  if (!track || !base || !files.length) return
  const imgs = files.map((f, i) =>
    `<img src="${base}/${f}" alt="" width="52" height="52" loading="${i < 5 ? 'eager' : 'lazy'}" decoding="async">`
  ).join('')
  track.classList.add('is-static')
  track.innerHTML = `<div class="loved-set">${imgs}</div>`
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
      <div class="shorts-shot is-blank" data-poster="${c.poster}" data-src="${c.src}"></div>
      <div class="shorts-ico" aria-hidden="true">${icon}</div>
      <div class="shorts-lab">${c.category}</div>
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
    const compact = window.innerWidth < 760
    const gap = compact ? 92 : 168
    items.forEach((el, i) => {
      let off = i - idx
      if (off > n / 2) off -= n
      if (off < -n / 2) off += n
      const lift = Math.abs(off) * (compact ? -10 : -16)
      const rot = off * (compact ? 8 : 12)
      const rotY = off * (compact ? 10 : 16)
      el.style.transform = `translate3d(${off * gap}px, ${18 + lift}px, 0) rotate(${rot}deg) rotateY(${rotY}deg)`
      el.style.zIndex = String(20 - Math.abs(off))
      el.style.opacity = Math.abs(off) > (compact ? 1.6 : 2.4) ? '0' : '1'
      el.style.pointerEvents = Math.abs(off) > 2 ? 'none' : 'auto'
      el.classList.toggle('is-on', off === 0)
    })
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
        <div class="cover-prompt"><p>${c.prompt}</p><a class="btn btn-primary btn-glow" href="${CREATE_HREF}"><span class="btn-ring" aria-hidden="true"></span>Create Now</a></div>`
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

function fillFeatPanel(host, src, poster, start) {
  if (!host) return
  if (src) {
    host.innerHTML = `<video muted loop playsinline preload="none" poster="${poster || ''}"></video>`
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
  fitHeadings()
  window.addEventListener('resize', fitHeadings, { passive: true })
  mountLoved()
  mountShorts()
  mountPrompt()
  mountShowcase()
  mountVoiceover()
  mountChat()
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
}
