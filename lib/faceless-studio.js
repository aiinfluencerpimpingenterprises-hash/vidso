/**
 * Faceless Studio client. Projects persist through /api/gate/faceless-studio.
 * The four-stage pipeline is the existing #fv-wizard, parked into the
 * project workspace (not copied).
 */
import { DEFAULT_IMAGE_MODEL } from '/lib/fal-image.js'
import {
  DEFAULT_VIDEO_MODEL,
  STOCK_VIDEO_MODEL,
  aspectsForModel,
  clampVideoCount,
  clipDurationFor,
  isFalVideoModel,
  resolutionFor,
  videoModelLabel,
} from '/lib/fal-video.js'
import { studioGateHref } from '/lib/studio-gate.js'
import { pickDefaultVoiceId } from '/lib/studio-voice.js'
import { DURATION_PRESETS, durationPresets, secondsFromDurationId } from '/lib/entitlements.js'
import { bindMediaPlaceholders, mediaPlaceholderHtml } from '/lib/media-placeholder.js'
import {
  studioPresetById,
} from '/lib/faceless-studio-presets.js'
import { bindShowcaseGrid, showcaseGridHtml } from '/lib/studio-showcase.js'
import {
  addMemory,
  getActiveProjectId,
  getAskMode,
  getChat,
  importMemories,
  isTempChat,
  listChats,
  listMemories,
  loadTempDraft,
  saveTempDraft,
  searchChats,
  setActiveProjectId,
  setAskMode,
  setTempChat,
  upsertChat,
} from '/lib/studio-workspace.js'
import {
  closeStudioMenus,
  composerHtml as shellComposerHtml,
  confirmAsk,
  connectorsBoardHtml,
  connectorsMenuHtml,
  elementsMenuHtml,
  homeHeroHtml,
  homeTaglineHtml,
  memoryBoardHtml,
  plusMenuHtml,
  projectMenuHtml,
  projectsBoardHtml,
  railChatsHtml,
  askMenuHtml,
  bindVideoBarOnce,
  refreshVideoBar,
  searchOverlayHtml,
  setVideoBarApi,
  showMenu,
  showOverlay,
} from '/lib/studio-shell.js'

const RAIL_KEY = 'vidso_fs_rail_collapsed'

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
    videoModel: DEFAULT_VIDEO_MODEL,
    length: 'long_180',
    aspect: '16:9',
    clipDuration: 5,
    resolution: '720p',
    sound: false,
    generations: 1,
    voice: '',
  }
  function ensureVoice() {
    compose.voice = pickDefaultVoiceId(voices(), compose.voice)
    return compose.voice
  }
  function voiceDisplayName() {
    ensureVoice()
    const hit = voices().find((v) => v.id === compose.voice)
    if (hit) return String(hit.name || 'Voice').split(' - ')[0]
    const state = getVoicesState?.()
    if (state === 'loading' || state === 'idle') return 'Loading'
    return 'Voice'
  }
  let search = ''
  let sort = 'updated'
  let projTab = 'all'
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
    if (view === 'memory') return '/faceless-studio/memory'
    if (view === 'connectors') return '/faceless-studio/connectors'
    if (view === 'generations' || tab === 'history') return '/faceless-studio/generations'
    if (view === 'favorites') return '/faceless-studio/favorites'
    if (view === 'temp' || isTempChat()) return '/faceless-studio/temp'
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
    if (p === '/faceless-studio/memory') return { view: 'memory' }
    if (p === '/faceless-studio/connectors') return { view: 'connectors' }
    if (p === '/faceless-studio/temp') return { view: 'temp' }
    if (p === '/faceless-studio/generations' || p === '/faceless-studio/history') return { view: 'generations', tab: 'history' }
    if (p === '/faceless-studio/favorites') return { view: 'favorites' }
    if (p === '/faceless-studio/how') return { view: 'home', tab: 'gallery' }
    return { view: 'home', tab: 'gallery' }
  }

  async function studioReq(method, path, body, opts = {}) {
    const origin = location.origin
    const url = origin + studioGateHref(path)
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
    const raw = await res.text()
    let data = {}
    try { data = raw ? JSON.parse(raw) : {} } catch { data = {} }
    if (!res.ok) {
      const fallback = res.status === 404
        ? 'Studio API is unavailable. Refresh and try again.'
        : (raw && !raw.trim().startsWith('{') ? raw.trim().slice(0, 180) : 'Studio request failed')
      const err = new Error(data.error || data.message || fallback)
      err.status = res.status
      throw err
    }
    return data
  }

  async function refreshProjects() {
    listState = 'loading'
    loadError = ''
    if (view === 'projects' || view === 'favorites') renderMain()
    try {
      const fav = view === 'favorites'
      const vis = view === 'projects' && (projTab === 'private' || projTab === 'shared')
        ? '&visibility=' + encodeURIComponent(projTab)
        : ''
      const data = await studioReq('GET', '/projects?limit=40&sort=' + encodeURIComponent(sort) +
        (search ? '&q=' + encodeURIComponent(search) : '') +
        (fav ? '&favorites=1' : '') + vis)
      projects = data.items || []
      listHasMore = !!data.hasMore
      listState = projects.length ? 'ok' : 'empty'
    } catch (e) {
      if (e.status === 401) {
        projects = []
        listHasMore = false
        listState = 'empty'
      } else {
        loadError = e.message || 'Could not load projects'
        listState = 'error'
      }
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
      const vis = view === 'projects' && (projTab === 'private' || projTab === 'shared')
        ? '&visibility=' + encodeURIComponent(projTab)
        : ''
      const data = await studioReq('GET', '/projects?limit=24&offset=' + projects.length + '&sort=' + encodeURIComponent(sort) +
        (search ? '&q=' + encodeURIComponent(search) : '') +
        (fav ? '&favorites=1' : '') + vis)
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

  function syncVideoDefaults() {
    const aspects = isFalVideoModel(compose.videoModel) ? aspectsForModel(compose.videoModel) : ['16:9', '9:16']
    if (!aspects.includes(compose.aspect)) compose.aspect = aspects[0] || '16:9'
    compose.clipDuration = clipDurationFor(compose.videoModel, compose.clipDuration)
    compose.resolution = resolutionFor(compose.videoModel, compose.resolution)
    compose.generations = clampVideoCount(compose.generations)
  }

  function videoSettingsPayload() {
    return {
      video_model: compose.videoModel || DEFAULT_VIDEO_MODEL,
      clip_duration: clipDurationFor(compose.videoModel, compose.clipDuration),
      video_resolution: compose.resolution || '',
      video_sound: !!compose.sound,
      video_count: clampVideoCount(compose.generations),
    }
  }

  function persistVideoSettings() {
    try {
      window.fvSetStudioVideoSettings?.({
        videoModel: compose.videoModel,
        aspect: compose.aspect,
        clipDuration: compose.clipDuration,
        resolution: compose.resolution,
        sound: compose.sound,
        generations: compose.generations,
      })
    } catch (_) {}
  }

  function setBarLabel(id, text) {
    const el = $(id)?.querySelector('.fs-bar-label')
    if (el) el.textContent = text
  }

  function paintVideoBar() {
    syncVideoDefaults()
    setBarLabel('fs-video-model', videoModelLabel(compose.videoModel))
    setBarLabel('fs-aspect', compose.aspect || '16:9')
    setBarLabel('fs-clip-duration', (compose.clipDuration || 5) + 's')
    const resBtn = $('fs-resolution')
    if (resBtn) {
      const res = compose.resolution || ''
      resBtn.hidden = !res
      setBarLabel('fs-resolution', res || '720p')
    }
    const sound = $('fs-sound')
    if (sound) {
      sound.setAttribute('aria-pressed', compose.sound ? 'true' : 'false')
      sound.setAttribute('aria-label', 'Sound ' + (compose.sound ? 'on' : 'off'))
      setBarLabel('fs-sound', compose.sound ? 'On' : 'Off')
    }
    const count = $('fs-count-label')
    if (count) count.textContent = clampVideoCount(compose.generations) + '/4'
    setBarLabel('fs-voice', voiceDisplayName())
    refreshVideoBar()
  }

  function lengthInnerHtml() {
    const lens = lengthList()
    const long = lens.filter((d) => String(d.id).startsWith('long'))
    const shorts = lens.filter((d) => String(d.id).startsWith('shorts'))
    return `${long.length ? `<optgroup label="Long form">${long.map((d) => `<option value="${esc(d.id)}"${d.id === compose.length ? ' selected' : ''}>${esc(d.label)}</option>`).join('')}</optgroup>` : ''}${shorts.length ? `<optgroup label="Shorts">${shorts.map((d) => `<option value="${esc(d.id)}"${d.id === compose.length ? ' selected' : ''}>${esc(d.label)}</option>`).join('')}</optgroup>` : ''}`
  }

  function activeProjectTitle() {
    const id = getActiveProjectId()
    if (!id) return ''
    if (current?.id === id) return current.title || 'Untitled'
    return (projects.find((p) => p.id === id) || {}).title || ''
  }

  function composerHtml() {
    const signedIn = hasSession()
    const voiceState = getVoicesState?.() || 'idle'
    const voiceOk = signedIn && voiceState === 'ready' && voices().length > 0
    const genDisabled = composerBusy || (signedIn && !voiceOk)
    const genTitle = !signedIn
      ? 'Sign in to generate'
      : (voiceState === 'loading' || voiceState === 'idle'
        ? 'Voices are still loading'
        : (!voiceOk ? 'Voices are not available. Retry, then generate.' : ''))
    const temp = view === 'temp' || isTempChat()
    syncVideoDefaults()
    return shellComposerHtml({
      topic: temp ? (compose.topic || loadTempDraft()) : compose.topic,
      placeholder: temp ? 'Generate a short video ad from my idea' : 'Turn my script into a faceless video.',
      lengthInner: lengthInnerHtml(),
      modelLabel: videoModelLabel(compose.videoModel),
      aspectLabel: compose.aspect || '16:9',
      durationLabel: (compose.clipDuration || 5) + 's',
      resolutionLabel: compose.resolution || '',
      voiceLabel: voiceDisplayName(),
      soundOn: !!compose.sound,
      generations: clampVideoCount(compose.generations),
      voiceChipHtml: voiceChipHtml(),
      busy: composerBusy,
      signedIn,
      genDisabled,
      genTitle,
      askMode: getAskMode(),
      projectTitle: activeProjectTitle(),
      temp,
    })
  }

  function heroHtml() {
    return homeHeroHtml(view === 'temp' || isTempChat())
  }

  function galleryHtml() {
    return showcaseGridHtml()
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
    const list = $('fs-rail-chats') || $('fs-rail-list')
    if (!list) return
    list.innerHTML = railChatsHtml(listChats())
    list.querySelectorAll('[data-open-chat]').forEach((btn) => {
      btn.addEventListener('click', () => openChat(btn.getAttribute('data-open-chat')))
    })
  }

  function syncTempButton() {
    const btn = $('fs-temp-chat')
    if (!btn) return
    const on = isTempChat()
    btn.setAttribute('aria-pressed', on ? 'true' : 'false')
    btn.classList.toggle('is-on', on)
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
      if (view === 'favorites') {
        main.innerHTML = `<div class="fs-page">
          <div class="fs-page-head">
            <h1>Favorites</h1>
            <div class="fs-toolbar">
              <input type="search" id="fs-search" class="fs-search" placeholder="Search projects" value="${esc(search)}">
              <button type="button" class="btn btn-primary" id="fs-new">New project</button>
            </div>
          </div>
          ${stateBlock(listState, 'No favorites yet', 'Star a project to pin it here.')}
          ${listState === 'ok' ? `<div class="fs-proj-grid">${projects.map(projectCard).join('')}</div>${listHasMore ? '<button type="button" class="btn btn-ghost" id="fs-more-projects">Load more</button>' : ''}` : ''}
        </div>`
      } else {
        main.innerHTML = projectsBoardHtml({
          tab: projTab,
          search,
          items: projects,
          state: listState,
          loadError,
        }) + (listHasMore && listState === 'ok' ? '<button type="button" class="btn btn-ghost" id="fs-more-projects">Load more</button>' : '')
      }
    } else if (view === 'memory') {
      main.innerHTML = memoryBoardHtml(listMemories())
    } else if (view === 'connectors') {
      main.innerHTML = connectorsBoardHtml()
    } else if (view === 'generations') {
      main.innerHTML = historyPane()
    } else {
      const temp = view === 'temp' || isTempChat()
      main.innerHTML = `<div class="fs-home has-composer${temp ? ' is-temp' : ''}">
        <div class="fs-tab-body">
          ${heroHtml()}
          <div class="fs-composer-slot" id="fs-composer-slot">${composerHtml()}</div>
          ${temp ? '' : homeTaglineHtml()}
          ${temp ? '' : galleryHtml()}
        </div>
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
    const main = $('fs-main')
    $('fs-retry')?.addEventListener('click', () => {
      if (view === 'generations' || tab === 'history') refreshJobs()
      else refreshProjects()
    })
    $('fs-new')?.addEventListener('click', () => createDraftProject())
    $('fs-go-all-projects')?.addEventListener('click', () => {
      projTab = 'all'
      refreshProjects()
    })
    document.querySelectorAll('[data-proj-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        projTab = btn.getAttribute('data-proj-tab') || 'all'
        refreshProjects()
      })
    })
    document.querySelectorAll('[data-share]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-share')
        const vis = btn.getAttribute('data-vis') === 'shared' ? 'private' : 'shared'
        try {
          await studioReq('PATCH', '/projects/' + id, { visibility: vis })
          refreshProjects()
        } catch (e) {
          loadError = e.message || 'Could not update sharing'
          renderMain()
        }
      })
    })
    $('fs-search')?.addEventListener('change', (e) => { search = e.target.value; refreshProjects() })
    $('fs-sort')?.addEventListener('change', (e) => { sort = e.target.value; refreshProjects() })
    $('fs-hist-favs')?.addEventListener('change', () => refreshJobs())
    $('fs-more-projects')?.addEventListener('click', loadMoreProjects)
    $('fs-more-jobs')?.addEventListener('click', loadMoreJobs)
    if (main) bindShowcaseGrid(main, { onRecreate: (sample) => applyPreset(sample?.id) })
    document.querySelectorAll('[data-open]').forEach((btn) => {
      btn.addEventListener('click', () => openProject(btn.getAttribute('data-open')))
    })
    bindComposer()
    bindMemoryPage()
    syncTempButton()
  }

  function bindComposer() {
    const form = $('fs-composer')
    if (!form) return
    $('fs-topic')?.addEventListener('input', (e) => {
      compose.topic = e.target.value
      if (isTempChat()) saveTempDraft(compose.topic)
    })
    $('fs-length')?.addEventListener('change', (e) => { compose.length = e.target.value })
    setVideoBarApi({
      get: () => ({ ...compose, voiceName: voiceDisplayName() }),
      set: (patch) => {
        Object.assign(compose, patch)
        persistVideoSettings()
        if (current?.id) scheduleSave()
        paintVideoBar()
      },
      voices: () => voices(),
    })
    bindVideoBarOnce()
    paintVideoBar()
    $('fs-ref-images-btn')?.addEventListener('click', () => $('fs-ref-images')?.click())
    $('fs-ref-images')?.addEventListener('change', onRefFiles)
    $('fs-voice')?.addEventListener('change', (e) => { compose.voice = e.target.value })
    $('fs-voice-retry')?.addEventListener('click', () => {
      loadVoices?.().finally(() => { if (view !== 'project') renderMain() })
    })
    $('fs-auto-btn')?.addEventListener('click', () => {
      const pop = $('fs-auto-pop')
      if (pop) pop.hidden = !pop.hidden
    })
    $('fs-ref-add')?.addEventListener('click', (e) => {
      e.preventDefault()
      const menu = showMenu(plusMenuHtml(), e.currentTarget)
      menu?.querySelectorAll('[data-plus]').forEach((item) => {
        item.addEventListener('click', () => onPlusAction(item.getAttribute('data-plus'), e.currentTarget))
      })
    })
    $('fs-ref-input')?.addEventListener('change', onRefFiles)
    $('fs-ask-btn')?.addEventListener('click', (e) => {
      const menu = showMenu(askMenuHtml(getAskMode()), e.currentTarget)
      menu?.querySelectorAll('[data-ask]').forEach((item) => {
        item.addEventListener('click', () => {
          setAskMode(item.getAttribute('data-ask'))
          closeStudioMenus()
          if (view !== 'project') renderMain()
        })
      })
    })
    $('fs-project-btn')?.addEventListener('click', (e) => {
      const menu = showMenu(projectMenuHtml(projects, getActiveProjectId()), e.currentTarget)
      menu?.querySelectorAll('[data-pick-project]').forEach((item) => {
        item.addEventListener('click', () => {
          setActiveProjectId(item.getAttribute('data-pick-project') || '')
          closeStudioMenus()
          if (view !== 'project') renderMain()
        })
      })
      menu?.querySelector('[data-new-project]')?.addEventListener('click', () => {
        closeStudioMenus()
        createDraftProject()
      })
    })
    $('fs-skills-btn')?.addEventListener('click', (e) => openElementsMenu(e.currentTarget))
    $('fs-connectors-btn')?.addEventListener('click', (e) => openConnectorsMenu(e.currentTarget))
    $('fs-gen')?.addEventListener('click', (e) => {
      if (!hasSession()) {
        e.preventDefault()
        goSignIn()
      }
    })
    form.addEventListener('submit', onGenerate)
    renderRefs()
    paintVideoBar()
  }

  function onPlusAction(kind, anchor) {
    if (kind === 'file') {
      closeStudioMenus()
      $('fs-ref-input')?.click()
      return
    }
    if (kind === 'elements') {
      openElementsMenu(anchor)
      return
    }
    if (kind === 'connectors') {
      openConnectorsMenu(anchor)
    }
  }

  function openElementsMenu(anchor) {
    const menu = showMenu(elementsMenuHtml(), anchor)
    menu?.querySelectorAll('[data-element]').forEach((item) => {
      item.addEventListener('click', () => {
        closeStudioMenus()
        applyPreset(item.getAttribute('data-element'))
      })
    })
  }

  function openConnectorsMenu(anchor) {
    const menu = showMenu(connectorsMenuHtml(), anchor)
    const filter = () => {
      const q = (menu.querySelector('#fs-conn-search')?.value || '').toLowerCase()
      menu.querySelectorAll('[data-conn]').forEach((row) => {
        row.hidden = q && !row.textContent.toLowerCase().includes(q)
      })
    }
    menu?.querySelector('#fs-conn-search')?.addEventListener('input', filter)
  }

  function bindMemoryPage() {
    if (view !== 'memory') return
    $('fs-mem-import')?.addEventListener('click', () => $('fs-mem-file')?.click())
    $('fs-mem-file')?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file) return
      try {
        const text = await file.text()
        importMemories(text)
        renderMain()
      } catch (_) {}
    })
    $('fs-mem-plus')?.addEventListener('click', (e) => {
      const menu = showMenu(plusMenuHtml(), e.currentTarget)
      menu?.querySelectorAll('[data-plus]').forEach((item) => {
        item.addEventListener('click', () => {
          const kind = item.getAttribute('data-plus')
          if (kind === 'file') {
            closeStudioMenus()
            $('fs-mem-file')?.click()
          } else if (kind === 'elements') {
            openElementsMenu(e.currentTarget)
          } else if (kind === 'connectors') {
            openConnectorsMenu(e.currentTarget)
          }
        })
      })
    })
    $('fs-mem-form')?.addEventListener('submit', (e) => {
      e.preventDefault()
      const input = $('fs-mem-input')
      addMemory(input?.value || '', { kind: 'note' })
      if (input) input.value = ''
      renderMain()
    })
  }

  async function createDraftProject() {
    if (!hasSession()) {
      goSignIn()
      return
    }
    try {
      const data = await studioReq('POST', '/projects', {
        draft: true,
        title: 'Untitled project',
        aspect: compose.aspect || '16:9',
        length: compose.length || 'long_180',
        duration_seconds: lengthList().find((d) => d.id === compose.length)?.seconds || 180,
        voice_id: compose.voice || '',
        video_model: compose.videoModel || DEFAULT_VIDEO_MODEL,
        clip_duration: compose.clipDuration,
        video_resolution: compose.resolution || '',
        video_sound: !!compose.sound,
        video_count: clampVideoCount(compose.generations),
      })
      const project = data.project
      setActiveProjectId(project.id)
      if (!isTempChat()) upsertChat({ title: project.title || 'Untitled project', projectId: project.id, prompt: '' })
      current = project
      view = 'project'
      pushPath()
      renderMain()
      markRail()
      refreshProjects()
    } catch (e) {
      loadError = e.message || 'Could not create the project'
      view = 'projects'
      listState = 'error'
      renderMain()
    }
  }

  function startNewChat() {
    setTempChat(false)
    compose.topic = ''
    refs = []
    go('home')
  }

  function startTempChat() {
    parkWizard?.(null)
    window.fvStudioUnbind?.()
    current = null
    setTempChat(true)
    compose.topic = loadTempDraft() || ''
    refs = []
    view = 'temp'
    tab = 'gallery'
    pushPath()
    markRail()
    renderMain()
    $('fs-topic')?.focus()
  }

  function openSearch() {
    showOverlay(searchOverlayHtml(searchChats(''), ''))
    const modal = document.getElementById('fs-search-modal')
    const input = document.getElementById('fs-chat-search')
    const list = document.getElementById('fs-search-list')
    const bindHits = () => {
      list?.querySelectorAll('[data-open-chat]').forEach((btn) => {
        btn.addEventListener('click', () => {
          closeStudioMenus()
          openChat(btn.getAttribute('data-open-chat'))
        })
      })
    }
    const paintList = (q) => {
      if (!list) return
      const html = searchOverlayHtml(searchChats(q), q)
      const tmp = document.createElement('div')
      tmp.innerHTML = html
      const next = tmp.querySelector('#fs-search-list')
      if (next) list.innerHTML = next.innerHTML
      bindHits()
    }
    bindHits()
    input?.focus()
    input?.addEventListener('input', () => paintList(input.value))
    modal?.addEventListener('click', (e) => { if (e.target === modal) closeStudioMenus() })
  }

  async function openChat(id) {
    const chat = getChat(id)
    if (!chat) return
    setTempChat(false)
    compose.topic = chat.prompt || ''
    if (chat.projectId) {
      setActiveProjectId(chat.projectId)
      await openProject(chat.projectId)
      return
    }
    view = 'home'
    pushPath()
    renderMain()
    markRail()
  }

  let composerDock = null
  function padComposer() {
    if (composerDock) {
      composerDock.disconnect()
      composerDock = null
    }
    const main = $('fs-main')
    const home = document.querySelector('.fs-home.has-composer')
    const form = $('fs-composer')
    const slot = $('fs-composer-slot')
    if (!main || !home || !form) return
    const applyPad = () => {
      home.style.setProperty('--fs-composer-h', Math.ceil(form.getBoundingClientRect().height + 28) + 'px')
    }
    if (home.classList.contains('is-temp') || !slot) {
      applyPad()
      return
    }
    const sync = () => {
      const mainRect = main.getBoundingClientRect()
      const marker = slot.getBoundingClientRect()
      const dock = marker.top < mainRect.top + 8
      home.classList.toggle('is-docked', dock)
      if (dock) {
        const stage = document.querySelector('.fs-stage') || main
        const r = stage.getBoundingClientRect()
        const w = Math.min(760, Math.max(280, r.width - 40))
        form.style.position = 'fixed'
        form.style.left = (r.left + (r.width - w) / 2) + 'px'
        form.style.width = w + 'px'
        form.style.bottom = '18px'
        form.style.top = 'auto'
        form.style.zIndex = '20'
        slot.style.height = Math.ceil(form.getBoundingClientRect().height) + 'px'
      } else {
        form.style.position = ''
        form.style.left = ''
        form.style.width = ''
        form.style.bottom = ''
        form.style.top = ''
        form.style.zIndex = ''
        slot.style.height = ''
      }
      applyPad()
    }
    main.addEventListener('scroll', sync, { passive: true })
    window.addEventListener('resize', sync)
    let ro = null
    if (typeof ResizeObserver === 'function') {
      ro = new ResizeObserver(sync)
      ro.observe(form)
    }
    composerDock = {
      disconnect() {
        main.removeEventListener('scroll', sync)
        window.removeEventListener('resize', sync)
        ro?.disconnect()
        home.classList.remove('is-docked')
        form.style.position = ''
        form.style.left = ''
        form.style.width = ''
        form.style.bottom = ''
        form.style.zIndex = ''
      },
    }
    sync()
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
    compose.topic = preset.prompt || preset.scaffold
    compose.length = preset.length || compose.length
    compose.aspect = preset.aspect || compose.aspect
    if (preset.voice) compose.voice = preset.voice
    tab = 'gallery'
    if (view !== 'temp') view = 'home'
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
    const files = [...(e.target.files || [])].slice(0, 8)
    files.forEach((file) => {
      if (file.type && file.type.startsWith('image/')) {
        if (refs.length < 4) refs.push({ file, preview: URL.createObjectURL(file) })
        return
      }
      if (!isTempChat()) addMemory('Attached file: ' + file.name, { kind: 'file' })
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
    if (getVoicesState?.() !== 'ready') await loadVoices?.()
    if (!ensureVoice()) {
      if (err) { err.hidden = false; err.textContent = 'Voices are not available. Retry loading voices, then generate.' }
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
    if (getAskMode() === 'ask') {
      const ok = await confirmAsk(topic)
      if (!ok) return
    }
    composerBusy = true
    if (err) err.hidden = true
    $('fs-gen') && ($('fs-gen').disabled = true)
    try {
      const payload = {
        topic,
        title: topic.slice(0, 72),
        aspect: compose.aspect,
        length: picked.id,
        duration_seconds: picked.seconds,
        voice_id: compose.voice,
        model: compose.model || DEFAULT_IMAGE_MODEL,
        ...videoSettingsPayload(),
        pipeline: {
          topic,
          aspect: compose.aspect,
          durationId: picked.id,
          voiceId: compose.voice,
          videoModel: compose.videoModel || DEFAULT_VIDEO_MODEL,
          clipDuration: compose.clipDuration,
          resolution: compose.resolution,
          sound: !!compose.sound,
          generations: clampVideoCount(compose.generations),
          phase: 1,
        },
      }
      const existingId = isTempChat() ? '' : getActiveProjectId()
      let project
      if (existingId) {
        const data = await studioReq('PATCH', '/projects/' + existingId, payload)
        project = data.project
      } else {
        const data = await studioReq('POST', '/projects', payload)
        project = data.project
      }
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
        parameters: { length: picked.id, duration_seconds: picked.seconds, aspect: compose.aspect, voice_id: compose.voice, ...videoSettingsPayload() },
      })
      if (!isTempChat()) {
        upsertChat({ title: topic.slice(0, 72), prompt: topic, projectId: project.id })
        addMemory(topic, { kind: 'chat' })
        setActiveProjectId(project.id)
      }
      current = project
      persistVideoSettings()
      pendingAutoScript = true
      view = 'project'
      pushPath()
      renderMain()
      markRail()
    } catch (ex) {
      if (err) { err.hidden = false; err.textContent = ex.message || 'Could not create the project' }
    } finally {
      composerBusy = false
      if (view !== 'project') {
        const btn = $('fs-gen')
        if (btn) btn.disabled = false
      }
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
      if (getVoicesState?.() !== 'ready') await loadVoices?.()
      ensureVoice()
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
        video_model: snap.videoModel || current.video_model || compose.videoModel,
        clip_duration: snap.clipDuration || current.clip_duration || compose.clipDuration,
        video_resolution: snap.resolution || current.video_resolution || compose.resolution || '',
        video_sound: snap.sound != null ? !!snap.sound : (current.video_sound != null ? !!current.video_sound : !!compose.sound),
        video_count: clampVideoCount(snap.generations || current.video_count || compose.generations),
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
      compose.videoModel = current.video_model || current.pipeline?.videoModel || STOCK_VIDEO_MODEL
      compose.aspect = current.aspect === '9:16' ? '9:16' : (current.aspect === '16:9' ? '16:9' : compose.aspect)
      compose.clipDuration = Number(current.clip_duration || current.pipeline?.clipDuration) || compose.clipDuration
      compose.resolution = current.video_resolution || current.pipeline?.resolution || compose.resolution
      compose.sound = current.video_sound != null ? !!current.video_sound : (current.pipeline?.sound != null ? !!current.pipeline.sound : compose.sound)
      compose.generations = clampVideoCount(current.video_count || current.pipeline?.generations || compose.generations)
      compose.voice = pickDefaultVoiceId(voices(), current.voice_id || current.pipeline?.voiceId || compose.voice)
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
      const key = el.getAttribute('data-fs-view')
      el.classList.toggle('is-on', key === view || (view === 'home' && key === 'home'))
    })
    renderRailProjects()
    syncTempButton()
  }

  async function go(next) {
    if (next === 'search') {
      openSearch()
      return
    }
    if (next === 'temp') {
      startTempChat()
      return
    }
    await flushSave()
    parkWizard?.(null)
    window.fvStudioUnbind?.()
    current = null
    setTempChat(false)
    view = next
    if (next === 'home') tab = 'gallery'
    if (next === 'generations') tab = 'history'
    if (next === 'projects') projTab = projTab || 'all'
    pushPath()
    markRail()
    if (next === 'generations' || next === 'favorites') refreshJobs()
    if (next === 'memory' || next === 'connectors') renderMain()
    else refreshProjects()
  }

  async function leave() {
    await flushSave()
    parkWizard?.(null)
    window.fvStudioUnbind?.()
  }

  function onKey(e) {
    if (e.key !== 'Escape') return
    closeStudioMenus()
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
    const latest = parsePath()
    view = latest.view
    if (latest.tab) tab = latest.tab
    setTempChat(view === 'temp')
    if (latest.id) {
      openProject(latest.id)
      return
    }
    current = null
    try { parkWizard?.(null) } catch (_) {}
    window.fvStudioUnbind?.()
    markRail()
    if (view === 'generations' || tab === 'history') refreshJobs()
    else if (view === 'memory' || view === 'connectors' || view === 'temp') renderMain()
    else refreshProjects()
    } catch (e) {
      try { console.warn('[fs-path]', e) } catch (_) {}
      try { renderMain() } catch (_) { window.__mountStudioHome?.() }
    }
  }

  window.fsStudioShow = showFromPath
  window.fsStudioGo = go
  window.fsStudioLeave = leave

  $('fs-rail-toggle')?.addEventListener('click', () => setCollapsed(!collapsed()))
  $('fs-rail-new')?.addEventListener('click', () => startNewChat())
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#fs-temp-chat')) return
    e.preventDefault()
    startTempChat()
  })
  document.querySelectorAll('#fs-rail [data-fs-view]').forEach((btn) => {
    btn.addEventListener('click', () => go(btn.getAttribute('data-fs-view')))
  })
  document.addEventListener('click', (e) => {
    if (e.target.closest('#fs-pop .fs-menu, #fs-ref-add, #fs-ref-images-btn, #fs-ask-btn, #fs-project-btn, #fs-connectors-btn, #fs-skills-btn, #fs-mem-plus, #fs-auto-btn, #fs-video-model, #fs-aspect, #fs-clip-duration, #fs-resolution, #fs-sound, #fs-voice, #fs-count, [data-fs-view="search"]')) return
    if (e.target.closest('#fs-auto-pop')) return
    if (!e.target.closest('#fs-pop')) {
      const pop = $('fs-auto-pop')
      if (pop && !pop.hidden && !e.target.closest('#fs-auto-btn')) pop.hidden = true
      if (!e.target.closest('#fs-search-modal, #fs-ask-modal')) closeStudioMenus()
    }
  })
  document.addEventListener('keydown', onKey)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushSave({ keepalive: true })
  })
  window.addEventListener('pagehide', () => { flushSave({ keepalive: true }) })
  setVideoBarApi({
    get: () => ({ ...compose, voiceName: voiceDisplayName() }),
    set: (patch) => {
      Object.assign(compose, patch)
      persistVideoSettings()
      if (current?.id) scheduleSave()
      paintVideoBar()
    },
    voices: () => voices(),
  })
  bindVideoBarOnce()
  setCollapsed(collapsed())
  const voiceState = getVoicesState?.()
  const voiceBoot = (voiceState === 'ready' && voices().length)
    ? Promise.resolve()
    : (loadVoices?.() || Promise.resolve())
  voiceBoot.finally(() => {
    ensureVoice()
    if (view !== 'project') renderMain()
    else paintVideoBar()
  })
  showFromPath()
}
