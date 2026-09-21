import { LANDING_R2, MCP_CHAT_MEDIA, MCP_FEATURE_MEDIA, R2 } from './landing-media.js?v=d1f82'

function reduceMotion() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch (_) { return false }
}

let audioUnlocked = false
function unlockMediaAudio() { audioUnlocked = true }
if (typeof window !== 'undefined' && !window.__vidsoMcpAudioBound) {
  window.__vidsoMcpAudioBound = true
  window.addEventListener('pointerdown', unlockMediaAudio, { capture: true, passive: true })
  window.addEventListener('keydown', unlockMediaAudio, { capture: true })
}

function slotVisible(card) {
  if (!card || card.hidden) return false
  if (card.closest('[hidden]')) return false
  const pane = card.closest('[data-mcp-feat-pane]')
  if (pane && !pane.classList.contains('is-on')) return false
  return card.dataset.onScreen !== '0'
}

function playSlotVideo(video) {
  if (!video) return
  try {
    const p = video.play()
    if (p && typeof p.catch === 'function') p.catch(() => {})
  } catch (_) {}
}

function bindLoopSeconds(video, seconds) {
  if (!video || !(seconds > 0)) return
  const restart = () => {
    const dur = Number(video.duration)
    if (Number.isFinite(dur) && dur <= seconds + 1.5) return
    if (video.currentTime >= seconds) {
      try { video.currentTime = 0.05 } catch (_) {}
      playSlotVideo(video)
    }
  }
  video.addEventListener('timeupdate', restart)
  video.addEventListener('ended', () => {
    try { video.currentTime = 0 } catch (_) {}
    playSlotVideo(video)
  })
}

function bindHoverAudio(host, video) {
  if (!host || !video) return
  host.classList.add('is-hover-audio')
  const unmute = () => {
    if (!audioUnlocked) return
    video.muted = false
    playSlotVideo(video)
  }
  const mute = () => { video.muted = true }
  host.addEventListener('pointerenter', unmute)
  host.addEventListener('pointerleave', mute)
  host.addEventListener('pointerdown', () => {
    unlockMediaAudio()
    unmute()
  })
  host.addEventListener('focusin', unmute)
  host.addEventListener('focusout', mute)
}

function watchSlotVideo(card, video) {
  const sync = () => {
    if (reduceMotion()) {
      video.pause()
      video.muted = true
      return
    }
    if (slotVisible(card)) playSlotVideo(video)
    else {
      video.pause()
      video.muted = true
    }
  }
  const io = new IntersectionObserver((entries) => {
    card.dataset.onScreen = entries.some((e) => e.isIntersecting) ? '1' : '0'
    sync()
  }, { threshold: 0.15 })
  io.observe(card)
  const mo = new MutationObserver(sync)
  mo.observe(card, { attributes: true, attributeFilter: ['hidden'] })
  const pane = card.closest('[data-mcp-feat-pane]')
  if (pane) mo.observe(pane, { attributes: true, attributeFilter: ['class', 'hidden'] })
  video.addEventListener('loadeddata', () => {
    card.classList.remove('is-blank')
    sync()
  })
}

function mountSlotVideo(card, urls) {
  let i = 0
  const v = document.createElement('video')
  v.muted = true
  v.defaultMuted = true
  v.loop = true
  v.playsInline = true
  v.preload = 'auto'
  v.controls = false
  v.disablePictureInPicture = true
  v.setAttribute('muted', '')
  v.setAttribute('playsinline', '')
  v.setAttribute('webkit-playsinline', '')
  v.src = urls[0]
  v.addEventListener('error', () => {
    i += 1
    if (i < urls.length) v.src = urls[i]
    else v.remove()
  })
  const loopS = Number(card.getAttribute('data-mcp-loop-seconds')) || 0
  bindLoopSeconds(v, loopS)
  if (card.hasAttribute('data-mcp-hover-audio')) bindHoverAudio(card, v)
  card.appendChild(v)
  watchSlotVideo(card, v)
}

function wait(ms, signal) {
  return new Promise((resolve) => {
    const t = window.setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => { window.clearTimeout(t); resolve() }, { once: true })
  })
}

export function fillMediaSlot(card) {
  if (!card || card.querySelector('img,video')) return
  const file = card.getAttribute('data-mcp-file')
  const ext = card.getAttribute('data-mcp-ext') || ''
  if (!file) return
  const withExt = /\.[a-z0-9]+$/i.test(file) ? file : file + (ext ? '.' + ext : '.jpg')
  const urls = [R2 + '/' + withExt, LANDING_R2 + '/' + withExt]
  if (ext === 'mp4' || /\.mp4$/i.test(withExt)) {
    mountSlotVideo(card, urls)
    return
  }
  const img = document.createElement('img')
  let i = 0
  img.alt = ''
  img.decoding = 'async'
  img.loading = 'lazy'
  img.src = urls[0]
  img.addEventListener('error', () => {
    i += 1
    if (i < urls.length) img.src = urls[i]
    else img.remove()
  })
  img.addEventListener('load', () => card.classList.remove('is-blank'))
  card.appendChild(img)
}

export function fillAllMediaSlots(root = document) {
  root.querySelectorAll('[data-mcp-file]').forEach(fillMediaSlot)
  MCP_FEATURE_MEDIA.forEach((rec) => {
    root.querySelectorAll(`[data-mcp-file="${rec.file}"]`).forEach(fillMediaSlot)
  })
  MCP_CHAT_MEDIA.forEach((rec) => {
    root.querySelectorAll(`[data-mcp-file="${rec.file}"]`).forEach(fillMediaSlot)
  })
}

async function typeInto(el, text, signal, speed = 16) {
  if (!el) return
  el.textContent = ''
  if (reduceMotion()) {
    el.textContent = text
    return
  }
  for (let i = 0; i < text.length; i++) {
    if (signal.aborted) return
    el.textContent = text.slice(0, i + 1)
    await wait(speed, signal)
  }
}

function setFinal(root, kind) {
  root.querySelectorAll('[data-mcp-type]').forEach((el) => {
    el.textContent = el.getAttribute('data-mcp-full') || el.textContent
  })
  root.querySelectorAll('[data-mcp-step]').forEach((el) => { el.hidden = false })
  root.querySelectorAll('[data-mcp-reveal]').forEach((el) => { el.hidden = false })
  root.querySelectorAll('[data-mcp-dots]').forEach((el) => { el.hidden = true })
  root.classList.add('is-done')
  root.dataset.mcpKind = kind
}

async function playLongform(root, signal) {
  const type = root.querySelector('[data-mcp-type]')
  const full = type?.getAttribute('data-mcp-full') || ''
  const dots = root.querySelector('[data-mcp-dots]')
  const steps = [...root.querySelectorAll('[data-mcp-step]')]
  const result = root.querySelector('[data-mcp-reveal]')
  const keepVideo = result?.querySelector('video')
  steps.forEach((el) => { el.hidden = true })
  if (result && !keepVideo) result.hidden = true
  if (dots) dots.hidden = true
  root.classList.remove('is-done')
  await typeInto(type, full, signal)
  if (signal.aborted) return
  if (dots) dots.hidden = false
  await wait(700, signal)
  if (dots) dots.hidden = true
  for (const step of steps) {
    if (signal.aborted) return
    step.hidden = false
    await wait(420, signal)
  }
  if (result) {
    result.hidden = false
    playSlotVideo(result.querySelector('video'))
  }
  if (keepVideo) {
    if (signal.aborted) return
    await new Promise((resolve) => {
      signal.addEventListener('abort', resolve, { once: true })
    })
    return
  }
  await wait(2800, signal)
}

async function playClips(root, signal) {
  const type = root.querySelector('[data-mcp-type]')
  const full = type?.getAttribute('data-mcp-full') || ''
  const cards = [...root.querySelectorAll('[data-mcp-reveal]')]
  cards.forEach((el) => { el.hidden = true })
  await typeInto(type, full, signal)
  for (const card of cards) {
    if (signal.aborted) return
    card.hidden = false
    await wait(380, signal)
  }
  await wait(2400, signal)
}

async function playThumbs(root, signal) {
  const type = root.querySelector('[data-mcp-type]')
  const full = type?.getAttribute('data-mcp-full') || ''
  const grid = root.querySelector('[data-mcp-reveal]')
  if (grid) grid.hidden = true
  root.classList.remove('is-done')
  await typeInto(type, full, signal)
  if (grid) grid.hidden = false
  await wait(900, signal)
  root.classList.add('is-done')
  await wait(2200, signal)
}

async function playAudio(root, signal) {
  const type = root.querySelector('[data-mcp-type]')
  const full = type?.getAttribute('data-mcp-full') || ''
  const caps = root.querySelector('[data-mcp-caption]')
  const words = (caps?.getAttribute('data-mcp-full') || '').split(' ')
  if (caps) caps.textContent = ''
  root.classList.remove('is-done')
  await typeInto(type, full, signal)
  root.classList.add('is-done')
  if (!reduceMotion() && caps) {
    for (let i = 0; i < words.length; i++) {
      if (signal.aborted) return
      caps.textContent = words.slice(0, i + 1).join(' ')
      await wait(160, signal)
    }
  } else if (caps) {
    caps.textContent = words.join(' ')
  }
  await wait(2200, signal)
}

async function playFiles(root, signal) {
  const type = root.querySelector('[data-mcp-type]')
  const full = type?.getAttribute('data-mcp-full') || ''
  const cards = [...root.querySelectorAll('[data-mcp-reveal]')]
  cards.forEach((el) => { el.hidden = true })
  await typeInto(type, full, signal)
  for (const card of cards) {
    if (signal.aborted) return
    card.hidden = false
    await wait(180, signal)
  }
  await wait(2400, signal)
}

async function playConnect(root, signal) {
  const rows = [...root.querySelectorAll('[data-mcp-step]')]
  rows.forEach((el) => { el.hidden = true })
  for (const row of rows) {
    if (signal.aborted) return
    row.hidden = false
    await wait(220, signal)
  }
  await wait(2400, signal)
}

const PLAYERS = {
  longform: playLongform,
  clips: playClips,
  thumbs: playThumbs,
  audio: playAudio,
  files: playFiles,
  connect: playConnect,
  ask: playLongform,
}

function playMock(root, signal) {
  const kind = root.getAttribute('data-mcp-mock') || 'longform'
  if (reduceMotion()) {
    setFinal(root, kind)
    return Promise.resolve()
  }
  const play = PLAYERS[kind] || playLongform
  return play(root, signal)
}

function loopMock(root, live) {
  let ctrl = new AbortController()
  let running = false

  async function cycle() {
    if (running || !live()) return
    running = true
    ctrl.abort()
    ctrl = new AbortController()
    const signal = ctrl.signal
    try {
      await playMock(root, signal)
      if (!signal.aborted && live() && !reduceMotion()) cycle()
    } finally {
      running = false
    }
  }

  function stop() {
    ctrl.abort()
    running = false
  }

  function start() {
    if (reduceMotion()) {
      setFinal(root, root.getAttribute('data-mcp-mock'))
      return
    }
    if (!live()) return
    cycle()
  }

  return { start, stop }
}

export function mountFeatureMocks(root = document) {
  const panes = [...root.querySelectorAll('[data-mcp-feat-pane]')]
  const loops = new Map()

  panes.forEach((pane) => {
    const mock = pane.querySelector('[data-mcp-mock]')
    if (!mock) return
    const id = pane.getAttribute('data-mcp-feat-pane')
    const io = new IntersectionObserver((entries) => {
      mock.dataset.onScreen = entries.some((e) => e.isIntersecting) ? '1' : '0'
      const loop = loops.get(id)
      if (!loop) return
      if (pane.classList.contains('is-on') && mock.dataset.onScreen === '1') loop.start()
      else loop.stop()
    }, { threshold: 0.2 })
    io.observe(mock)
    loops.set(id, loopMock(mock, () => pane.classList.contains('is-on') && mock.dataset.onScreen === '1'))
  })

  function sync() {
    panes.forEach((pane) => {
      const id = pane.getAttribute('data-mcp-feat-pane')
      const mock = pane.querySelector('[data-mcp-mock]')
      const loop = loops.get(id)
      if (!loop || !mock) return
      if (pane.classList.contains('is-on') && mock.dataset.onScreen !== '0') loop.start()
      else loop.stop()
    })
  }

  return { sync }
}

export function mountAskMock(root = document) {
  const host = root.querySelector('[data-mcp-ask-mock]')
  if (!host) return { show() {} }
  const type = host.querySelector('[data-mcp-type]')
  const result = host.querySelector('[data-mcp-reveal]')
  let ctrl = new AbortController()

  async function show(text) {
    ctrl.abort()
    ctrl = new AbortController()
    const signal = ctrl.signal
    if (type) type.setAttribute('data-mcp-full', text)
    if (result) result.hidden = false
    host.classList.remove('is-done')
    if (reduceMotion()) {
      if (type) type.textContent = text
      host.classList.add('is-done')
      return
    }
    await typeInto(type, text, signal)
    if (signal.aborted) return
    host.classList.add('is-done')
  }

  return { show }
}
