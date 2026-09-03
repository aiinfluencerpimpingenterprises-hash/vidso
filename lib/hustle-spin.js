/** Slot-machine reel of side hustles. The stop position is always the winner. */

export const HUSTLE_LABELS = [
  'AIRBNB ARBITRAGE',
  'PRINT ON DEMAND',
  'DROPSHIPPING',
  'YT KIDS CHANNEL',
  'META ADS',
  'TRADING',
  'WEBSITE DESIGN',
  'AMAZON FBA',
  'SMMA AGENCY',
  'TIKTOK SHOP',
]

export const HUSTLE_WINNER = 'FACELESS YT CHANNEL'

export function buildReel(opts = {}) {
  const labels = opts.labels || HUSTLE_LABELS
  const winner = opts.winner || HUSTLE_WINNER
  const loops = Math.max(1, opts.loops || 12)
  const tail = Math.max(0, opts.tail ?? 3)
  const items = []
  for (let i = 0; i < loops; i++) {
    items.push(...labels)
    items.push(winner)
  }
  const winnerIndex = items.length - 1
  items.push(...labels.slice(0, tail))
  return { items, winnerIndex, winner }
}

/** TranslateY that parks `winnerIndex` in the vertical center of the viewport. */
export function targetOffset(itemHeight, winnerIndex, viewportHeight) {
  const itemCenter = winnerIndex * itemHeight + itemHeight / 2
  return itemCenter - viewportHeight / 2
}

export function easeOutQuint(t) {
  const x = Math.min(1, Math.max(0, t))
  return 1 - Math.pow(1 - x, 5)
}

/** Fast cruise, then a hard slot-machine brake. */
export function easeOutSlot(t) {
  const x = Math.min(1, Math.max(0, t))
  if (x < 0.64) return (x * 0.8) / 0.64
  const u = (x - 0.64) / 0.36
  return 0.8 + 0.2 * (1 - Math.pow(1 - u, 4))
}

export function prefersReducedMotion(media = globalThis.matchMedia) {
  try {
    return Boolean(media && media('(prefers-reduced-motion: reduce)').matches)
  } catch {
    return false
  }
}

function rowHeight(track, fallback) {
  const first = track && track.firstElementChild
  const h = first ? first.getBoundingClientRect().height : 0
  return h > 0 ? h : fallback
}

/** Deep top/bottom fade — labels in the middle stay sharp. */
export function itemFace(mid, viewportHeight, itemHeight) {
  const edge = Math.min(mid, viewportHeight - mid)
  const fade = Math.max(itemHeight * 1.6, viewportHeight * 0.28)
  let opacity = 1
  if (edge <= 0) opacity = 0.08
  else if (edge < fade) opacity = 0.1 + 0.9 * (edge / fade)
  return { opacity, filter: 'none' }
}

export function createHustleAudio(AudioCtx) {
  const Ctor = AudioCtx === undefined
    ? globalThis.AudioContext || globalThis.webkitAudioContext
    : AudioCtx
  let ctx = null

  function ensure() {
    if (!Ctor) return null
    if (!ctx) ctx = new Ctor()
    if (ctx.state === 'suspended' && ctx.resume) ctx.resume()
    return ctx
  }

  function tick(rate = 1) {
    const ac = ensure()
    if (!ac) return false
    const t = ac.currentTime
    const osc = ac.createOscillator()
    const g = ac.createGain()
    osc.type = 'square'
    osc.frequency.value = 1180 + Math.max(0.2, rate) * 520
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.055 * Math.max(0.35, rate), t + 0.003)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.022)
    osc.connect(g).connect(ac.destination)
    osc.start(t)
    osc.stop(t + 0.024)
    return true
  }

  function land() {
    const ac = ensure()
    if (!ac) return false
    const t = ac.currentTime
    ;[
      [392, 0, 0.16],
      [587, 0.07, 0.22],
      [784, 0.14, 0.38],
    ].forEach(([freq, delay, dur]) => {
      const osc = ac.createOscillator()
      const g = ac.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      g.gain.setValueAtTime(0.0001, t + delay)
      g.gain.exponentialRampToValueAtTime(0.14, t + delay + 0.014)
      g.gain.exponentialRampToValueAtTime(0.0001, t + delay + dur)
      osc.connect(g).connect(ac.destination)
      osc.start(t + delay)
      osc.stop(t + delay + dur + 0.02)
    })
    return true
  }

  return { ensure, tick, land }
}

function paintDepth(track, translateY, viewportHeight, itemHeight) {
  const center = viewportHeight / 2
  const kids = track.children
  for (let i = 0; i < kids.length; i++) {
    const el = kids[i]
    const mid = i * itemHeight + itemHeight / 2 + translateY
    const face = itemFace(mid, viewportHeight, itemHeight)
    el.style.opacity = String(face.opacity)
    el.style.filter = 'none'
    el.style.transform = ''
    el.classList.toggle('is-center', Math.abs(mid - center) < itemHeight * 0.45)
  }
}

export function mountHustleSpin(root, opts = {}) {
  if (!root) return null
  const track = root.querySelector('[data-hustle-track]')
  const viewport = root.querySelector('.hustle-spin-viewport') || root
  if (!track) return null

  const reel = buildReel(opts)
  track.innerHTML = reel.items
    .map((label, i) => {
      const win = i === reel.winnerIndex ? ' is-win' : ''
      return `<div class="hustle-spin-item${win}" data-label="${label}"><span>${label}</span></div>`
    })
    .join('')

  const duration = opts.duration ?? 5200
  const live = root.querySelector('[data-hustle-live]')
  const audio = opts.audio || createHustleAudio()
  let raf = 0
  let spinning = false
  let parked = false
  let lastTick = -1

  function unlockAudio() {
    audio.ensure()
  }

  function announce() {
    if (live) live.textContent = reel.winner
    root.setAttribute('aria-label', reel.winner)
    root.classList.toggle('is-landed', true)
    const winEl = track.children[reel.winnerIndex]
    if (winEl) winEl.classList.add('is-center', 'is-win')
  }

  function pinMark() {
    const mark = root.querySelector('.hustle-spin-mark')
    if (!mark) return
    let max = 0
    track.querySelectorAll('.hustle-spin-item span').forEach((el) => {
      const w = el.getBoundingClientRect().width
      if (w > max) max = w
    })
    if (!max) return
    root.style.setProperty('--mark-out', `${Math.round(max / 2 + 22)}px`)
  }

  function measure() {
    const vh = viewport.clientHeight || root.clientHeight || 480
    const ih = rowHeight(track, Number.parseFloat(getComputedStyle(root).getPropertyValue('--hustle-row')) || 88)
    pinMark()
    return { vh, ih, stop: targetOffset(ih, reel.winnerIndex, vh) }
  }

  function goTo(y) {
    const { vh, ih } = measure()
    track.style.transform = `translate3d(0, ${-y}px, 0)`
    track.style.filter = 'none'
    paintDepth(track, -y, vh, ih)
    return { vh, ih }
  }

  function landInstant() {
    spinning = false
    parked = true
    const { stop } = measure()
    goTo(stop)
    announce()
  }

  function spin() {
    if (spinning) return
    if (prefersReducedMotion()) {
      landInstant()
      return
    }
    spinning = true
    lastTick = -1
    root.classList.remove('is-landed')
    unlockAudio()
    const { stop, ih } = measure()
    const start = performance.now()
    const from = 0
    cancelAnimationFrame(raf)

    function frame(now) {
      const t = Math.min(1, (now - start) / duration)
      const eased = easeOutSlot(t)
      const y = from + (stop - from) * eased
      const moved = goTo(y)
      const row = Math.floor(y / (moved.ih || ih) + 0.5)
      if (row !== lastTick) {
        lastTick = row
        audio.tick(1 - t * 0.55)
      }
      if (t < 1) {
        raf = requestAnimationFrame(frame)
        return
      }
      spinning = false
      parked = true
      goTo(stop)
      announce()
      audio.land()
    }
    raf = requestAnimationFrame(frame)
  }

  const onClick = () => {
    unlockAudio()
    if (spinning) return
    spin()
  }
  root.addEventListener('click', onClick)
  root.addEventListener('pointerdown', unlockAudio, { once: true })

  const ro = typeof ResizeObserver === 'function'
    ? new ResizeObserver(() => {
        if (!spinning && parked) landInstant()
      })
    : null
  if (ro) ro.observe(root)

  const start = () => spin()
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => requestAnimationFrame(start)).catch(start)
  } else {
    requestAnimationFrame(start)
  }

  return {
    reel,
    spin,
    destroy() {
      cancelAnimationFrame(raf)
      root.removeEventListener('click', onClick)
      root.removeEventListener('pointerdown', unlockAudio)
      if (ro) ro.disconnect()
    },
  }
}
