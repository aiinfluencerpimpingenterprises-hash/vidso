/**
 * Higgsfield-style sample player: hover recreate on the grid, lightbox on click.
 */
import { STUDIO_SAMPLES, studioSampleById, studioSampleIndex } from '/lib/faceless-studio-presets.js'

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]))
}

const MUTE_ON = '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M16 9l5 6M21 9l-5 6"/></svg>'
const MUTE_OFF = '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M16 9a5 5 0 010 6M19 7a9 9 0 010 10"/></svg>'

let index = 0
let onRecreate = null
let bound = false

export function templatesBoardHtml() {
  return `<div class="fs-page fs-templates">
    <div class="fs-page-head">
      <h1>Templates</h1>
    </div>
    ${showcaseGridHtml()}
  </div>`
}

export function showcaseGridHtml() {
  return `<div class="fs-gallery" id="fs-gallery">
    <div class="fs-g-grid fs-shot-grid">
      ${STUDIO_SAMPLES.map((s, i) => `<article class="fs-shot" data-preset="${esc(s.id)}" data-shot-index="${i}">
        <video class="fs-shot-vid" muted loop playsinline preload="metadata" src="${esc(s.video)}" aria-hidden="true"></video>
        <div class="fs-shot-hover">
          <p class="fs-shot-prompt">${esc(s.prompt)}</p>
          <button type="button" class="fs-recreate" data-fs-recreate="${esc(s.id)}">Recreate</button>
        </div>
      </article>`).join('')}
    </div>
  </div>`
}

function thumbsHtml() {
  return STUDIO_SAMPLES.map((s, i) =>
    `<button type="button" class="fs-show-thumb${i === index ? ' is-on' : ''}" data-shot-index="${i}" aria-label="${esc(s.name)}">
      <video muted playsinline preload="metadata" src="${esc(s.video)}" tabindex="-1"></video>
    </button>`,
  ).join('')
}

function sideHtml(s) {
  return `<div class="fs-show-head">
      <div class="fs-show-id" aria-hidden="true">${esc((s.name || 'V').charAt(0))}</div>
      <div class="fs-show-titles">
        <h2 id="fs-show-title">${esc(s.name)}</h2>
        <p>${esc(s.sub)}</p>
      </div>
      <button type="button" class="fs-show-x" data-fs-show-close aria-label="Close">×</button>
    </div>
    <div class="fs-show-body">
      <div class="fs-show-prompt">${esc(s.prompt)}</div>
      <p class="fs-show-copy">${esc(s.process)}</p>
      <div class="fs-show-meta">
        <span>✦ Vidso</span>
        <span>${esc(s.aspect)}</span>
        <span>${esc(s.duration)}</span>
      </div>
      <p class="fs-show-copy">${esc(s.ready)}</p>
    </div>
    <div class="fs-show-foot">
      <div class="fs-show-tags">
        <span>${esc(s.runtime)}</span>
        <span>${esc(s.category)}</span>
        <span>${esc(s.kind)}</span>
      </div>
      <button type="button" class="fs-recreate fs-recreate-lg" data-fs-recreate="${esc(s.id)}">Recreate</button>
    </div>`
}

function ensureRoot() {
  let el = document.getElementById('fs-show')
  if (el) return el
  el = document.createElement('div')
  el.id = 'fs-show'
  el.className = 'fs-show'
  el.hidden = true
  el.setAttribute('role', 'dialog')
  el.setAttribute('aria-modal', 'true')
  el.setAttribute('aria-labelledby', 'fs-show-title')
  el.innerHTML = `<div class="fs-show-scrim" data-fs-show-close></div>
    <div class="fs-show-layout">
      <div class="fs-show-stage">
        <button type="button" class="fs-show-nav fs-show-prev" data-fs-show-dir="-1" aria-label="Previous video">‹</button>
        <div class="fs-show-frame">
          <video id="fs-show-video" playsinline preload="auto"></video>
          <button type="button" class="fs-show-mute" id="fs-show-mute" aria-label="Unmute">${MUTE_ON}</button>
        </div>
        <button type="button" class="fs-show-nav fs-show-next" data-fs-show-dir="1" aria-label="Next video">›</button>
        <div class="fs-show-thumbs" id="fs-show-thumbs"></div>
      </div>
      <aside class="fs-show-side" id="fs-show-side"></aside>
    </div>`
  document.body.appendChild(el)
  return el
}

function current() {
  return STUDIO_SAMPLES[index] || STUDIO_SAMPLES[0]
}

function syncMuteBtn(video) {
  const btn = document.getElementById('fs-show-mute')
  if (!btn || !video) return
  const muted = !!video.muted
  btn.innerHTML = muted ? MUTE_ON : MUTE_OFF
  btn.setAttribute('aria-label', muted ? 'Unmute' : 'Mute')
}

function paint() {
  const s = current()
  const root = ensureRoot()
  const video = document.getElementById('fs-show-video')
  const side = document.getElementById('fs-show-side')
  const thumbs = document.getElementById('fs-show-thumbs')
  if (side) side.innerHTML = sideHtml(s)
  if (thumbs) thumbs.innerHTML = thumbsHtml()
  if (video) {
    const wasMuted = video.muted
    if (video.getAttribute('src') !== s.video) {
      video.loop = true
      video.autoplay = true
      video.muted = wasMuted
      video.src = s.video
      video.play?.().catch(() => {})
    }
    syncMuteBtn(video)
  }
  root.style.setProperty('--fs-show-glow', 'rgba(0,0,0,.72)')
}

function setIndex(next) {
  const n = STUDIO_SAMPLES.length
  if (!n) return
  index = ((next % n) + n) % n
  paint()
}

export function closeStudioShowcase() {
  const root = document.getElementById('fs-show')
  const video = document.getElementById('fs-show-video')
  if (video) {
    try { video.pause() } catch (_) {}
    video.removeAttribute('src')
    video.load?.()
  }
  if (root) root.hidden = true
  document.body.classList.remove('fs-show-open')
}

export function openStudioShowcase(idOrIndex) {
  if (typeof idOrIndex === 'number') index = idOrIndex
  else index = studioSampleIndex(idOrIndex)
  const root = ensureRoot()
  bindShowcaseOnce()
  paint()
  root.hidden = false
  document.body.classList.add('fs-show-open')
  const video = document.getElementById('fs-show-video')
  if (video) {
    video.muted = true
    video.play?.().catch(() => {})
    syncMuteBtn(video)
  }
}

function toggleMute() {
  const video = document.getElementById('fs-show-video')
  if (!video) return
  video.muted = !video.muted
  if (!video.muted) video.play?.().catch(() => {})
  syncMuteBtn(video)
}

function recreate(id) {
  const sample = studioSampleById(id) || current()
  closeStudioShowcase()
  if (typeof onRecreate === 'function') onRecreate(sample)
}

function bindShowcaseOnce() {
  if (bound) return
  bound = true
  const root = ensureRoot()
  root.addEventListener('click', (e) => {
    const close = e.target.closest('[data-fs-show-close]')
    if (close) { closeStudioShowcase(); return }
    const dir = e.target.closest('[data-fs-show-dir]')
    if (dir) { setIndex(index + Number(dir.getAttribute('data-fs-show-dir') || 0)); return }
    const thumb = e.target.closest('[data-shot-index]')
    if (thumb && thumb.classList.contains('fs-show-thumb')) {
      setIndex(Number(thumb.getAttribute('data-shot-index') || 0))
      return
    }
    const rec = e.target.closest('[data-fs-recreate]')
    if (rec) { recreate(rec.getAttribute('data-fs-recreate')); return }
    if (e.target.closest('#fs-show-mute')) { toggleMute(); return }
    if (e.target.closest('#fs-show-video') || e.target.id === 'fs-show-video') { toggleMute() }
  })
  document.addEventListener('keydown', (e) => {
    const rootEl = document.getElementById('fs-show')
    if (!rootEl || rootEl.hidden) return
    if (e.key === 'Escape') { e.preventDefault(); closeStudioShowcase() }
    if (e.key === 'ArrowRight') { e.preventDefault(); setIndex(index + 1) }
    if (e.key === 'ArrowLeft') { e.preventDefault(); setIndex(index - 1) }
  })
}

export function bindShowcaseGrid(root, opts = {}) {
  onRecreate = opts.onRecreate || onRecreate
  bindShowcaseOnce()
  if (!root) return
  root.querySelectorAll('.fs-shot').forEach((card) => {
    const vid = card.querySelector('video')
    card.addEventListener('mouseenter', () => { try { vid?.play() } catch (_) {} })
    card.addEventListener('mouseleave', () => { try { vid?.pause() } catch (_) {} })
    card.addEventListener('click', (e) => {
      if (e.target.closest('[data-fs-recreate]')) return
      openStudioShowcase(card.getAttribute('data-preset'))
    })
  })
  root.querySelectorAll('[data-fs-recreate]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      recreate(btn.getAttribute('data-fs-recreate'))
    })
  })
}

export function setShowcaseRecreate(fn) {
  onRecreate = fn
}
