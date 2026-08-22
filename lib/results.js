/**
 * Landing-page proof screenshots. Render is driven by `RESULTS.length`.
 *
 * @typedef {Object} Result
 * @property {string} id
 * @property {string} src
 * @property {string} alt
 * @property {number} width
 * @property {number} height
 * @property {string} [channel]
 * @property {string} [niche]
 * @property {string} [metric]
 */

/** @type {Result[]} */
export const RESULTS = [
  {
    id: 'studio-overview-1',
    src: 'https://pub-f40c956471ff49feab622906892ec527.r2.dev/proof1.png',
    alt: 'YouTube Studio channel analytics showing 248.6 million views, 18.4 million hours of watch time, and $287,904.18 estimated revenue',
    width: 1717,
    height: 916,
    metric: '248.6M views · 18.4M watch hours · $287,904 estimated revenue',
  },
  {
    id: 'studio-overview-2',
    src: 'https://pub-f40c956471ff49feab622906892ec527.r2.dev/proof2.png',
    alt: 'YouTube Studio channel analytics showing 273.9 million views, 20.2 million hours of watch time, and $316,847.52 estimated revenue',
    width: 1720,
    height: 914,
    metric: '273.9M views · 20.2M watch hours · $316,848 estimated revenue',
  },
  {
    id: 'studio-overview-3',
    src: 'https://pub-f40c956471ff49feab622906892ec527.r2.dev/proof3.png',
    alt: 'YouTube Studio channel analytics showing 289.4 million views, 21.4 million hours of watch time, and $334,928.77 estimated revenue',
    width: 1983,
    height: 793,
    metric: '289.4M views · 21.4M watch hours · $334,929 estimated revenue',
  },
  {
    id: 'studio-overview-4',
    src: 'https://pub-f40c956471ff49feab622906892ec527.r2.dev/proof4.png',
    alt: 'YouTube Studio channel analytics showing 257.0 million views, 19.0 million hours of watch time, and $297,411.86 estimated revenue',
    width: 1720,
    height: 914,
    metric: '257.0M views · 19.0M watch hours · $297,412 estimated revenue',
  },
  {
    id: 'studio-overview-5',
    src: 'https://pub-f40c956471ff49feab622906892ec527.r2.dev/proof5.png',
    alt: 'YouTube Studio channel analytics showing 237.8 million views, 17.6 million hours of watch time, and $275,143.09 estimated revenue',
    width: 1719,
    height: 915,
    metric: '237.8M views · 17.6M watch hours · $275,143 estimated revenue',
  },
]

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;')
}

function cardHtml(item, sizes, index) {
  const bits = []
  if (item.channel) bits.push(`<span class="results-meta-ch">${esc(item.channel)}</span>`)
  if (item.niche) bits.push(`<span>${esc(item.niche)}</span>`)
  if (item.metric) bits.push(`<span>${esc(item.metric)}</span>`)
  const meta = bits.length
    ? `<span class="results-meta">${bits.join('<span class="results-meta-dot" aria-hidden="true"> · </span>')}</span>`
    : ''
  const loading = index < 2 ? 'eager' : 'lazy'
  return `
    <button type="button" class="results-card" data-result-id="${esc(item.id)}" aria-haspopup="dialog">
      <span class="results-shot">
        <img
          src="${esc(item.src)}"
          alt="${esc(item.alt)}"
          width="${item.width}"
          height="${item.height}"
          sizes="${esc(sizes)}"
          loading="${loading}"
          decoding="async"
          draggable="false"
        />
      </span>
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
      <img id="results-lb-img" alt="" />
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

function atStart(track) {
  return track.scrollLeft <= 2
}

function atEnd(track) {
  return track.scrollLeft >= track.scrollWidth - track.clientWidth - 2
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
    ? '(max-width: 720px) 85vw, (max-width: 1024px) 46vw, 32vw'
    : '(max-width: 940px) calc(100vw - 48px), 900px'

  const slides = list.map((item, i) => `<div class="results-slide">${cardHtml(item, sizes, i)}</div>`).join('')
  const arrows = multi
    ? `<div class="results-arrows">
        <button type="button" class="results-arrow" data-dir="-1" aria-label="Previous screenshot">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>
        </button>
        <button type="button" class="results-arrow" data-dir="1" aria-label="Next screenshot">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>
        </button>
      </div>`
    : ''
  const dots = multi
    ? `<div class="results-dots" role="group" aria-label="Result slides">${list.map((_, i) =>
        `<button type="button" class="results-dot${i === 0 ? ' is-on' : ''}" data-i="${i}" aria-label="Show result ${i + 1}" aria-current="${i === 0 ? 'true' : 'false'}"></button>`
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
          <div class="results-track"${multi ? ' role="region" aria-label="Channel analytics screenshots" tabindex="0"' : ''}>${slides}</div>
          ${arrows}
        </div>
        ${dots}
      </div>
    </section>`

  const track = mount.querySelector('.results-track')
  const slideEls = [...mount.querySelectorAll('.results-slide')]
  const prevBtn = mount.querySelector('.results-arrow[data-dir="-1"]')
  const nextBtn = mount.querySelector('.results-arrow[data-dir="1"]')
  const lb = ensureLightbox()
  const lbImg = lb.querySelector('#results-lb-img')
  const lbTitle = lb.querySelector('#results-lb-title')
  const lbClose = lb.querySelector('#results-lb-close')
  const lbPrev = lb.querySelector('#results-lb-prev')
  const lbNext = lb.querySelector('#results-lb-next')
  let lbIndex = 0
  /** @type {HTMLElement | null} */
  let lastTrigger = null
  let dragged = false

  function slideWidth() {
    const slide = slideEls[0]
    if (!slide) return track.clientWidth
    const styles = getComputedStyle(track)
    const gap = parseFloat(styles.columnGap || styles.gap || '0') || 0
    return slide.getBoundingClientRect().width + gap
  }

  function currentIndex() {
    const t = track.getBoundingClientRect()
    let best = 0
    let bestLeft = Infinity
    slideEls.forEach((slide, i) => {
      const left = slide.getBoundingClientRect().left
      if (left >= t.left - 12 && left < bestLeft) {
        bestLeft = left
        best = i
      }
    })
    if (bestLeft === Infinity) return atEnd(track) ? list.length - 1 : 0
    return best
  }

  function syncControls() {
    if (!multi) return
    const i = currentIndex()
    mount.querySelectorAll('.results-dot').forEach((dot, di) => {
      const on = di === i
      dot.classList.toggle('is-on', on)
      dot.setAttribute('aria-current', on ? 'true' : 'false')
    })
    if (prevBtn) prevBtn.disabled = atStart(track)
    if (nextBtn) nextBtn.disabled = atEnd(track)
  }

  function goTo(index, behavior = 'smooth') {
    const slide = slideEls[Math.max(0, Math.min(list.length - 1, index))]
    if (!slide) return
    const t = track.getBoundingClientRect()
    const s = slide.getBoundingClientRect()
    const delta = (s.left - t.left) - (t.width - s.width) / 2
    const max = Math.max(0, track.scrollWidth - track.clientWidth)
    track.scrollTo({ left: Math.max(0, Math.min(max, track.scrollLeft + delta)), behavior })
  }

  function step(dir) {
    const max = Math.max(0, track.scrollWidth - track.clientWidth)
    const next = Math.max(0, Math.min(max, track.scrollLeft + dir * slideWidth()))
    track.scrollTo({ left: next, behavior: 'smooth' })
  }

  if (multi && track) {
    track.addEventListener('scroll', () => { requestAnimationFrame(syncControls) }, { passive: true })
    window.addEventListener('resize', () => { requestAnimationFrame(syncControls) })
    mount.querySelectorAll('.results-arrow').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return
        step(Number(btn.dataset.dir) || 1)
      })
    })
    mount.querySelectorAll('.results-dot').forEach((dot) => {
      dot.addEventListener('click', () => goTo(Number(dot.dataset.i) || 0))
    })
    track.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); step(1) }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1) }
    })
    track.addEventListener('focusin', (e) => {
      const slide = e.target.closest('.results-slide')
      if (!slide || e.target === track) return
      const t = track.getBoundingClientRect()
      const s = slide.getBoundingClientRect()
      if (s.left >= t.left - 1 && s.right <= t.right + 1) return
      goTo(slideEls.indexOf(slide), 'auto')
    })

    let drag = null
    track.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return
      drag = { id: e.pointerId, x: e.clientX, sl: track.scrollLeft, moved: false }
    })
    track.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return
      const dx = e.clientX - drag.x
      if (Math.abs(dx) > 8) {
        if (!drag.moved) {
          drag.moved = true
          dragged = true
          track.style.scrollSnapType = 'none'
          try { track.setPointerCapture(e.pointerId) } catch (_) {}
        }
        track.scrollLeft = drag.sl - dx
      }
    })
    const endDrag = (e) => {
      if (!drag || (e && e.pointerId !== drag.id)) return
      const moved = drag.moved
      drag = null
      track.style.scrollSnapType = ''
      if (moved) setTimeout(() => { dragged = false }, 120)
      else dragged = false
    }
    track.addEventListener('pointerup', endDrag)
    track.addEventListener('pointercancel', endDrag)
    track.querySelectorAll('img').forEach((img) => img.addEventListener('load', syncControls))
    syncControls()
  }

  function showLb(index) {
    lbIndex = (index + list.length) % list.length
    const item = list[lbIndex]
    lbImg.src = item.src
    lbImg.alt = item.alt
    lbImg.width = item.width
    lbImg.height = item.height
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
      if (dragged) return
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
