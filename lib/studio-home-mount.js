/**
 * Faceless Studio home gallery. Lives in its own module so the dashboard
 * shell can paint cards even if the rest of the app script fails to load.
 */
import { DURATION_PRESETS } from '/lib/entitlements.js'
import { bindShowcaseGrid, showcaseGridHtml, setShowcaseRecreate } from '/lib/studio-showcase.js'
import {
  closeStudioMenus,
  composerHtml,
  connectorsBoardHtml,
  homeHeroHtml,
  homeTaglineHtml,
  memoryBoardHtml,
  projectsBoardHtml,
  railChatsHtml,
  searchOverlayHtml,
  showOverlay,
} from '/lib/studio-shell.js'
import { isTempChat, listChats, listMemories, searchChats, setTempChat } from '/lib/studio-workspace.js'

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]))
}

function lengthInner(selected) {
  const long = DURATION_PRESETS.long || []
  const shorts = DURATION_PRESETS.shorts || []
  const opt = (d) => `<option value="${esc(d.id)}"${d.id === selected ? ' selected' : ''}>${esc(d.label)}</option>`
  return `${long.length ? `<optgroup label="Long form">${long.map(opt).join('')}</optgroup>` : ''}${shorts.length ? `<optgroup label="Shorts">${shorts.map(opt).join('')}</optgroup>` : ''}`
}

function composer(state) {
  const temp = isTempChat()
  return composerHtml({
    topic: state.compose.topic,
    placeholder: temp ? 'Generate a short video ad from my idea' : 'Turn my script into a faceless video.',
    lengthInner: lengthInner(state.compose.length),
    aspect: state.compose.aspect,
    voiceChipHtml: `<label class="fs-chip">Voice
      <select id="fs-voice" disabled><option value="">Sign in to pick a voice</option></select>
    </label>`,
    busy: false,
    signedIn: false,
    genDisabled: false,
    genTitle: 'Sign in to generate',
    askMode: 'ask',
    projectTitle: '',
    temp,
  })
}

function homeHtml(state) {
  const temp = isTempChat()
  return `<div class="fs-home has-composer">
    <div class="fs-tab-body">
      ${homeHeroHtml(temp)}
      ${composer(state)}
      ${temp ? '' : homeTaglineHtml()}
      ${temp ? '' : showcaseGridHtml()}
    </div>
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

function paintRailChats() {
  const list = document.getElementById('fs-rail-chats')
  if (list) list.innerHTML = railChatsHtml(listChats())
}

function openFallbackSearch() {
  showOverlay(searchOverlayHtml(searchChats(''), ''))
  const modal = document.getElementById('fs-search-modal')
  modal?.addEventListener('click', (e) => { if (e.target === modal) closeStudioMenus() })
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
  if (view === 'search') {
    openFallbackSearch()
    return
  }
  if (view === 'projects') {
    main.innerHTML = projectsBoardHtml({ tab: 'all', search: '', items: [], state: 'empty' })
  } else if (view === 'memory') {
    main.innerHTML = memoryBoardHtml(listMemories())
  } else if (view === 'connectors') {
    main.innerHTML = connectorsBoardHtml()
  } else if (view === 'favorites') {
    main.innerHTML = projectsBoardHtml({ tab: 'all', search: '', items: [], state: 'empty' })
  } else if (view === 'generations') {
    main.innerHTML = `<div class="fs-page"><div class="fs-page-head"><h1>My generations</h1></div><div class="fs-state"><strong>Sign in to see generations</strong></div></div>`
  } else {
    main.innerHTML = homeHtml(state)
  }

  main.dataset.fsMounted = opts.mode || 'fallback'
  paintRailChats()

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
  main.querySelector('#fs-new')?.addEventListener('click', () => {
    const err = main.querySelector('.fs-state') || main.querySelector('#fs-composer-error')
    if (err) {
      err.hidden = false
      err.textContent = 'Sign in to create a project.'
    }
  })
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
  if (view === 'home') setTempChat(false)
  state.view = view || 'home'
  if (view === 'home') state.tab = 'gallery'
  if (view === 'generations') state.tab = 'history'
  mountStudioHome(main, { state, force: true, mode: main.dataset.fsMounted === 'full' ? 'full' : 'fallback' })
}

document.getElementById('fs-temp-chat')?.addEventListener('click', () => {
  if (window.fsStudioGo) return
  setTempChat(true)
  studioHomeGo('home')
})
