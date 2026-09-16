import {
  HERO_CARDS,
  HERO_VIDEO_SRC,
  HERO_VIDEO_POSTER,
  IDEA_CARDS,
  SHOWCASE_CARDS,
  PROMPT_IDEAS,
  CREATE_HREF,
  VOICEOVER_SCRIPT,
  THUMBNAIL_DEMO_SRC,
} from './landing-media.js'
import { mountLandingIntegrations } from './landing-integrations.js'

const SCATTER = [
  { x: -42, y: -34, r: -9 },
  { x: 40, y: -30, r: 8 },
  { x: -48, y: 8, r: -6 },
  { x: 46, y: 4, r: 7 },
  { x: -28, y: 32, r: 5 },
  { x: 30, y: 34, r: -7 },
  { x: -8, y: -42, r: 4 },
  { x: 10, y: 42, r: -5 },
  { x: -36, y: -8, r: 10 },
  { x: 34, y: -12, r: -8 },
]
const STACK = [
  { x: -10, y: -6, r: -3 },
  { x: 8, y: -8, r: 2 },
  { x: -6, y: 8, r: 1 },
  { x: 10, y: 6, r: -2 },
  { x: -2, y: 12, r: 3 },
  { x: 4, y: -12, r: -1 },
  { x: -12, y: 2, r: 2 },
  { x: 12, y: 0, r: -3 },
  { x: 0, y: -2, r: 1 },
  { x: 2, y: 4, r: -1 },
]

const ICONS = {
  book: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>',
  list: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>',
  film: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M7 4v16M17 4v16M2 12h20"/></svg>',
  cam: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>',
  rank: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M8 21h8M12 17v4"/><path d="M7 4h10v4a5 5 0 01-10 0V4z"/></svg>',
  phone: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/></svg>',
  search: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>',
  atom: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="2"/><ellipse cx="12" cy="12" rx="10" ry="4"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)"/></svg>',
  chart: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M4 19V5M4 19h16"/><path d="M8 15l4-6 3 4 5-8"/></svg>',
  clock: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
}

const MUTE_SVG = '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M22 9l-6 6M16 9l6 6"/></svg>'
const UNMUTE_SVG = '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13"/></svg>'

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

function phHtml(label) {
  return `<div class="ph-card" aria-hidden="true"><span>${label}</span></div>`
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

function mountHero() {
  const root = document.getElementById('hero-cards')
  if (!root) return
  root.innerHTML = HERO_CARDS.map((c, i) => {
    const kind = c.type === 'short' ? 'short' : 'long'
    const label = kind === 'short' ? '9:16' : '16:9'
    const media = c.src
      ? `<video muted loop playsinline preload="none" poster="${c.poster || ''}" data-src="${c.src}"></video>`
      : phHtml(label)
    return `<div class="hero-card is-${kind}" data-i="${i}"><div class="hero-card-inner">${media}</div></div>`
  }).join('')
  root.querySelectorAll('video[data-src]').forEach((v) => lazyAutoplay(v, v.getAttribute('data-src')))

  const cards = [...root.querySelectorAll('.hero-card')]
  const apply = (t) => {
    cards.forEach((el, i) => {
      const a = SCATTER[i] || SCATTER[0]
      const b = STACK[i] || STACK[0]
      const x = a.x + (b.x - a.x) * t
      const y = a.y + (b.y - a.y) * t
      const r = a.r + (b.r - a.r) * t
      el.style.transform = `translate(calc(-50% + ${x}vw), calc(-50% + ${y}vh)) rotate(${r}deg)`
    })
  }
  apply(0)
  if (reduceMotion() || isTouch()) {
    apply(0.2)
    return
  }
  const gsap = window.gsap
  const ST = window.ScrollTrigger
  if (gsap && ST) {
    const obj = { t: 0 }
    gsap.to(obj, {
      t: 1,
      ease: 'none',
      scrollTrigger: {
        trigger: '.hero-lp',
        start: 'top top',
        end: '+=70%',
        scrub: true,
      },
      onUpdate: () => apply(obj.t),
    })
  } else {
    const onScroll = () => {
      const hero = document.querySelector('.hero-lp')
      if (!hero) return
      const rect = hero.getBoundingClientRect()
      const t = Math.max(0, Math.min(1, -rect.top / Math.max(1, rect.height * 0.7)))
      apply(t)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
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
  lazyAutoplay(video, HERO_VIDEO_SRC)
  if (isTouch()) frame.classList.add('is-touch')

  const cur = document.getElementById('demo-cur')
  const dur = document.getElementById('demo-dur')
  const range = document.getElementById('demo-range')
  const pauseBtn = document.getElementById('demo-pause')
  const backBtn = document.getElementById('demo-back')
  const fwdBtn = document.getElementById('demo-fwd')
  const mute = document.getElementById('demo-mute')
  let seeking = false

  function paint() {
    const d = video.duration || 0
    const c = video.currentTime || 0
    if (cur) cur.textContent = fmtTime(c)
    if (dur) dur.textContent = fmtTime(d)
    if (range && d) {
      const pct = (c / d) * 100
      if (!seeking) range.value = String(pct)
      range.style.background = 'linear-gradient(90deg,var(--a1) ' + pct + '%,rgba(255,255,255,.22) ' + pct + '%)'
    }
    if (pauseBtn) {
      pauseBtn.classList.toggle('is-paused', video.paused)
      pauseBtn.setAttribute('aria-label', video.paused ? 'Play video' : 'Pause video')
    }
    if (mute) syncMuteBtn(mute, video)
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
  range?.addEventListener('pointerdown', (e) => { e.stopPropagation(); seeking = true })
  range?.addEventListener('input', () => {
    const d = video.duration || 0
    video.currentTime = d * (Number(range.value) / 100)
  })
  range?.addEventListener('pointerup', () => { seeking = false })
  mute?.addEventListener('click', (e) => {
    e.stopPropagation()
    markInteracted()
    video.muted = !video.muted
    if (!video.muted) {
      if (audioOwner && audioOwner !== video) audioOwner.muted = true
      audioOwner = video
    } else if (audioOwner === video) {
      audioOwner = null
    }
    syncMuteBtn(mute, video)
  })
  document.getElementById('demo-ctrl')?.addEventListener('click', (e) => e.stopPropagation())
  document.getElementById('demo-ctrl')?.addEventListener('pointerenter', () => frame.classList.add('is-over-ctrl'))
  document.getElementById('demo-ctrl')?.addEventListener('pointerleave', () => frame.classList.remove('is-over-ctrl'))

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
    location.href = CREATE_HREF
  })
}

function mountLoved() {
  const track = document.getElementById('loved-track')
  const files = window.VIDSO_TRUSTED_CREATOR_FILES || []
  const base = window.VIDSO_R2_BASE || ''
  if (!track || !base || !files.length) return
  const imgs = files.concat(files).map((f, i) =>
    `<img src="${base}/${f}" alt="" width="56" height="56" loading="${i < 5 ? 'eager' : 'lazy'}" decoding="async">`
  ).join('')
  track.innerHTML = imgs
  if (reduceMotion()) track.style.animation = 'none'
}

function mountIdeas() {
  const row = document.getElementById('ideas-row')
  if (!row) return
  const doubled = IDEA_CARDS.concat(IDEA_CARDS)
  row.innerHTML = doubled.map((c, i) => {
    const media = c.src
      ? `<img src="${c.poster || ''}" alt="" loading="lazy">${c.poster ? '' : ''}<video muted playsinline preload="none" poster="${c.poster || ''}" data-src="${c.src}"></video>`
      : phHtml(c.aspect === 'short' ? '9:16' : '16:9')
    const n = doubled.length
    const mid = (n - 1) / 2
    const tilt = ((i - mid) / mid) * 12
    return `<button type="button" class="idea-card" data-i="${i % IDEA_CARDS.length}" style="--tilt:${tilt}deg">
      <div class="idea-shot">${media}${c.src ? muteBtn() : ''}</div>
      <div class="idea-meta">${ICONS[c.icon] || ''}<span>${c.category}</span></div>
    </button>`
  }).join('')

  let idx = 0
  let timer
  const stepW = 226
  function paint() {
    row.scrollTo({ left: idx * stepW, behavior: reduceMotion() ? 'auto' : 'smooth' })
  }
  function next(dir) {
    idx = (idx + dir + IDEA_CARDS.length) % IDEA_CARDS.length
    paint()
  }
  function start() {
    if (reduceMotion()) return
    stop()
    timer = setInterval(() => next(1), 2800)
  }
  function stop() { if (timer) clearInterval(timer) }
  document.querySelector('[data-ideas-prev]')?.addEventListener('click', () => { stop(); next(-1); start() })
  document.querySelector('[data-ideas-next]')?.addEventListener('click', () => { stop(); next(1); start() })
  const touch = isTouch()
  row.querySelectorAll('.idea-card').forEach((card) => {
    const video = card.querySelector('video')
    const src = video?.getAttribute('data-src')
    bindMute(card, video)
    if (!touch) {
      card.addEventListener('pointerenter', () => {
        stop()
        if (video && src) playHover(video, src)
      })
      card.addEventListener('pointerleave', () => {
        if (video) pauseReset(video)
        start()
      })
    }
    card.addEventListener('click', (e) => {
      if (e.target.closest('[data-mute]')) return
      if (touch && video && src) {
        e.preventDefault()
        stop()
        if (video.paused || video.ended) playHover(video, src)
        else pauseReset(video)
        return
      }
      location.href = CREATE_HREF
    })
  })
  start()
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
  function tick() {
    const s = PROMPT_IDEAS[i]
    pos += dir
    if (dir === 1 && pos >= s.length) {
      dir = -1
      setTimeout(tick, 1400)
      return
    }
    if (dir === -1 && pos <= 0) {
      dir = 1
      i = (i + 1) % PROMPT_IDEAS.length
    }
    el.innerHTML = s.slice(0, Math.max(0, pos)) + '<span class="caret"></span>'
    setTimeout(tick, dir === 1 ? 42 : 22)
  }
  tick()
}

function mountShowcase() {
  const root = document.getElementById('coverflow')
  if (!root) return
  let active = 0
  function render() {
    root.querySelectorAll('.cover-card').forEach((n) => n.remove())
    SHOWCASE_CARDS.forEach((c, i) => {
      const off = i - active
      const el = document.createElement('article')
      el.className = 'cover-card'
      el.style.zIndex = String(20 - Math.abs(off))
      el.style.opacity = Math.abs(off) > 2 ? '0' : String(1 - Math.abs(off) * 0.28)
      el.style.pointerEvents = Math.abs(off) > 2 ? 'none' : 'auto'
      el.style.transform = `translateX(calc(-50% + ${off * 38}%)) scale(${1 - Math.abs(off) * 0.14}) rotateY(${off * -18}deg)`
      const media = c.src
        ? `<img src="${c.poster || ''}" alt="" loading="lazy">${i === active ? `<video muted loop playsinline preload="none" poster="${c.poster || ''}" data-src="${c.src}"></video>` : ''}`
        : phHtml('16:9')
      el.innerHTML = `<span class="cover-badge">${c.category}</span>${media}${c.src ? muteBtn() : ''}
        <div class="cover-prompt"><p>${c.prompt}</p><a class="btn btn-primary" href="${CREATE_HREF}">Create Now</a></div>`
      const video = el.querySelector('video')
      bindMute(el, video)
      if (video && i === active && c.src) lazyAutoplay(video, c.src)
      el.addEventListener('click', (e) => {
        if (e.target.closest('a, [data-mute]')) return
        if (off !== 0) { active = i; render() }
      })
      root.appendChild(el)
    })
  }
  document.querySelector('[data-show-prev]')?.addEventListener('click', () => {
    active = (active - 1 + SHOWCASE_CARDS.length) % SHOWCASE_CARDS.length
    render()
  })
  document.querySelector('[data-show-next]')?.addEventListener('click', () => {
    active = (active + 1) % SHOWCASE_CARDS.length
    render()
  })
  let sx = 0
  root.addEventListener('touchstart', (e) => { sx = e.changedTouches[0].clientX }, { passive: true })
  root.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - sx
    if (Math.abs(dx) < 40) return
    active = (active + (dx < 0 ? 1 : -1) + SHOWCASE_CARDS.length) % SHOWCASE_CARDS.length
    render()
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

function mountThumbDemo() {
  const host = document.getElementById('thumb-demo')
  if (!host) return
  if (!THUMBNAIL_DEMO_SRC) return
  host.innerHTML = `<video muted loop playsinline preload="none"></video>`
  lazyAutoplay(host.querySelector('video'), THUMBNAIL_DEMO_SRC)
}

export function mountLandingPage() {
  document.addEventListener('pointerdown', markInteracted, { passive: true })
  document.addEventListener('keydown', markInteracted)
  mountHero()
  mountDemo()
  mountLoved()
  mountIdeas()
  mountPrompt()
  mountShowcase()
  mountVoiceover()
  mountChat()
  mountWhyTabs()
  mountThumbDemo()
  mountLandingIntegrations()
}
