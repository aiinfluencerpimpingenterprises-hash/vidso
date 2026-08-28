/**
 * Faceless Studio home gallery. Lives in its own module so the dashboard
 * shell can paint cards even if the rest of the app script fails to load.
 */
import { DURATION_PRESETS } from '/lib/entitlements.js'
import { studioHeadingHtml } from '/lib/faceless-studio-presets.js'
import { bindShowcaseGrid, showcaseGridHtml, setShowcaseRecreate } from '/lib/studio-showcase.js'

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
  return `<div class="fs-home has-composer">
    <div class="fs-tab-body">
      <div class="fs-hero">
        <h1 class="fs-hero-title">${studioHeadingHtml('FACELESS STUDIO', 1, esc)}</h1>
        <p class="fs-hero-sub">Turn any topic into a clear, visual explainer video</p>
      </div>
      ${showcaseGridHtml()}
    </div>
    <div class="fs-composer-dock" id="fs-composer-dock">${composerHtml(state.compose)}</div>
  </div>`
}

function listHtml(title, empty) {
  return `<div class="fs-page">
    <div class="fs-page-head"><h1>${esc(title)}</h1></div>
    <div class="fs-state"><strong>${esc(empty)}</strong><p>Projects persist after you sign in.</p></div>
  </div>`
}

function fillComposer(main, state, sample) {
  if (!sample) return
  state.compose.topic = sample.prompt || sample.scaffold || ''
  if (sample.length) state.compose.length = sample.length
  if (sample.aspect) state.compose.aspect = sample.aspect
  const topic = main.querySelector('#fs-topic')
  const length = main.querySelector('#fs-length')
  const aspect = main.querySelector('#fs-aspect')
  if (topic) {
    topic.value = state.compose.topic
    topic.focus()
  }
  if (length && sample.length) length.value = sample.length
  if (aspect && sample.aspect) aspect.value = sample.aspect
}

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

  const recreate = (sample) => {
    if (typeof opts.onRecreate === 'function') opts.onRecreate(sample)
    else fillComposer(main, state, sample)
  }
  setShowcaseRecreate(recreate)
  bindShowcaseGrid(main, { onRecreate: recreate })

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
        err.textContent = 'Sign in to generate from this prompt.'
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
