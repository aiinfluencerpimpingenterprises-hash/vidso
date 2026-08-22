/**
 * Landing-page proof screenshots. Render is driven by `RESULTS.length`.
 *
 * @typedef {Object} Result
 * @property {string} id
 * @property {string} src
 * @property {string} alt
 * @property {string} [channel]
 * @property {string} [niche]
 * @property {string} [metric]
 */

/** Native pixel size of proof.png — keep in sync so layout is reserved. */
const IMG_W = 1659
const IMG_H = 948

/** @type {Result[]} */
export const RESULTS = [
  {
    id: 'studio-overview-1',
    src: 'https://pub-f40c956471ff49feab622906892ec527.r2.dev/proof.png',
    alt: 'YouTube Studio channel analytics overview showing 248.9 million views, 18.2 million hours of watch time, and $281,904.47 estimated revenue on a daily revenue chart',
    metric: '248.9M views · 18.2M watch hours · $281,904 estimated revenue',
  },
]

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;')
}

function cardHtml(item, sizes) {
  const bits = []
  if (item.channel) bits.push(`<span class="results-meta-ch">${esc(item.channel)}</span>`)
  if (item.niche) bits.push(`<span>${esc(item.niche)}</span>`)
  if (item.metric) bits.push(`<span>${esc(item.metric)}</span>`)
  const meta = bits.length
    ? `<span class="results-meta">${bits.join('<span class="results-meta-dot" aria-hidden="true"> · </span>')}</span>`
    : ''
  return `
    <button type="button" class="results-card" data-result-id="${esc(item.id)}" aria-haspopup="dialog">
      <img
        src="${esc(item.src)}"
        alt="${esc(item.alt)}"
        width="${IMG_W}"
        height="${IMG_H}"
        sizes="${esc(sizes)}"
        loading="lazy"
        decoding="async"
      />
      ${meta}
    </button>`
}

function ensureLightbox() {
  let lb = document.getElementById('results-lb')
  if (lb) return lb
  const wrap = document.createElement('div')
  wrap.innerHTML = `
    <div class="results-lb" id="results-lb" hidden role="dialog" aria-modal="true" aria-labelledby="results-lb-title">
      <p id="results-lb-title" class="sr-only">Channel analytics screenshot</p>
      <button type="button" class="results-lb-close" id="results-lb-close" aria-label="Close screenshot">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
      <button type="button" class="results-lb-nav" id="results-lb-prev" aria-label="Previous screenshot" hidden>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>
      </button>
      <img id="results-lb-img" alt="" width="${IMG_W}" height="${IMG_H}" />
      <button type="button" class="results-lb-nav" id="results-lb-next" aria-label="Next screenshot" hidden>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>
      </button>
    </div>`
  lb = wrap.firstElementChild
  document.body.appendChild(lb)
  return lb
}

function removeLightbox() {
  const lb = document.getElementById('results-lb')
  if (lb) lb.remove()
  document.body.classList.remove('results-lb-open')
}

function focusables(root) {
  return [...root.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
    .filter((el) => !el.hasAttribute('hidden') && !el.disabled && el.getAttribute('aria-hidden') !== 'true')
}

/**
 * @param {HTMLElement | null} mount
 * @param {Result[]} [items]
 */
export function mountResults(mount, items = RESULTS) {
  if (!mount) return
  const list = Array.isArray(items) ? items : []
  if (!list.length) {
    mount.replaceChildren()
    removeLightbox()
    return
  }

  const multi = list.length >= 2
  const sizes = multi
    ? '(max-width: 720px) 85vw, (max-width: 1024px) 46vw, 360px'
    : '(max-width: 940px) calc(100vw - 48px), 900px'

  const slides = list.map((item) => `<div class="results-slide">${cardHtml(item, sizes)}</div>`).join('')
  const arrows = multi
    ? `<div class="results-arrows">
        <button type="button" class="results-arrow" data-dir="-1" aria-label="Previous results">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>
        </button>
        <button type="button" class="results-arrow" data-dir="1" aria-label="Next results">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>
        </button>
      </div>`
    : ''
  const dots = multi
    ? `<div class="results-dots" role="tablist" aria-label="Result slides">${list.map((_, i) =>
        `<button type="button" class="results-dot${i === 0 ? ' is-on' : ''}" data-i="${i}" role="tab" aria-label="Show result ${i + 1}" aria-selected="${i === 0 ? 'true' : 'false'}"></button>`
      ).join('')}</div>`
    : ''

  mount.innerHTML = `
    <section class="results${multi ? ' is-multi' : ' is-single'}" id="results" aria-labelledby="results-heading">
      <div class="wrap">
        <div class="s-head center">
          <h2 id="results-heading">Some of our results</h2>
          <p>Real channel analytics from creators using Vidso.</p>
        </div>
        <div class="results-frame">
          ${arrows}
          <div class="results-track">${slides}</div>
        </div>
        ${dots}
      </div>
    </section>`

  const track = mount.querySelector('.results-track')
  const lb = ensureLightbox()
  const lbImg = lb.querySelector('#results-lb-img')
  const lbTitle = lb.querySelector('#results-lb-title')
  const lbClose = lb.querySelector('#results-lb-close')
  const lbPrev = lb.querySelector('#results-lb-prev')
  const lbNext = lb.querySelector('#results-lb-next')
  let lbIndex = 0
  /** @type {HTMLElement | null} */
  let lastTrigger = null

  function slideWidth() {
    const slide = track.querySelector('.results-slide')
    if (!slide) return track.clientWidth
    const styles = getComputedStyle(track)
    const gap = parseFloat(styles.columnGap || styles.gap || '0') || 0
    return slide.getBoundingClientRect().width + gap
  }

  function syncDots() {
    if (!multi) return
    const i = Math.round(track.scrollLeft / Math.max(1, slideWidth()))
    const clamped = Math.max(0, Math.min(list.length - 1, i))
    mount.querySelectorAll('.results-dot').forEach((dot, di) => {
      const on = di === clamped
      dot.classList.toggle('is-on', on)
      dot.setAttribute('aria-selected', on ? 'true' : 'false')
    })
  }

  if (multi && track) {
    track.addEventListener('scroll', () => { requestAnimationFrame(syncDots) }, { passive: true })
    mount.querySelectorAll('.results-arrow').forEach((btn) => {
      btn.addEventListener('click', () => {
        const dir = Number(btn.dataset.dir) || 1
        track.scrollBy({ left: dir * slideWidth(), behavior: 'smooth' })
      })
    })
    mount.querySelectorAll('.results-dot').forEach((dot) => {
      dot.addEventListener('click', () => {
        const i = Number(dot.dataset.i) || 0
        track.scrollTo({ left: i * slideWidth(), behavior: 'smooth' })
      })
    })
  }

  function showLb(index) {
    lbIndex = (index + list.length) % list.length
    const item = list[lbIndex]
    lbImg.src = item.src
    lbImg.alt = item.alt
    lbTitle.textContent = item.alt
    const many = list.length >= 2
    lbPrev.hidden = !many
    lbNext.hidden = !many
    lb.hidden = false
    document.body.classList.add('results-lb-open')
    lbClose.focus()
  }

  function closeLb() {
    if (lb.hidden) return
    lb.hidden = true
    document.body.classList.remove('results-lb-open')
    if (lastTrigger && typeof lastTrigger.focus === 'function') lastTrigger.focus()
    lastTrigger = null
  }

  mount.querySelectorAll('.results-card').forEach((btn, i) => {
    btn.addEventListener('click', () => {
      lastTrigger = btn
      showLb(i)
    })
  })

  lbClose.addEventListener('click', closeLb)
  lb.addEventListener('click', (e) => { if (e.target === lb) closeLb() })
  lbPrev.addEventListener('click', (e) => { e.stopPropagation(); showLb(lbIndex - 1) })
  lbNext.addEventListener('click', (e) => { e.stopPropagation(); showLb(lbIndex + 1) })
  lbImg.addEventListener('click', (e) => e.stopPropagation())

  document.addEventListener('keydown', (e) => {
    if (lb.hidden) return
    if (e.key === 'Escape') { e.preventDefault(); closeLb(); return }
    if (e.key === 'ArrowLeft' && list.length >= 2) { e.preventDefault(); showLb(lbIndex - 1); return }
    if (e.key === 'ArrowRight' && list.length >= 2) { e.preventDefault(); showLb(lbIndex + 1); return }
    if (e.key !== 'Tab') return
    const nodes = focusables(lb)
    if (!nodes.length) return
    const first = nodes[0]
    const last = nodes[nodes.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  })
}
