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

function paintDepth(track, translateY, viewportHeight, itemHeight) {
  const center = viewportHeight / 2
  const kids = track.children
  for (let i = 0; i < kids.length; i++) {
    const el = kids[i]
    const mid = i * itemHeight + itemHeight / 2 + translateY
    const norm = (mid - center) / Math.max(itemHeight, viewportHeight / 2.4)
    const signed = Math.max(-1.6, Math.min(1.6, norm))
    const abs = Math.abs(signed)
    const winCenter = el.classList.contains('is-win') && abs < 0.28
    el.style.opacity = String(winCenter ? 1 : Math.max(0.12, 1 - abs * 0.72))
    el.style.filter = winCenter ? 'none' : `blur(${Math.min(7, abs * 3.4)}px)`
    el.style.transform = winCenter
      ? 'rotateX(0deg) scale(1.03)'
      : `rotateX(${(-signed * 42).toFixed(2)}deg) scale(${(1 - abs * 0.07).toFixed(3)})`
    el.classList.toggle('is-center', abs < 0.38)
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
      return `<div class="hustle-spin-item${win}" data-label="${label}">${label}</div>`
    })
    .join('')

  const duration = opts.duration ?? 5200
  const live = root.querySelector('[data-hustle-live]')
  let raf = 0
  let spinning = false
  let parked = false

  function announce() {
    if (live) live.textContent = reel.winner
    root.setAttribute('aria-label', reel.winner)
    root.classList.toggle('is-landed', true)
    const winEl = track.children[reel.winnerIndex]
    if (winEl) winEl.classList.add('is-center', 'is-win')
  }

  function measure() {
    const vh = viewport.clientHeight || root.clientHeight || 480
    const ih = rowHeight(track, Number.parseFloat(getComputedStyle(root).getPropertyValue('--hustle-row')) || 88)
    return { vh, ih, stop: targetOffset(ih, reel.winnerIndex, vh) }
  }

  function goTo(y, blur) {
    const { vh, ih } = measure()
    track.style.transform = `translate3d(0, ${-y}px, 0)`
    track.style.filter = blur ? `blur(${blur}px)` : ''
    paintDepth(track, -y, vh, ih)
  }

  function landInstant() {
    spinning = false
    parked = true
    const { stop } = measure()
    goTo(stop, 0)
    announce()
  }

  function spin() {
    if (spinning) return
    if (prefersReducedMotion()) {
      landInstant()
      return
    }
    spinning = true
    root.classList.remove('is-landed')
    const { stop } = measure()
    const start = performance.now()
    const from = 0
    cancelAnimationFrame(raf)

    function frame(now) {
      const t = Math.min(1, (now - start) / duration)
      const eased = easeOutSlot(t)
      const y = from + (stop - from) * eased
      const vel = (1 - t) * 18
      goTo(y, t < 0.82 ? Math.min(6, vel * 0.28) : 0)
      if (t < 1) {
        raf = requestAnimationFrame(frame)
        return
      }
      spinning = false
      parked = true
      goTo(stop, 0)
      announce()
    }
    raf = requestAnimationFrame(frame)
  }

  const onClick = () => {
    if (spinning) return
    spin()
  }
  root.addEventListener('click', onClick)

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
      if (ro) ro.disconnect()
    },
  }
}
