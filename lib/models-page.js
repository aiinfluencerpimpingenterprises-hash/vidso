import { mountAnnounce, wrapGlowLabels } from './landing-page.js'
import { mountLandingToolsMenu } from './landing-tools-menu.js'
import { mountLandingFooter } from './landing-footer.js'
import { mountLandingReveals } from './landing-reveal.js?v=d1f52'
import { mountLandingIntegrations } from './landing-integrations.js'
import {
  CATALOG_CLIP_FILES,
  CATALOG_MODELS,
  MODELS_HERO,
  MODELS_HERO_VIDEO,
  bindCatalogClipLoop,
  catalogClipLoopSeconds,
  modelCardClipSrc,
  modelCardSrc,
  modelSlug,
} from './vidso-models.js?v=d1f99'

function reduceMotion() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch (_) { return false }
}

function probeUrl(url) {
  if (!url) return Promise.resolve(false)
  return fetch(url, { method: 'GET', mode: 'cors', headers: { Range: 'bytes=0-0' } })
    .then((r) => r.ok || r.status === 206)
    .catch(() => false)
}

function markFilled(card, host) {
  host.classList.remove('is-blank')
  card.classList.remove('is-blank')
}

function attachClip(card, host, url, loopSeconds) {
  const v = document.createElement('video')
  v.muted = true
  v.loop = !(loopSeconds > 0)
  v.playsInline = true
  v.preload = 'metadata'
  v.setAttribute('type', 'video/mp4')
  v.setAttribute('src', url)
  bindCatalogClipLoop(v, loopSeconds)
  v.addEventListener('loadeddata', () => markFilled(card, host))
  v.addEventListener('error', () => { try { v.remove() } catch (_) {} })
  host.appendChild(v)
  const play = () => { try { v.play().catch(() => {}) } catch (_) {} }
  const stop = () => { try { v.pause(); v.currentTime = 0 } catch (_) {} }
  if (!reduceMotion()) {
    card.addEventListener('pointerenter', play)
    card.addEventListener('pointerleave', stop)
    card.addEventListener('focus', play)
    card.addEventListener('blur', stop)
  }
}

function bindCardMedia(card, model) {
  const host = card.querySelector('.model-card-shot')
  if (!host) return
  const poster = modelCardSrc(model.id)
  const clip = modelCardClipSrc(model.id)
  probeUrl(poster).then((ok) => {
    if (!ok) return
    const img = document.createElement('img')
    img.alt = ''
    img.decoding = 'async'
    img.loading = 'lazy'
    img.src = poster
    host.appendChild(img)
    markFilled(card, host)
  })
  const loopSeconds = catalogClipLoopSeconds(model.id)
  if (CATALOG_CLIP_FILES[model.id] || CATALOG_CLIP_FILES[modelSlug(model.id)]) {
    attachClip(card, host, clip, loopSeconds)
    return
  }
  probeUrl(clip).then((ok) => {
    if (ok) attachClip(card, host, clip, loopSeconds)
  })
}

function cardHtml(model) {
  const slug = modelSlug(model.id)
  return `<article class="model-card is-blank" id="${slug}" data-group="${model.group}" data-model="${slug}" tabindex="0">
    <div class="model-card-media">
      <div class="model-card-shot is-blank"></div>
      <span class="model-card-go" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>
    </div>
    <div class="model-card-copy">
      <h2 class="model-card-name">${model.name}${model.isNew ? '<span class="models-mega-new">NEW</span>' : ''}</h2>
      <p class="model-card-blurb">${model.blurb}</p>
    </div>
  </article>`
}

function paintGrid() {
  const grid = document.getElementById('models-grid')
  if (!grid) return
  grid.innerHTML = CATALOG_MODELS.map(cardHtml).join('')
  grid.querySelectorAll('.model-card').forEach((card) => {
    const model = CATALOG_MODELS.find((m) => modelSlug(m.id) === card.id)
    if (model) bindCardMedia(card, model)
    card.addEventListener('click', () => highlightCard(card.id, true))
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        highlightCard(card.id, true)
      }
    })
  })
}

function highlightCard(id, push) {
  const slug = modelSlug(id)
  const card = document.getElementById(slug)
  document.querySelectorAll('.model-card.is-target').forEach((el) => el.classList.remove('is-target'))
  if (!card) return
  card.classList.add('is-target')
  card.scrollIntoView({ block: 'center', behavior: reduceMotion() ? 'auto' : 'smooth' })
  if (push) {
    try { history.replaceState(null, '', '#' + slug) } catch (_) {}
  }
}

function mountHeroVideo(banner) {
  const v = document.createElement('video')
  v.muted = true
  v.loop = true
  v.playsInline = true
  v.preload = 'metadata'
  v.setAttribute('src', MODELS_HERO_VIDEO)
  v.addEventListener('loadeddata', () => {
    banner.classList.add('has-media', 'has-video')
    if (!reduceMotion()) {
      try { v.play().catch(() => {}) } catch (_) {}
    }
  })
  v.addEventListener('error', () => { try { v.remove() } catch (_) {} })
  banner.appendChild(v)
}

function mountHeroMedia() {
  const banner = document.querySelector('.models-hero-bg')
  if (!banner) return
  const img = document.createElement('img')
  img.alt = ''
  img.decoding = 'async'
  img.src = MODELS_HERO
  img.addEventListener('load', () => banner.classList.add('has-media', 'has-still'))
  img.addEventListener('error', () => {
    try { img.remove() } catch (_) {}
    mountHeroVideo(banner)
  })
  banner.appendChild(img)
}

function applyHash() {
  const id = (location.hash || '').replace(/^#/, '')
  if (!id) return
  const card = document.getElementById(modelSlug(id))
  if (!card) return
  highlightCard(card.id, false)
}

export function mountModelsPage() {
  mountAnnounce()
  mountLandingToolsMenu()
  mountLandingFooter()
  try {
    window.applyVidsoSocialLinks && window.applyVidsoSocialLinks()
    window.applyVidsoSupportLinks && window.applyVidsoSupportLinks()
  } catch (_) {}
  mountHeroMedia()
  paintGrid()
  wrapGlowLabels()
  mountLandingIntegrations()
  mountLandingReveals()
  applyHash()
  window.addEventListener('hashchange', applyHash)
}
