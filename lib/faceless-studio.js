/**
 * Faceless Studio client. Projects persist through /api/faceless-studio.
 * The four-stage pipeline is the existing #fv-wizard, parked into the
 * project workspace (not copied).
 */
import { LFG_STEP_SHOTS } from '/lib/image-gen.js'
import { DEFAULT_IMAGE_MODEL } from '/lib/fal-image.js'
import { DURATION_PRESETS, durationPresets, secondsFromDurationId } from '/lib/entitlements.js'
import { bindMediaPlaceholders, mediaPlaceholderHtml } from '/lib/media-placeholder.js'
import {
  STUDIO_FILTERS,
  studioHeadingHtml,
  studioPresetById,
  studioSectionsForFilter,
} from '/lib/faceless-studio-presets.js'

const RAIL_KEY = 'vidso_fs_rail_collapsed'
const HOW_CARDS = [
  { title: 'Pick a topic', caption: 'Describe the video. Vidso writes a narration script to that length.', src: LFG_STEP_SHOTS.script },
  { title: 'Review the cut', caption: 'AI voice reads the script. Stock B-roll from Pexels is laid on a timeline with captions.', src: LFG_STEP_SHOTS.media },
  { title: 'Export', caption: 'Render the final MP4 on the server. This is what uses a monthly video credit.', src: LFG_STEP_SHOTS.export },
]

function $(id) { return document.getElementById(id) }
function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]))
}
function fmtWhen(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function initFacelessStudio(deps) {
  const {
    api,
    getUser,
    getVoices,
    loadVoices,
    parkWizard,
    hydratePipeline,
    snapshotPipeline,
    clearPipeline,
    generateThumb,
    getDurationCap,
    getVoicesState,
  } = deps

  let view = 'home'
  let tab = 'gallery'
  let galleryFilter = 'all'
  let projects = []
  let jobs = []
  let current = null
  let loadError = ''
  let listState = 'loading'
  let jobState = 'loading'
  let composerBusy = false
  let refs = []
  let compose = {
    topic: '',
    model: DEFAULT_IMAGE_MODEL,
    length: 'long_180',
    aspect: '16:9',
    voice: '',
  }
  let search = ''
  let sort = 'updated'
  let pendingAutoScript = false
  let saveTimer = null
  let listHasMore = false
  let jobHasMore = false
  let saveError = ''

  function collapsed() {
    try { return localStorage.getItem(RAIL_KEY) === '1' } catch (_) { return false }
  }
  function setCollapsed(on) {
    try { localStorage.setItem(RAIL_KEY, on ? '1' : '0') } catch (_) {}
    document.body.classList.toggle('fs-rail-collapsed', !!on)
    const btn = $('fs-rail-toggle')
    if (btn) {
      btn.setAttribute('aria-expanded', on ? 'false' : 'true')
      btn.setAttribute('aria-label', on ? 'Expand studio menu' : 'Collapse studio menu')
    }
  }

  function pathForView() {
    if (view === 'project' && current?.id) return '/faceless-studio/p/' + current.id
    if (view === 'projects') return '/faceless-studio/projects'
    if (view === 'generations' || tab === 'history') return '/faceless-studio/generations'
    if (view === 'favorites') return '/faceless-studio/favorites'
    if (tab === 'how') return '/faceless-studio/how'
    return '/faceless-studio'
  }

  function pushPath(silent) {
    window._fsPath = pathForView()
    if (silent) return
    if (normalize() !== window._fsPath) history.pushState({ panel: 'facelessstudio' }, '', window._fsPath)
  }

  function normalize() {
    return ('/' + String(location.pathname || '').replace(/^\/+|\/+$/g, '')).replace(/\/+/g, '/')
  }

  function parsePath() {
    const p = normalize()
    const m = p.match(/^\/faceless-studio\/p\/([^/]+)$/)
    if (m) return { view: 'project', id: m[1] }
    if (p === '/faceless-studio/projects') return { view: 'projects' }
    if (p === '/faceless-studio/generations' || p === '/faceless-studio/history') return { view: 'generations', tab: 'history' }
    if (p === '/faceless-studio/favorites') return { view: 'favorites' }
    if (p === '/faceless-studio/how') return { view: 'home', tab: 'how' }
    return { view: 'home', tab: 'gallery' }
  }

  async function studioReq(method, path, body, opts = {}) {
    const origin = location.origin
    const url = origin + '/api/faceless-studio' + path
    const token = api.getToken ? api.getToken() : (window._getToken?.() || localStorage.getItem('clipzo_token'))
    const headers = {}
    if (token) headers.Authorization = 'Bearer ' + token
    if (body && method !== 'GET') headers['Content-Type'] = 'application/json'
    const res = await fetch(url, {
      method,
      headers,
      body: body && method !== 'GET' ? JSON.stringify(body) : undefined,
      keepalive: !!opts.keepalive,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const err = new Error(data.error || data.message || 'Studio request failed')
      err.status = res.status
      throw err
    }
    return data
  }

  async function refreshProjects() {
    listState = 'loading'
    loadError = ''
    renderMain()
    try {
      const fav = view === 'favorites'
      const data = await studioReq('GET', '/projects?limit=40&sort=' + encodeURIComponent(sort) +
        (search ? '&q=' + encodeURIComponent(search) : '') +
        (fav ? '&favorites=1' : ''))
      projects = data.items || []
      listHasMore = !!data.hasMore
      listState = projects.length ? 'ok' : 'empty'
    } catch (e) {
      loadError = e.message || 'Could not load projects'
      listState = 'error'
    }
    renderRailProjects()
    renderMain()
  }

  async function refreshJobs() {
    jobState = 'loading'
    renderMain()
    try {
      const fav = view === 'favorites' || (tab === 'history' && $('fs-hist-favs')?.checked)
      const data = await studioReq('GET', '/jobs?limit=40' + (fav ? '&favorites=1' : ''))
      jobs = data.items || []
      jobHasMore = !!data.hasMore
      jobState = jobs.length ? 'ok' : 'empty'
    } catch (e) {
      loadError = e.message || 'Could not load generations'
      jobState = 'error'
    }
    renderMain()
  }

  async function loadMoreProjects() {
    try {
      const fav = view === 'favorites'
      const data = await studioReq('GET', '/projects?limit=24&offset=' + projects.length + '&sort=' + encodeURIComponent(sort) +
        (search ? '&q=' + encodeURIComponent(search) : '') +
        (fav ? '&favorites=1' : ''))
      projects = projects.concat(data.items || [])
      listHasMore = !!data.hasMore
      listState = projects.length ? 'ok' : 'empty'
    } catch (e) {
      loadError = e.message || 'Could not load projects'
      listState = 'error'
    }
    renderRailProjects()
    renderMain()
  }

  async function loadMoreJobs() {
    try {
      const fav = view === 'favorites' || (tab === 'history' && $('fs-hist-favs')?.checked)
      const data = await studioReq('GET', '/jobs?limit=24&offset=' + jobs.length + (fav ? '&favorites=1' : ''))
      jobs = jobs.concat(data.items || [])
      jobHasMore = !!data.hasMore
      jobState = jobs.length ? 'ok' : 'empty'
    } catch (e) {
      loadError = e.message || 'Could not load generations'
      jobState = 'error'
    }
    renderMain()
  }

  function voices() {
    return getVoices?.() || []
  }

  function lengthList() {
    const cap = getDurationCap?.()
    try {
      const long = durationPresets('long', cap)
      const shorts = durationPresets('shorts', cap)
      const list = (long.length ? long : DURATION_PRESETS.long).concat(shorts.length ? shorts : DURATION_PRESETS.shorts)
      return list
    } catch (_) {
      return DURATION_PRESETS.long.concat(DURATION_PRESETS.shorts)
    }
  }

  function hasSession() {
    try {
      return !!(api.getToken?.() || window._getToken?.() || localStorage.getItem('clipzo_token'))
    } catch (_) {
      return false
    }
  }

  function goSignIn() {
    try { sessionStorage.setItem('vidso_after_login', pathForView() || '/faceless-studio') } catch (_) {}
    location.href = '/login'
  }

  function voiceChipHtml() {
    const vs = voices()
    if (!hasSession()) {
      return `<label class="fs-chip">Voice
        <select id="fs-voice" disabled>
          <option value="">Sign in to pick a voice</option>
        </select>
      </label>`
    }
    const state = getVoicesState?.() || (vs.length ? 'ready' : 'loading')
    if (state === 'loading' || state === 'idle') {
      return `<label class="fs-chip">Voice
        <select id="fs-voice" disabled aria-busy="true">
          <option value="">Loading voices…</option>
        </select>
      </label>`
    }
    if (state === 'error' || (state === 'ready' && !vs.length)) {
      return `<label class="fs-chip is-err">Voice
        <select id="fs-voice" disabled>
          <option value="">Voices unavailable</option>
        </select>
      </label>
      <button type="button" class="btn btn-ghost btn-sm" id="fs-voice-retry">Retry voices</button>`
    }
    return `<label class="fs-chip">Voice
      <select id="fs-voice" aria-label="Narrator voice">
        <option value="">Select a voice</option>
        ${vs.map((v) => `<option value="${esc(v.id)}"${v.id === compose.voice ? ' selected' : ''}>${esc((v.name || '').split(' - ')[0])}</option>`).join('')}
      </select>
    </label>`
  }

  function composerHtml() {
    const lens = lengthList()
    const long = lens.filter((d) => String(d.id).startsWith('long'))
    const shorts = lens.filter((d) => String(d.id).startsWith('shorts'))
    const signedIn = hasSession()
    const voiceState = getVoicesState?.() || 'idle'
    const voiceOk = signedIn && voiceState === 'ready' && voices().length > 0
    const genDisabled = composerBusy || (signedIn && !voiceOk)
    const genTitle = !signedIn
      ? 'Sign in to generate'
      : (voiceState === 'loading' || voiceState === 'idle'
        ? 'Voices are still loading'
        : (!voiceOk ? 'Voices are not available. Retry, then generate.' : ''))
    const genLabel = composerBusy ? 'Creating…' : (signedIn ? 'Generate' : 'Sign in to generate')
    return `<form class="fs-composer" id="fs-composer" autocomplete="off">
      <p class="fs-composer-error" id="fs-composer-error" hidden></p>
      <div class="fs-composer-row">
        <button type="button" class="fs-ref-add" id="fs-ref-add" aria-label="Add reference image">+</button>
        <input type="file" id="fs-ref-input" accept="image/*" hidden>
        <textarea id="fs-topic" class="fs-topic" rows="2" placeholder="Describe what you want to create..." required>${esc(compose.topic)}</textarea>
        <button type="${signedIn ? 'submit' : 'button'}" class="btn btn-primary fs-gen" id="fs-gen"${genDisabled ? ' disabled' : ''}${genTitle ? ` title="${esc(genTitle)}"` : ''}>${genLabel}</button>
      </div>
      <div class="fs-refs" id="fs-refs"></div>
      <div class="fs-chips" role="group" aria-label="Project settings">
        <label class="fs-chip">Length
          <select id="fs-length">
            ${long.length ? `<optgroup label="Long form">${long.map((d) => `<option value="${esc(d.id)}"${d.id === compose.length ? ' selected' : ''}>${esc(d.label)}</option>`).join('')}</optgroup>` : ''}
            ${shorts.length ? `<optgroup label="Shorts">${shorts.map((d) => `<option value="${esc(d.id)}"${d.id === compose.length ? ' selected' : ''}>${esc(d.label)}</option>`).join('')}</optgroup>` : ''}
          </select>
        </label>
        <label class="fs-chip">Aspect
          <select id="fs-aspect">
            <option value="16:9"${compose.aspect === '16:9' ? ' selected' : ''}>16:9 Horizontal</option>
            <option value="9:16"${compose.aspect === '9:16' ? ' selected' : ''}>9:16 Vertical</option>
          </select>
        </label>
        ${voiceChipHtml()}
      </div>
    </form>`
  }

  function heroHtml() {
    return `<div class="fs-hero">
      <h1 class="fs-hero-title"><span class="lead">Bring your stories</span><span class="accent">to life</span></h1>
      <p class="fs-hero-sub">Topic to script, voice, B-roll, thumbnail, and export in one project.</p>
    </div>`
  }

  function howHtml() {
    return `<section class="fs-how" aria-labelledby="fs-how-h">
      <h2 class="fs-how-h" id="fs-how-h">${studioHeadingHtml('MAKE FACELESS', 2, esc)} videos in one flow</h2>
      <p class="fs-how-sub">Three stages, one project. Nothing is lost when you leave.</p>
      <div class="fs-how-grid">
        ${HOW_CARDS.map((c) => `<article class="fs-how-card">
          ${mediaPlaceholderHtml({ src: c.src, ratio: '16 / 9', className: 'fs-how-shot' })}
          <h3>${esc(c.title)}</h3>
          <p>${esc(c.caption)}</p>
        </article>`).join('')}
      </div>
    </section>`
  }

  function galleryHtml() {
    const sections = studioSectionsForFilter(galleryFilter)
    return `<div class="fs-gallery" id="fs-gallery">
      <div class="fs-filters" id="fs-filters" role="radiogroup" aria-label="Preset filters">
        ${STUDIO_FILTERS.map((f) => `<button type="button" class="fs-filter${galleryFilter === f.id ? ' is-on' : ''}" role="radio" aria-checked="${galleryFilter === f.id ? 'true' : 'false'}" tabindex="${galleryFilter === f.id ? '0' : '-1'}" data-filter="${esc(f.id)}">${esc(f.label)}</button>`).join('')}
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

  function projectCard(p) {
    const thumb = (p.assets || []).find((a) => a.type === 'thumbnail')?.storage_url || ''
    return `<button type="button" class="fs-proj-card" data-open="${esc(p.id)}">
      ${mediaPlaceholderHtml({ src: thumb, ratio: '16 / 9', className: 'fs-proj-thumb' })}
      <span class="fs-proj-title">${esc(p.title || 'Untitled')}</span>
      <span class="fs-proj-meta">${esc(p.status || 'draft')} · ${esc(fmtWhen(p.updated_at))}</span>
    </button>`
  }

  function renderRailProjects() {
    const list = $('fs-rail-list')
    if (!list) return
    const q = ($('fs-rail-search')?.value || '').trim().toLowerCase()
    const items = projects.filter((p) => !q || (p.title + ' ' + p.topic).toLowerCase().includes(q))
    list.innerHTML = items.slice(0, 12).map((p) =>
      `<button type="button" class="fs-rail-item${current?.id === p.id ? ' is-on' : ''}" data-open="${esc(p.id)}">${esc(p.title || 'Untitled')}</button>`,
    ).join('') || '<p class="fs-rail-empty">No projects yet</p>'
  }

  function stateBlock(kind, emptyTitle, emptySub) {
    if (kind === 'loading') return `<div class="fs-state" aria-busy="true"><span class="spinner"></span> Loading…</div>`
    if (kind === 'error') return `<div class="fs-state is-err">${esc(loadError || 'Something went wrong')}<button type="button" class="btn btn-ghost btn-sm" id="fs-retry">Retry</button></div>`
    if (kind === 'empty') return `<div class="fs-state"><strong>${esc(emptyTitle)}</strong><p>${esc(emptySub)}</p></div>`
    return ''
  }

  function renderMain() {
    const main = $('fs-main')
    if (!main) return
    try {
    try { parkWizard?.(null) } catch (_) {}
    const hasProjects = projects.length > 0
    if (view === 'project' && current) {
      main.innerHTML = workspaceHtml()
      try { parkWizard?.($('fs-pipeline-slot')) } catch (_) {}
      try { hydratePipeline?.(current) } catch (_) {}
      bindWorkspace()
      bindMediaPlaceholders(main)
      if (pendingAutoScript) {
        pendingAutoScript = false
        queueAutoScript()
      }
      main.dataset.fsMounted = 'full'
      return
    }
    if (view === 'projects' || view === 'favorites') {
      main.innerHTML = `<div class="fs-page">
        <div class="fs-page-head">
          <h1>${view === 'favorites' ? 'Favorites' : 'My projects'}</h1>
          <div class="fs-toolbar">
            <input type="search" id="fs-search" class="fs-search" placeholder="Search projects" value="${esc(search)}">
            <select id="fs-sort" aria-label="Sort">
              <option value="updated"${sort === 'updated' ? ' selected' : ''}>Last edited</option>
              <option value="created"${sort === 'created' ? ' selected' : ''}>Newest</option>
              <option value="title"${sort === 'title' ? ' selected' : ''}>Title</option>
            </select>
            <button type="button" class="btn btn-primary" id="fs-new">New project</button>
          </div>
        </div>
        ${stateBlock(listState, 'No projects yet', 'Generate from Home to create one.')}
        ${listState === 'ok' ? `<div class="fs-proj-grid">${projects.map(projectCard).join('')}</div>${listHasMore ? '<button type="button" class="btn btn-ghost" id="fs-more-projects">Load more</button>' : ''}` : ''}
      </div>`
    } else if (view === 'generations') {
      main.innerHTML = historyPane()
    } else {
      const showComposer = tab === 'gallery'
      main.innerHTML = `<div class="fs-home${showComposer ? ' has-composer' : ''}">
        <div class="fs-tabs" role="tablist" aria-label="Studio">
          <button type="button" class="fs-tab${tab === 'gallery' ? ' is-on' : ''}" role="tab" aria-selected="${tab === 'gallery'}" data-tab="gallery">Home</button>
          <button type="button" class="fs-tab${tab === 'history' ? ' is-on' : ''}" role="tab" aria-selected="${tab === 'history'}" data-tab="history">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
            History
          </button>
          <button type="button" class="fs-tab${tab === 'how' ? ' is-on' : ''}" role="tab" aria-selected="${tab === 'how'}" data-tab="how">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg>
            How it works
          </button>
        </div>
        <div class="fs-tab-body">
          ${tab === 'history' ? historyPane() : tab === 'how' ? howHtml() : `
            ${heroHtml()}
            ${hasProjects ? `<section class="fs-recent"><h2>Recent projects</h2>
              <div class="fs-proj-row">${projects.slice(0, 8).map(projectCard).join('')}</div>
            </section>` : ''}
            ${galleryHtml()}
          `}
        </div>
        ${showComposer ? `<div class="fs-composer-dock" id="fs-composer-dock">${composerHtml()}</div>` : ''}
      </div>`
    }
    bindMediaPlaceholders(main)
    bindHome()
    padComposer()
    main.dataset.fsMounted = 'full'
    } catch (e) {
      try { console.warn('[fs-render]', e) } catch (_) {}
      if (!main.childElementCount) {
        try { window.__mountStudioHome?.() } catch (_) {}
      }
    }
  }

  function historyPane() {
    return `<div class="fs-page">
      <div class="fs-page-head">
        <h1>My generations</h1>
        <label class="fs-fav-filter"><input type="checkbox" id="fs-hist-favs"> Favorites only</label>
      </div>
      ${stateBlock(jobState, 'No generations yet', 'Create a project and generate a script to see jobs here.')}
      ${jobState === 'ok' ? `<div class="fs-job-list">${jobs.map((j) => `
        <button type="button" class="fs-job" data-open="${esc(j.project_id)}">
          ${mediaPlaceholderHtml({ src: j.thumb, ratio: '16 / 9', className: 'fs-job-thumb' })}
          <span>
            <strong>${esc(j.project_title || j.type)}</strong>
            <span class="fs-job-meta">${esc(j.status)} · ${esc(j.type)} · ${esc(fmtWhen(j.updated_at || j.created_at))}</span>
          </span>
        </button>`).join('')}</div>${jobHasMore ? '<button type="button" class="btn btn-ghost" id="fs-more-jobs">Load more</button>' : ''}` : ''}
    </div>`
  }

  function workspaceHtml() {
    const p = current
    const exports = (p.assets || []).filter((a) => a.type === 'export')
    const thumbs = (p.assets || []).filter((a) => a.type === 'thumbnail')
    const jobErr = (p.jobs || []).filter((j) => j.status === 'failed').slice(-1)[0]
    return `<div class="fs-workspace">
      <div class="fs-ws-head">
        <button type="button" class="btn btn-ghost btn-sm" id="fs-back">← Studio home</button>
        <input class="fs-title" id="fs-title" value="${esc(p.title || '')}" aria-label="Project title">
        <span class="fs-ws-status">${esc(p.status)}</span>
        <button type="button" class="btn btn-ghost btn-sm" id="fs-fav">${p.favorited ? 'Favorited' : 'Favorite'}</button>
        <button type="button" class="btn btn-ghost btn-sm" id="fs-dup">Duplicate</button>
        <button type="button" class="btn btn-ghost btn-sm" id="fs-del">Delete</button>
      </div>
      ${saveError ? `<p class="fs-banner-err" id="fs-save-err" role="alert">${esc(saveError)}</p>` : ''}
      ${jobErr ? `<p class="fs-banner-err" role="alert">${esc(jobErr.error || 'A generation failed. Your script is still here.')}</p>` : ''}
      ${Array.isArray(p.references) && p.references.length ? `<div class="fs-refs-row" aria-label="Reference images">${p.references.map((r) =>
        `<img src="${esc(r.url || r)}" alt="">`).join('')}</div>` : ''}
      <div id="fs-pipeline-slot" class="fs-pipeline-slot"></div>
      <section class="fs-thumb-stage">
        <h2>Thumbnail</h2>
        <p>Uses this project topic${(p.references || []).length ? ' and the reference images attached on Home' : ''}.</p>
        <p class="fs-thumb-err" id="fs-thumb-err" hidden></p>
        <div class="fs-thumb-row">
          <input id="fs-thumb-prompt" class="fs-search" value="${esc(p.topic || '')}" aria-label="Thumbnail prompt">
          <button type="button" class="btn btn-primary" id="fs-thumb-gen">Generate thumbnail</button>
        </div>
        <div class="fs-thumb-grid" id="fs-thumb-grid">
          ${thumbs.length ? thumbs.map((t) => `<a href="${esc(t.storage_url)}" target="_blank" rel="noopener">${mediaPlaceholderHtml({ src: t.storage_url, ratio: '16 / 9' })}</a>`).join('') : '<p class="fs-muted">No thumbnails yet.</p>'}
        </div>
      </section>
      <section class="fs-exports">
        <h2>Exports</h2>
        ${exports.length ? `<ul class="fs-export-list">${exports.map((a) => `<li><a href="${esc(a.storage_url)}" download>${esc(a.label || 'Download MP4')}</a> · ${esc(fmtWhen(a.created_at))}</li>`).join('')}</ul>` : '<p class="fs-muted">No renders yet. Export from the pipeline above.</p>'}
      </section>
    </div>`
  }

  function bindHome() {
    $('fs-retry')?.addEventListener('click', () => {
      if (view === 'generations' || tab === 'history') refreshJobs()
      else refreshProjects()
    })
    $('fs-new')?.addEventListener('click', () => go('home'))
    $('fs-search')?.addEventListener('change', (e) => { search = e.target.value; refreshProjects() })
    $('fs-sort')?.addEventListener('change', (e) => { sort = e.target.value; refreshProjects() })
    $('fs-hist-favs')?.addEventListener('change', () => refreshJobs())
    $('fs-more-projects')?.addEventListener('click', loadMoreProjects)
    $('fs-more-jobs')?.addEventListener('click', loadMoreJobs)
    document.querySelectorAll('[data-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        tab = btn.getAttribute('data-tab')
        if (tab === 'history') { view = 'home'; refreshJobs() }
        else { view = 'home'; renderMain() }
        pushPath()
      })
    })
    document.querySelectorAll('[data-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        galleryFilter = btn.getAttribute('data-filter') || 'all'
        renderMain()
      })
    })
    document.querySelectorAll('[data-preset]').forEach((btn) => {
      btn.addEventListener('click', () => applyPreset(btn.getAttribute('data-preset')))
    })
    $('fs-filters')?.addEventListener('keydown', onFilterKey)
    document.querySelectorAll('[data-open]').forEach((btn) => {
      btn.addEventListener('click', () => openProject(btn.getAttribute('data-open')))
    })
    const form = $('fs-composer')
    if (form) {
      $('fs-topic')?.addEventListener('input', (e) => { compose.topic = e.target.value })
      $('fs-length')?.addEventListener('change', (e) => { compose.length = e.target.value })
      $('fs-aspect')?.addEventListener('change', (e) => { compose.aspect = e.target.value })
      $('fs-voice')?.addEventListener('change', (e) => { compose.voice = e.target.value })
      $('fs-voice-retry')?.addEventListener('click', () => {
        loadVoices?.().finally(() => { if (view !== 'project') renderMain() })
      })
      $('fs-ref-add')?.addEventListener('click', () => $('fs-ref-input')?.click())
      $('fs-ref-input')?.addEventListener('change', onRefFiles)
      $('fs-gen')?.addEventListener('click', (e) => {
        if (!hasSession()) {
          e.preventDefault()
          goSignIn()
        }
      })
      form.addEventListener('submit', onGenerate)
      renderRefs()
    }
  }

  let composerPadObs = null
  function padComposer() {
    if (composerPadObs) {
      composerPadObs.disconnect()
      composerPadObs = null
    }
    const home = document.querySelector('.fs-home.has-composer')
    const dock = $('fs-composer-dock')
    if (!home || !dock) return
    const apply = () => {
      const h = Math.ceil(dock.getBoundingClientRect().height) + 16
      home.style.setProperty('--fs-composer-h', h + 'px')
    }
    apply()
    if (typeof ResizeObserver === 'function') {
      composerPadObs = new ResizeObserver(apply)
      composerPadObs.observe(dock)
    }
  }

  function onFilterKey(e) {
    const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End']
    if (!keys.includes(e.key)) return
    const btns = [...document.querySelectorAll('[data-filter]')]
    const i = btns.findIndex((b) => b.classList.contains('is-on'))
    if (i < 0) return
    e.preventDefault()
    let next = i
    if (e.key === 'ArrowRight') next = (i + 1) % btns.length
    if (e.key === 'ArrowLeft') next = (i - 1 + btns.length) % btns.length
    if (e.key === 'Home') next = 0
    if (e.key === 'End') next = btns.length - 1
    galleryFilter = btns[next].getAttribute('data-filter') || 'all'
    renderMain()
    document.querySelector(`[data-filter="${galleryFilter}"]`)?.focus()
  }

  function applyPreset(id) {
    const preset = studioPresetById(id)
    if (!preset) return
    if (preset.route === 'imagegen') {
      window.switchPanel?.('imagegen')
      requestAnimationFrame(() => window.fillImgPrompt?.(preset.scaffold))
      return
    }
    if (preset.route) {
      window.switchPanel?.(preset.route)
      return
    }
    compose.topic = preset.scaffold
    compose.length = preset.length || compose.length
    compose.aspect = preset.aspect || compose.aspect
    if (preset.voice) compose.voice = preset.voice
    tab = 'gallery'
    view = 'home'
    renderMain()
    const topic = $('fs-topic')
    topic?.focus()
    topic?.setSelectionRange?.(topic.value.length, topic.value.length)
  }

  function renderRefs() {
    const box = $('fs-refs')
    if (!box) return
    box.hidden = !refs.length
    box.innerHTML = refs.map((r, i) =>
      `<span class="fs-ref-chip"><img src="${esc(r.preview)}" alt=""><button type="button" data-ref-del="${i}" aria-label="Remove reference">×</button></span>`,
    ).join('')
    box.querySelectorAll('[data-ref-del]').forEach((b) => {
      b.addEventListener('click', () => {
        const i = Number(b.getAttribute('data-ref-del'))
        const hit = refs[i]
        if (hit?.preview?.startsWith('blob:')) try { URL.revokeObjectURL(hit.preview) } catch (_) {}
        refs.splice(i, 1)
        renderRefs()
      })
    })
  }

  function onRefFiles(e) {
    const files = [...(e.target.files || [])].slice(0, 4 - refs.length)
    files.forEach((file) => {
      refs.push({ file, preview: URL.createObjectURL(file) })
    })
    e.target.value = ''
    renderRefs()
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(r.result)
      r.onerror = () => reject(new Error('Could not read the reference image'))
      r.readAsDataURL(file)
    })
  }

  async function onGenerate(e) {
    e.preventDefault()
    if (!hasSession()) {
      goSignIn()
      return
    }
    const err = $('fs-composer-error')
    const topic = ($('fs-topic')?.value || '').trim()
    if (!topic) {
      if (err) { err.hidden = false; err.textContent = 'Enter a topic first' }
      return
    }
    const voiceState = getVoicesState?.()
    if (voiceState !== 'ready' || !voices().length) {
      if (err) { err.hidden = false; err.textContent = 'Voices are not available. Retry loading voices, then generate.' }
      return
    }
    if (!compose.voice) {
      if (err) { err.hidden = false; err.textContent = 'Select a narrator voice' }
      return
    }
    const lens = lengthList()
    const picked = lens.find((d) => d.id === compose.length)
    if (!picked?.seconds || !picked.id) {
      if (err) { err.hidden = false; err.textContent = 'A video duration is required.' }
      return
    }
    if (compose.aspect !== '16:9' && compose.aspect !== '9:16') {
      if (err) { err.hidden = false; err.textContent = 'Choose 16:9 or 9:16' }
      return
    }
    composerBusy = true
    if (err) err.hidden = true
    $('fs-gen') && ($('fs-gen').disabled = true)
    $('fs-gen') && ($('fs-gen').textContent = 'Creating…')
    try {
      const data = await studioReq('POST', '/projects', {
        topic,
        title: topic.slice(0, 72),
        aspect: compose.aspect,
        length: picked.id,
        duration_seconds: picked.seconds,
        voice_id: compose.voice,
        model: compose.model || DEFAULT_IMAGE_MODEL,
        pipeline: {
          topic,
          aspect: compose.aspect,
          durationId: picked.id,
          voiceId: compose.voice,
          phase: 1,
        },
      })
      let project = data.project
      if (refs.length) {
        const packed = await Promise.all(refs.map((r) => fileToDataUrl(r.file)))
        const upd = await studioReq('POST', '/projects/' + project.id + '/refs', { references: packed })
        project = upd.project
      }
      await studioReq('POST', '/projects/' + project.id + '/jobs', {
        type: 'create',
        status: 'succeeded',
        progress: 100,
        provider: 'vidso',
        parameters: { length: picked.id, duration_seconds: picked.seconds, aspect: compose.aspect, voice_id: compose.voice },
      })
      current = project
      pendingAutoScript = true
      view = 'project'
      pushPath()
      renderMain()
      markRail()
    } catch (ex) {
      if (err) { err.hidden = false; err.textContent = ex.message || 'Could not create the project' }
    } finally {
      composerBusy = false
    }
  }

  function bindWorkspace() {
    $('fs-back')?.addEventListener('click', () => go('home'))
    const title = $('fs-title')
    title?.addEventListener('change', async () => {
      try {
        const data = await studioReq('PATCH', '/projects/' + current.id, { title: title.value.trim() || 'Untitled project' })
        current = data.project
        refreshProjects()
      } catch (e) {
        title.setCustomValidity(e.message)
        title.reportValidity()
      }
    })
    $('fs-thumb-gen')?.addEventListener('click', onThumb)
    $('fs-fav')?.addEventListener('click', async () => {
      try {
        const data = await studioReq('PATCH', '/projects/' + current.id, { favorited: !current.favorited })
        current = data.project
        renderMain()
      } catch (_) {}
    })
    $('fs-dup')?.addEventListener('click', async () => {
      try {
        const data = await studioReq('POST', '/projects/' + current.id + '/duplicate')
        current = data.project
        view = 'project'
        pushPath()
        renderMain()
        refreshProjects()
      } catch (e) {
        const err = $('fs-thumb-err')
        if (err) { err.hidden = false; err.textContent = e.message || 'Could not duplicate' }
      }
    })
    $('fs-del')?.addEventListener('click', onDelete)
  }

  async function onDelete() {
    if (!current?.id) return
    const ok = window.confirm('Delete this project and its files? This cannot be undone.')
    if (!ok) return
    const btn = $('fs-del')
    if (btn) btn.disabled = true
    try {
      await flushSave()
      parkWizard?.(null)
      window.fvStudioUnbind?.()
      await studioReq('DELETE', '/projects/' + current.id)
      try { sessionStorage.removeItem('vidso-fs-draft:' + current.id) } catch (_) {}
      current = null
      view = 'projects'
      pushPath()
      refreshProjects()
    } catch (e) {
      if (btn) btn.disabled = false
      const err = $('fs-thumb-err')
      if (err) { err.hidden = false; err.textContent = e.message || 'Could not delete the project' }
    }
  }

  function queueAutoScript() {
    const run = async () => {
      if (!current?.id) return
      if (current.pipeline?.script) return
      if (compose.voice) window.pickFvVoice?.(compose.voice)
      const state = getVoicesState?.()
      if (state !== 'ready') await loadVoices?.()
      if (compose.voice) window.pickFvVoice?.(compose.voice)
      window.fvStudioAutoRun = true
      try {
        await studioReq('POST', '/projects/' + current.id + '/jobs', {
          type: 'script',
          status: 'running',
          progress: 5,
          provider: 'railway',
          parameters: { length: current.length, duration_seconds: current.duration_seconds, voice_id: compose.voice || current.voice_id },
        })
      } catch (_) {}
      try {
        await window.fvGenerateScript?.()
      } finally {
        await flushSave()
      }
    }
    requestAnimationFrame(() => { run() })
  }

  async function onThumb() {
    const err = $('fs-thumb-err')
    const prompt = ($('fs-thumb-prompt')?.value || current.topic || '').trim()
    if (!prompt) {
      if (err) { err.hidden = false; err.textContent = 'Enter a thumbnail prompt' }
      return
    }
    const btn = $('fs-thumb-gen')
    if (btn) { btn.disabled = true; btn.textContent = 'Generating…' }
    if (err) err.hidden = true
    try {
      await studioReq('POST', '/projects/' + current.id + '/jobs', { type: 'thumbnail', status: 'running', progress: 5 })
      const refUrls = (current.references || []).map((r) => r.url || r).filter((u) => /^https?:\/\//i.test(String(u)))
      const rec = await generateThumb?.({
        prompt,
        model: current.model || compose.model,
        aspect: '16:9',
        ...(refUrls.length ? { image_urls: refUrls } : {}),
      })
      if (!rec?.storage_url && !rec?.url) throw new Error('Thumbnail generation returned no image')
      await studioReq('POST', '/projects/' + current.id + '/assets', {
        type: 'thumbnail',
        storage_url: rec.storage_url || rec.url,
        file_id: rec.file_id || '',
        label: 'Thumbnail',
      })
      await studioReq('POST', '/projects/' + current.id + '/jobs', { type: 'thumbnail', status: 'succeeded', progress: 100 })
      const fresh = await studioReq('GET', '/projects/' + current.id)
      current = fresh.project
      renderMain()
    } catch (e) {
      try {
        await studioReq('POST', '/projects/' + current.id + '/jobs', {
          type: 'thumbnail', status: 'failed', progress: 0, error: e.message || 'Thumbnail failed',
        })
      } catch (_) {}
      if (err) { err.hidden = false; err.textContent = e.message || 'Thumbnail failed' }
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Generate thumbnail' }
    }
  }

  function scheduleSave() {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(flushSave, 250)
  }

  async function flushSave(opts = {}) {
    clearTimeout(saveTimer)
    if (!current?.id) return
    const snap = snapshotPipeline?.()
    if (!snap) return
    if (!snap.script && current.pipeline?.script) snap.script = current.pipeline.script
    if (!snap.media && current.pipeline?.media) snap.media = current.pipeline.media
    if (!snap.preview && current.pipeline?.preview) snap.preview = current.pipeline.preview
    if (!snap.mediaJobId && current.pipeline?.mediaJobId) snap.mediaJobId = current.pipeline.mediaJobId
    if (!snap.renderJobId && current.pipeline?.renderJobId) snap.renderJobId = current.pipeline.renderJobId
    try {
      const data = await studioReq('PATCH', '/projects/' + current.id, {
        pipeline: snap,
        topic: snap.topic || current.topic,
        aspect: snap.aspect || current.aspect,
        length: snap.durationId || current.length,
        duration_seconds: secondsFromDurationId(snap.durationId) || current.duration_seconds,
        voice_id: snap.voiceId || current.voice_id,
        status: snap.phase === 4 ? 'export' : snap.phase === 3 ? 'preview' : snap.phase === 2 ? 'media' : snap.script ? 'script' : 'draft',
      }, { keepalive: !!opts.keepalive })
      current = data.project
      if (saveError) {
        saveError = ''
        const banner = $('fs-save-err')
        if (banner) banner.remove()
      }
    } catch (e) {
      saveError = e.message || 'Could not save this project'
      const banner = $('fs-save-err')
      if (banner) {
        banner.hidden = false
        banner.textContent = saveError
      } else if (view === 'project') {
        const head = document.querySelector('.fs-ws-head')
        if (head) {
          const p = document.createElement('p')
          p.className = 'fs-banner-err'
          p.id = 'fs-save-err'
          p.setAttribute('role', 'alert')
          p.textContent = saveError
          head.insertAdjacentElement('afterend', p)
        }
      }
      try { console.warn('[fs-save]', saveError) } catch (_) {}
    }
  }

  async function openProject(id) {
    if (current?.id && current.id !== id) await flushSave()
    if (current?.id !== id) window.fvStudioUnbind?.()
    listState = 'loading'
    try {
      const data = await studioReq('GET', '/projects/' + id)
      current = data.project
      view = 'project'
      pushPath()
      renderMain()
      markRail()
    } catch (e) {
      loadError = e.message
      listState = 'error'
      view = 'projects'
      renderMain()
    }
  }

  function markRail() {
    document.querySelectorAll('#fs-rail [data-fs-view]').forEach((el) => {
      el.classList.toggle('is-on', el.getAttribute('data-fs-view') === view ||
        (view === 'home' && el.getAttribute('data-fs-view') === 'home'))
    })
    renderRailProjects()
  }

  async function go(next) {
    await flushSave()
    parkWizard?.(null)
    window.fvStudioUnbind?.()
    current = null
    view = next
    if (next === 'home') tab = 'gallery'
    if (next === 'generations') tab = 'history'
    pushPath()
    markRail()
    if (next === 'generations' || next === 'favorites') refreshJobs()
    refreshProjects()
  }

  async function leave() {
    await flushSave()
    parkWizard?.(null)
    window.fvStudioUnbind?.()
  }

  function onKey(e) {
    if (e.key !== 'Escape') return
    const menus = document.querySelectorAll('.fs-chip select')
    menus.forEach((s) => s.blur())
    if (window.matchMedia('(max-width: 1100px)').matches && !collapsed()) setCollapsed(true)
  }

  window.fvStudioOnChange = () => scheduleSave()
  window.fsStudioOnAuth = () => {
    if (view !== 'project') renderMain()
  }
  window.fvStudioIngestExport = async (renderJobId) => {
    if (!current?.id || !renderJobId) return
    try {
      let blob
      const local = window.fvState?.renderUrl
      if (local && String(local).startsWith('blob:')) {
        blob = await fetch(local).then((r) => r.blob())
      } else {
        const blobUrl = await api.faceless.downloadRender(renderJobId)
        blob = await fetch(blobUrl).then((r) => r.blob())
      }
      if (!blob || !blob.size) throw new Error('Render download was empty')
      const fd = new FormData()
      fd.append('file', blob, 'vidso-fs-file-' + String(current.id).slice(0, 8) + '-export.mp4')
      const uploaded = await api.upload.file(fd)
      const url = uploaded.url || uploaded.file_url || uploaded.publicUrl
      if (!url) throw new Error('Could not store the export')
      await studioReq('POST', '/projects/' + current.id + '/assets', {
        type: 'export',
        storage_url: url,
        file_id: uploaded.id || uploaded.file_id || '',
        mime: blob.type || 'video/mp4',
        label: current.title || 'Export',
      })
      const fresh = await studioReq('PATCH', '/projects/' + current.id, { status: 'ready' })
      current = fresh.project
      renderMain()
      try { window.loadFiles?.() } catch (_) {}
    } catch (e) {
      try { console.warn('[fs-export]', e.message || e) } catch (_) {}
      try {
        const data = await studioReq('POST', '/projects/' + current.id + '/ingest-export', { renderJobId })
        current = data.project
        renderMain()
      } catch (_) {}
    }
  }
  window.fvStudioIngestMedia = async (media) => {
    if (!current?.id || !media?.voiceover_url) return
    try {
      const data = await studioReq('POST', '/projects/' + current.id + '/ingest-media', {
        voiceover_url: media.voiceover_url,
        duration_seconds: media.duration,
        words: media.words || [],
      })
      current = data.project
    } catch (_) {}
  }
  window.fvStudioCurrentId = () => current?.id || null
  window.fvStudioRecordJob = async (job) => {
    if (!current?.id) return
    try {
      const data = await studioReq('POST', '/projects/' + current.id + '/jobs', job)
      current = data.project
    } catch (_) {}
  }
  window.fvStudioPatchJob = async (jobId, patch) => {
    if (!current?.id || !jobId) return
    try {
      await studioReq('PATCH', '/projects/' + current.id + '/jobs/' + jobId, patch)
    } catch (_) {}
  }

  async function showFromPath() {
    try {
    const parsed = parsePath()
    const staying = parsed.view === 'project' && parsed.id && current?.id === parsed.id
    if (!staying) await flushSave()
    view = parsed.view
    if (parsed.tab) tab = parsed.tab
    if (parsed.id) {
      openProject(parsed.id)
      return
    }
    current = null
    try { parkWizard?.(null) } catch (_) {}
    window.fvStudioUnbind?.()
    markRail()
    refreshProjects()
    if (view === 'generations' || tab === 'history') refreshJobs()
    else renderMain()
    } catch (e) {
      try { console.warn('[fs-path]', e) } catch (_) {}
      try { renderMain() } catch (_) { window.__mountStudioHome?.() }
    }
  }

  window.fsStudioShow = showFromPath
  window.fsStudioGo = go
  window.fsStudioLeave = leave

  $('fs-rail-toggle')?.addEventListener('click', () => setCollapsed(!collapsed()))
  $('fs-rail-new')?.addEventListener('click', () => go('home'))
  $('fs-rail-search')?.addEventListener('input', () => renderRailProjects())
  document.querySelectorAll('#fs-rail [data-fs-view]').forEach((btn) => {
    btn.addEventListener('click', () => go(btn.getAttribute('data-fs-view')))
  })
  document.addEventListener('keydown', onKey)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushSave({ keepalive: true })
  })
  window.addEventListener('pagehide', () => { flushSave({ keepalive: true }) })
  setCollapsed(collapsed())
  const voiceState = getVoicesState?.()
  const voiceBoot = (voiceState === 'ready' && voices().length)
    ? Promise.resolve()
    : (loadVoices?.() || Promise.resolve())
  voiceBoot.finally(() => {
    if (view !== 'project') renderMain()
  })
  showFromPath()
}
