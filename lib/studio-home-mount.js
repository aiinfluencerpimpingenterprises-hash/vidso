/**
 * Faceless Studio home gallery. Lives in its own module so the dashboard
 * shell can paint cards even if the rest of the app script fails to load.
 */
import { DURATION_PRESETS } from '/lib/entitlements.js'
import { bindMediaPlaceholders, mediaPlaceholderHtml } from '/lib/media-placeholder.js'
import {
  STUDIO_FILTERS,
  studioHeadingHtml,
  studioPresetById,
  studioSectionsForFilter,
} from '/lib/faceless-studio-presets.js'

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]))
}

function lengthOptions(selected) {
  const long = DURATION_PRESETS.long || []
  const shorts = DURATION_PRESETS.shorts || []
  const opt = (d) => `<option value="${esc(d.id)}"${d.id === selected ? ' selected' : ''}>${esc(d.label)}</option>`
  return `${long.length ? `<optgroup label="Long form">${long.map(opt).join('')}</optgroup>` : ''}${shorts.length ? `<optgroup label="Shorts">${shorts.map(opt).join('')}</optgroup>` : ''}`
}

function galleryHtml(filterId) {
  const sections = studioSectionsForFilter(filterId)
  return `<div class="fs-gallery" id="fs-gallery">
    <div class="fs-filters" id="fs-filters" role="radiogroup" aria-label="Preset filters">
      ${STUDIO_FILTERS.map((f) => `<button type="button" class="fs-filter${filterId === f.id ? ' is-on' : ''}" role="radio" aria-checked="${filterId === f.id ? 'true' : 'false'}" tabindex="${filterId === f.id ? '0' : '-1'}" data-filter="${esc(f.id)}">${esc(f.label)}</button>`).join('')}
    </div>
    ${sections.map((s) => `<section class="fs-g-sec" aria-labelledby="fs-g-${esc(s.id)}">
      <h2 class="fs-g-h" id="fs-g-${esc(s.id)}">${studioHeadingHtml(s.title, s.accentWords, esc)}</h2>
      <p class="fs-g-sub">${esc(s.sub)}</p>
      <div class="fs-g-grid">
        ${s.cards.map((c) => `<button type="button" class="fs-preset" data-preset="${esc(c.id)}">
          ${mediaPlaceholderHtml({ src: c.image, ratio: '16 / 9', className: 'fs-preset-shot', icon: c.icon })}
          <span class="fs-preset-row">
            <span class="fs-preset-ico" aria-hidden="true">${c.icon || ''}</span>
            <span class="fs-preset-name">${esc(c.name)}</span>
            <span class="fs-preset-tag">Preset</span>
          </span>
        </button>`).join('')}
      </div>
    </section>`).join('')}
  </div>`
}

function composerHtml(compose) {
  return `<form class="fs-composer" id="fs-composer" autocomplete="off">
    <p class="fs-composer-error" id="fs-composer-error" hidden></p>
    <div class="fs-composer-row">
      <button type="button" class="fs-ref-add" id="fs-ref-add" aria-label="Add reference image">+</button>
      <input type="file" id="fs-ref-input" accept="image/*" hidden>
      <textarea id="fs-topic" class="fs-topic" rows="2" placeholder="Describe what you want to create..." required>${esc(compose.topic)}</textarea>
      <button type="button" class="btn btn-primary fs-gen" id="fs-gen">Generate</button>
    </div>
    <div class="fs-refs" id="fs-refs"></div>
    <div class="fs-chips" role="group" aria-label="Project settings">
      <label class="fs-chip">Length
        <select id="fs-length">${lengthOptions(compose.length)}</select>
      </label>
      <label class="fs-chip">Aspect
        <select id="fs-aspect">
          <option value="16:9"${compose.aspect === '16:9' ? ' selected' : ''}>16:9 Horizontal</option>
          <option value="9:16"${compose.aspect === '9:16' ? ' selected' : ''}>9:16 Vertical</option>
        </select>
      </label>
      <label class="fs-chip">Voice
        <select id="fs-voice" disabled>
          <option value="">Sign in to pick a voice</option>
        </select>
      </label>
    </div>
  </form>`
}

function homeHtml(state) {
  const tab = state.tab || 'gallery'
  const showComposer = tab === 'gallery'
  return `<div class="fs-home${showComposer ? ' has-composer' : ''}">
    <div class="fs-tabs" role="tablist" aria-label="Studio">
      <button type="button" class="fs-tab${tab === 'gallery' ? ' is-on' : ''}" role="tab" aria-selected="${tab === 'gallery'}" data-tab="gallery">Home</button>
      <button type="button" class="fs-tab${tab === 'history' ? ' is-on' : ''}" role="tab" aria-selected="${tab === 'history'}" data-tab="history">History</button>
      <button type="button" class="fs-tab${tab === 'how' ? ' is-on' : ''}" role="tab" aria-selected="${tab === 'how'}" data-tab="how">How it works</button>
    </div>
    <div class="fs-tab-body">
      ${tab === 'history' ? `<div class="fs-page"><h1>My generations</h1><p class="fs-muted">Sign in to see jobs from this account.</p></div>` : tab === 'how' ? `<section class="fs-how"><h2 class="fs-how-h">Make faceless videos in one flow</h2><p class="fs-how-sub">Pick a preset, describe the topic, then generate script, voice, B-roll, and export.</p></section>` : `
        <div class="fs-hero">
          <h1 class="fs-hero-title"><span class="lead">Bring your stories</span><span class="accent">to life</span></h1>
          <p class="fs-hero-sub">Topic to script, voice, B-roll, thumbnail, and export in one project.</p>
        </div>
        ${galleryHtml(state.filter || 'all')}
      `}
    </div>
    ${showComposer ? `<div class="fs-composer-dock" id="fs-composer-dock">${composerHtml(state.compose)}</div>` : ''}
  </div>`
}

function listHtml(title, empty) {
  return `<div class="fs-page">
    <div class="fs-page-head"><h1>${esc(title)}</h1></div>
    <div class="fs-state"><strong>${esc(empty)}</strong><p>Projects persist after you sign in.</p></div>
  </div>`
}

/**
 * Paint the studio main pane. Safe to call repeatedly.
 * Skips if the full Faceless Studio client already mounted (`data-fs-mounted=full`).
 */
export function mountStudioHome(main, opts = {}) {
  if (!main) return
  if (main.dataset.fsMounted === 'full' && !opts.force) return

  const state = opts.state || (window.__studioHomeState ||= {
    view: 'home',
    tab: 'gallery',
    filter: 'all',
    compose: { topic: '', length: 'long_180', aspect: '16:9' },
  })

  const view = state.view || 'home'
  if (view === 'projects') main.innerHTML = listHtml('My projects', 'No projects yet')
  else if (view === 'favorites') main.innerHTML = listHtml('Favorites', 'No favorites yet')
  else if (view === 'generations') main.innerHTML = listHtml('My generations', 'No generations yet')
  else main.innerHTML = homeHtml(state)

  main.dataset.fsMounted = opts.mode || 'fallback'
  bindMediaPlaceholders(main)

  main.querySelectorAll('[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.tab = btn.getAttribute('data-tab') || 'gallery'
      state.view = 'home'
      mountStudioHome(main, { ...opts, state, force: true, mode: main.dataset.fsMounted })
    })
  })
  main.querySelectorAll('[data-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.filter = btn.getAttribute('data-filter') || 'all'
      mountStudioHome(main, { ...opts, state, force: true, mode: main.dataset.fsMounted })
    })
  })
  main.querySelectorAll('[data-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const preset = studioPresetById(btn.getAttribute('data-preset'))
      if (!preset) return
      state.compose.topic = preset.scaffold || ''
      if (preset.length) state.compose.length = preset.length
      if (preset.aspect) state.compose.aspect = preset.aspect
      const topic = main.querySelector('#fs-topic')
      if (topic) {
        topic.value = state.compose.topic
        topic.focus()
      } else {
        mountStudioHome(main, { ...opts, state, force: true, mode: main.dataset.fsMounted })
      }
    })
  })
  main.querySelector('#fs-topic')?.addEventListener('input', (e) => { state.compose.topic = e.target.value })
  main.querySelector('#fs-length')?.addEventListener('change', (e) => { state.compose.length = e.target.value })
  main.querySelector('#fs-aspect')?.addEventListener('change', (e) => { state.compose.aspect = e.target.value })
  main.querySelector('#fs-gen')?.addEventListener('click', (e) => {
    e.preventDefault()
    if (typeof opts.onGenerate === 'function') opts.onGenerate(state)
    else {
      const err = main.querySelector('#fs-composer-error')
      if (err) {
        err.hidden = false
        err.textContent = 'Sign in to generate. The preset cards are ready to swap in art.'
      }
    }
  })
  main.querySelector('#fs-ref-add')?.addEventListener('click', () => {
    const err = main.querySelector('#fs-composer-error')
    if (err) {
      err.hidden = false
      err.textContent = 'Sign in to attach a reference image.'
    }
  })

  const dock = main.querySelector('#fs-composer-dock')
  const home = main.querySelector('.fs-home.has-composer')
  if (dock && home) {
    const apply = () => home.style.setProperty('--fs-composer-h', Math.ceil(dock.getBoundingClientRect().height) + 16 + 'px')
    apply()
    if (typeof ResizeObserver === 'function') new ResizeObserver(apply).observe(dock)
  }
}

export function studioHomeGo(view) {
  const main = document.getElementById('fs-main')
  if (!main) return
  const state = window.__studioHomeState ||= {
    view: 'home',
    tab: 'gallery',
    filter: 'all',
    compose: { topic: '', length: 'long_180', aspect: '16:9' },
  }
  state.view = view || 'home'
  if (view === 'home') state.tab = 'gallery'
  if (view === 'generations') state.tab = 'history'
  mountStudioHome(main, { state, force: true, mode: main.dataset.fsMounted === 'full' ? 'full' : 'fallback' })
}
