import { mountAnnounce, wrapGlowLabels } from './landing-page.js'
import { mountLandingToolsMenu } from './landing-tools-menu.js'
import { mountLandingFooter } from './landing-footer.js'
import { mountLandingReveals } from './landing-reveal.js?v=d1f52'
import { mountLandingIntegrations } from './landing-integrations.js'
import {
  CATALOG_MODELS,
  MODELS_HERO,
  modelCardClipSrc,
  modelCardSrc,
  modelSlug,
} from './vidso-models.js'

function reduceMotion() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch (_) { return false }
}

function probeUrl(url) {
  if (!url) return Promise.resolve(false)
  return fetch(url, { method: 'GET', mode: 'cors', headers: { Range: 'bytes=0-0' } })
    .then((r) => r.ok || r.status === 206)
    .catch(() => false)
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
    host.classList.remove('is-blank')
    card.classList.remove('is-blank')
  })
  probeUrl(clip).then((ok) => {
    if (!ok) return
    const v = document.createElement('video')
    v.muted = true
    v.loop = true
    v.playsInline = true
    v.preload = 'metadata'
    v.setAttribute('src', clip)
    host.appendChild(v)
    host.classList.remove('is-blank')
    card.classList.remove('is-blank')
    const play = () => { try { v.play().catch(() => {}) } catch (_) {} }
    const stop = () => { try { v.pause(); v.currentTime = 0 } catch (_) {} }
    if (!reduceMotion()) {
      card.addEventListener('pointerenter', play)
      card.addEventListener('pointerleave', stop)
      card.addEventListener('focus', play)
      card.addEventListener('blur', stop)
    }
  })
}

function cardHtml(model) {
  const slug = modelSlug(model.id)
  const play = model.group === 'video'
    ? `<span class="model-card-play" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></span>`
    : ''
  return `<article class="model-card is-blank" id="${slug}" data-group="${model.group}" data-model="${slug}" tabindex="0">
    <div class="model-card-media">
      <div class="model-card-shot is-blank"></div>
      ${play}
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

function mountHeroMedia() {
  const banner = document.querySelector('.models-hero-bg')
  if (!banner) return
  probeUrl(MODELS_HERO).then((ok) => {
    if (!ok) return
    banner.style.backgroundImage = `url("${MODELS_HERO}")`
    banner.classList.add('has-media')
  })
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
