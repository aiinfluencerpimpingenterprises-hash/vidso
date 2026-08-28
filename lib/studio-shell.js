/**
 * Supercomputer-style studio chrome: composer, menus, projects board, memory, search.
 */
import { CLAUDE_CONNECTORS_URL, CLAUDE_ICON_URL, YOUTUBE_LOGO_URL } from '/lib/brand-assets.js'
import { STUDIO_SAMPLES } from '/lib/faceless-studio-presets.js'

export { CLAUDE_CONNECTORS_URL, CLAUDE_ICON_URL, YOUTUBE_LOGO_URL }

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]))
}

export function icon(name) {
  const common = 'width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"'
  const map = {
    plus: `<svg ${common}><path d="M12 5v14M5 12h14"/></svg>`,
    search: `<svg ${common}><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.2-3.2"/></svg>`,
    folder: `<svg ${common}><path d="M3 7h6l2 2h10v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 7V5a2 2 0 0 1 2-2h3l2 2"/></svg>`,
    bolt: `<svg ${common}><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/></svg>`,
    plug: `<svg ${common}><path d="M9 7v4M15 7v4M8 11h8v2a4 4 0 0 1-8 0z"/><path d="M12 17v4"/></svg>`,
    brain: `<svg ${common}><path d="M9 4a3 3 0 0 0-3 3v1a3 3 0 0 0-2 3c0 1.2.7 2.2 1.7 2.7A4 4 0 0 0 9 20h.5M15 4a3 3 0 0 1 3 3v1a3 3 0 0 1 2 3c0 1.2-.7 2.2-1.7 2.7A4 4 0 0 1 15 20h-.5"/><path d="M9 8v8M15 8v8M12 6v12"/></svg>`,
    tv: `<svg ${common}><rect x="3" y="5" width="18" height="13" rx="2"/><path d="M8 21h8M12 18v3"/></svg>`,
    grid: `<svg ${common}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
    lock: `<svg ${common}><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>`,
    people: `<svg ${common}><circle cx="9" cy="8" r="3"/><path d="M3 20v-1a5 5 0 0 1 10 0v1"/><circle cx="17" cy="9" r="2.4"/><path d="M21 20v-1a4 4 0 0 0-3-3.9"/></svg>`,
    diamond: `<svg ${common}><path d="M12 3l8 8-8 10L4 11z"/></svg>`,
    incognito: `<svg ${common}><path d="M4 10h16"/><path d="M6 10a6 6 0 0 1 12 0"/><circle cx="8.5" cy="15.5" r="2.5"/><circle cx="15.5" cy="15.5" r="2.5"/><path d="M11 15.5h2"/></svg>`,
    send: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>`,
    chev: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>`,
    run: `<svg ${common}><path d="M8 6l10 6-10 6z"/></svg>`,
    hand: `<svg ${common}><path d="M8 13V6a1.5 1.5 0 0 1 3 0v5"/><path d="M11 11V5a1.5 1.5 0 0 1 3 0v6"/><path d="M14 10V6a1.5 1.5 0 0 1 3 0v8a5 5 0 0 1-5 5H11a5 5 0 0 1-5-5v-3"/></svg>`,
    check: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e8c547" stroke-width="2.6" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>`,
    upload: `<svg ${common}><path d="M12 16V5M7 9l5-5 5 5"/><path d="M5 19h14"/></svg>`,
    box: `<svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><path d="M3 8l9-4 9 4-9 4z"/><path d="M3 8v8l9 4 9-4V8"/><path d="M12 12v8"/></svg>`,
    file: `<svg ${common}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>`,
    at: `<svg ${common}><circle cx="12" cy="12" r="8"/><path d="M16 12a4 4 0 1 1-1.2-2.8V12"/></svg>`,
  }
  return map[name] || ''
}

export function connectorLogosHtml() {
  return `<span class="fs-conn-logos" aria-hidden="true">
    <img src="${esc(CLAUDE_ICON_URL)}" alt="" width="14" height="14">
    <img src="${esc(YOUTUBE_LOGO_URL)}" alt="" width="14" height="14">
  </span>`
}

export function plusMenuHtml() {
  return `<div class="fs-menu fs-plus-menu" id="fs-plus-menu" role="menu">
    <button type="button" role="menuitem" data-plus="file">${icon('file')} Attach file</button>
    <button type="button" role="menuitem" data-plus="elements">${icon('at')} Elements</button>
    <button type="button" role="menuitem" data-plus="connectors">${icon('plug')} Connectors <span class="fs-menu-chev">›</span></button>
  </div>`
}

export function askMenuHtml(mode) {
  const ask = mode !== 'run'
  return `<div class="fs-menu fs-ask-menu" id="fs-ask-menu" role="menu">
    <button type="button" role="menuitem" data-ask="run"${ask ? '' : ' aria-checked="true"'}>
      ${icon('run')}
      <span><strong>Generate without asking</strong><small>The agent runs without confirmation.</small></span>
      ${ask ? '' : icon('check')}
    </button>
    <button type="button" role="menuitem" data-ask="ask"${ask ? ' aria-checked="true"' : ''}>
      ${icon('hand')}
      <span><strong>Ask before generating</strong><small>The agent asks before each generation.</small></span>
      ${ask ? icon('check') : ''}
    </button>
  </div>`
}

export function projectMenuHtml(projects, activeId) {
  const rows = (projects || []).slice(0, 12).map((p) =>
    `<button type="button" role="menuitem" data-pick-project="${esc(p.id)}"${p.id === activeId ? ' aria-checked="true"' : ''}>${icon('folder')} ${esc(p.title || 'Untitled')}</button>`,
  ).join('')
  return `<div class="fs-menu fs-project-menu" id="fs-project-menu" role="menu">
    <button type="button" role="menuitem" data-pick-project=""${activeId ? '' : ' aria-checked="true"'}>${icon('folder')} No project</button>
    ${rows}
    <button type="button" role="menuitem" data-new-project="1">${icon('plus')} New project</button>
  </div>`
}

export function connectorsMenuHtml() {
  return `<div class="fs-menu fs-conn-menu" id="fs-conn-menu" role="menu">
    <label class="fs-menu-search">
      ${icon('search')}
      <input type="search" id="fs-conn-search" placeholder="Search connectors" autocomplete="off">
    </label>
    <a role="menuitem" href="/mcp" data-conn="claude">
      <img src="${esc(CLAUDE_ICON_URL)}" alt="" width="18" height="18"> Claude
    </a>
    <a role="menuitem" href="/youtube" data-conn="youtube">
      <img src="${esc(YOUTUBE_LOGO_URL)}" alt="" width="18" height="18"> YouTube
    </a>
    <a role="menuitem" class="fs-menu-foot" href="/connections">Manage connectors</a>
  </div>`
}

export function elementsMenuHtml() {
  const rows = STUDIO_SAMPLES.map((s) =>
    `<button type="button" role="menuitem" data-element="${esc(s.id)}">${esc(s.name)}</button>`,
  ).join('')
  return `<div class="fs-menu fs-el-menu" id="fs-el-menu" role="menu">
    <p class="fs-menu-label">Elements</p>
    ${rows}
  </div>`
}

export function askConfirmHtml(topic) {
  return `<div class="fs-modal-back" id="fs-ask-modal" role="dialog" aria-modal="true" aria-labelledby="fs-ask-title">
    <div class="fs-modal">
      <h2 id="fs-ask-title">Ask before generating</h2>
      <p>Generate a faceless video from this prompt?</p>
      <p class="fs-modal-quote">${esc(topic)}</p>
      <div class="fs-modal-actions">
        <button type="button" class="btn btn-ghost" data-ask-cancel>Cancel</button>
        <button type="button" class="btn fs-lime-btn" data-ask-go>Generate</button>
      </div>
    </div>
  </div>`
}

export function searchOverlayHtml(chats, q) {
  const needle = String(q || '')
  const items = chats || []
  const list = items.length
    ? items.map((c) =>
      `<button type="button" class="fs-search-hit" data-open-chat="${esc(c.id)}">
        <strong>${esc(c.title)}</strong>
        <span>${esc((c.prompt || '').slice(0, 90))}</span>
      </button>`,
    ).join('')
    : `<div class="fs-search-empty">
        ${icon('search')}
        <strong>No conversations yet</strong>
        <p>Your conversations will appear here.</p>
      </div>`
  return `<div class="fs-modal-back" id="fs-search-modal" role="dialog" aria-modal="true" aria-label="Search conversations">
    <div class="fs-search-card">
      <label class="fs-search-field">
        ${icon('search')}
        <input type="search" id="fs-chat-search" placeholder="Search" value="${esc(needle)}" autocomplete="off">
      </label>
      <div class="fs-search-list" id="fs-search-list">${list}</div>
    </div>
  </div>`
}

export function composerHtml(opts) {
  const {
    topic = '',
    placeholder = 'Turn my script into a faceless video.',
    lengthInner = '',
    aspect = '16:9',
    voiceChipHtml = '',
    busy = false,
    signedIn = false,
    genDisabled = false,
    genTitle = '',
    askMode = 'ask',
    projectTitle = '',
    temp = false,
  } = opts || {}
  const askLabel = askMode === 'run' ? 'Auto run' : 'Ask mode'
  const projLabel = projectTitle || 'No project'
  const sendLabel = busy ? 'Creating' : (signedIn ? 'Generate' : 'Sign in to generate')
  return `<form class="fs-composer fs-composer-sc" id="fs-composer" autocomplete="off">
    <p class="fs-composer-error" id="fs-composer-error" hidden></p>
    <textarea id="fs-topic" class="fs-topic" rows="2" placeholder="${esc(placeholder)}" required>${esc(topic)}</textarea>
    <div class="fs-refs" id="fs-refs"></div>
    <div class="fs-composer-bar">
      <div class="fs-composer-left">
        <button type="button" class="fs-ref-add" id="fs-ref-add" aria-label="Add attachments" aria-haspopup="menu">${icon('plus')}</button>
        <input type="file" id="fs-ref-input" accept="image/*,video/*,audio/*,.txt,.md,.json" hidden>
        <button type="button" class="fs-auto-btn" id="fs-auto-btn" aria-haspopup="true">Auto ${icon('chev')}</button>
      </div>
      <div class="fs-composer-right">
        <button type="button" class="fs-ask-btn" id="fs-ask-btn" aria-haspopup="menu">${esc(askLabel)} ${icon('chev')}</button>
        <button type="${signedIn ? 'submit' : 'button'}" class="fs-send" id="fs-gen"${genDisabled ? ' disabled' : ''}${genTitle ? ` title="${esc(genTitle)}"` : ''} aria-label="${esc(sendLabel)}">${icon('send')}</button>
      </div>
    </div>
    <div class="fs-auto-pop" id="fs-auto-pop" hidden>
      <div class="fs-chips" role="group" aria-label="Project settings">
        <label class="fs-chip">Length
          <select id="fs-length">${lengthInner}</select>
        </label>
        <label class="fs-chip">Aspect
          <select id="fs-aspect">
            <option value="16:9"${aspect === '16:9' ? ' selected' : ''}>16:9 Horizontal</option>
            <option value="9:16"${aspect === '9:16' ? ' selected' : ''}>9:16 Vertical</option>
          </select>
        </label>
        ${voiceChipHtml}
      </div>
    </div>
    ${temp ? '' : `<div class="fs-tool-row">
      <button type="button" class="fs-tool" id="fs-project-btn" aria-haspopup="menu">${icon('folder')} ${esc(projLabel)}</button>
      <button type="button" class="fs-tool" id="fs-skills-btn">${icon('bolt')} Skills</button>
      <button type="button" class="fs-tool" id="fs-connectors-btn" aria-haspopup="menu">${icon('plug')} Connectors ${connectorLogosHtml()}</button>
      <a class="fs-tool fs-tool-mcp" id="fs-try-mcp" href="/mcp">${icon('diamond')} Try MCP</a>
    </div>`}
    ${temp ? '<p class="fs-temp-note">Temporary chats aren\'t saved to your history or memory.</p>' : ''}
  </form>`
}

export function homeHeroHtml(temp) {
  if (temp) {
    return `<div class="fs-hero fs-hero-center">
      <h1 class="fs-hero-title">START A TEMPORARY CHAT</h1>
    </div>`
  }
  return `<div class="fs-hero fs-hero-center">
    <h1 class="fs-hero-title">WHAT ARE WE CREATING TODAY?</h1>
  </div>`
}

export function homeTaglineHtml() {
  return `<div class="fs-home-tag">
    <p>BUILD, GENERATE, AND PUBLISH WITH CONNECTORS AND AUTOMATION</p>
  </div>`
}

export function railChatsHtml(chats) {
  const items = chats || []
  if (!items.length) {
    return `<div class="fs-rail-chats-empty">
      ${icon('folder')}
      <strong>No chats yet</strong>
      <span>Create one to get started.</span>
    </div>`
  }
  return items.slice(0, 16).map((c) =>
    `<button type="button" class="fs-rail-item" data-open-chat="${esc(c.id)}">${esc(c.title)}</button>`,
  ).join('')
}

export function projectsBoardHtml({ tab, search, items, state, loadError }) {
  const t = tab || 'all'
  const empty = !items?.length && state !== 'loading' && state !== 'error'
  let emptyBlock = ''
  if (state === 'loading') emptyBlock = `<div class="fs-state" aria-busy="true"><span class="spinner"></span> Loading…</div>`
  else if (state === 'error') emptyBlock = `<div class="fs-state is-err">${esc(loadError || 'Could not load projects')}<button type="button" class="btn btn-ghost btn-sm" id="fs-retry">Retry</button></div>`
  else if (empty && t === 'shared') {
    emptyBlock = `<div class="fs-proj-empty">
      ${icon('box')}
      <h2>SHARE YOUR PROJECT WITH TEAM</h2>
      <p>Everyone on this project inherits these settings.</p>
      <button type="button" class="btn fs-lime-btn" id="fs-go-all-projects">+ Go to projects</button>
    </div>`
  } else if (empty) {
    emptyBlock = `<div class="fs-proj-empty">
      ${icon('box')}
      <h2>CREATE YOUR FIRST PROJECT</h2>
      <p>Everyone on this project inherits these settings.</p>
      <button type="button" class="btn fs-lime-btn" id="fs-new">+ Create</button>
    </div>`
  }
  const cards = (items || []).map((p) => {
    const vis = p.visibility === 'shared' ? 'shared' : 'private'
    return `<article class="fs-board-card">
      <button type="button" class="fs-board-open" data-open="${esc(p.id)}">
        <strong>${esc(p.title || 'Untitled')}</strong>
        <span>${esc(p.topic || 'Empty draft')} · ${esc(vis)}</span>
      </button>
      <button type="button" class="fs-board-share" data-share="${esc(p.id)}" data-vis="${esc(vis)}">${vis === 'shared' ? 'Make private' : 'Share'}</button>
    </article>`
  }).join('')
  return `<div class="fs-board">
    <div class="fs-board-head">
      <h1>Projects</h1>
      <button type="button" class="btn fs-lime-btn" id="fs-new">+ New project</button>
    </div>
    <div class="fs-board-tabs">
      <button type="button" class="fs-board-tab${t === 'all' ? ' is-on' : ''}" data-proj-tab="all">${icon('grid')} All</button>
      <button type="button" class="fs-board-tab${t === 'private' ? ' is-on' : ''}" data-proj-tab="private">${icon('lock')} Private</button>
      <button type="button" class="fs-board-tab${t === 'shared' ? ' is-on' : ''}" data-proj-tab="shared">${icon('people')} Shared</button>
      <label class="fs-board-search">
        ${icon('search')}
        <input type="search" id="fs-search" placeholder="Search" value="${esc(search || '')}">
      </label>
    </div>
    ${emptyBlock}
    ${!empty && state !== 'loading' && state !== 'error' ? `<div class="fs-board-grid">${cards}</div>` : ''}
  </div>`
}

export function memoryBoardHtml(memories) {
  const items = memories || []
  const nodes = items.slice(0, 10)
  const placeholders = Math.max(8, 14 - nodes.length)
  const spots = []
  for (let i = 0; i < nodes.length; i++) {
    const a = (Math.PI * 2 * i) / Math.max(nodes.length, 6) - Math.PI / 2
    spots.push({
      x: 50 + Math.cos(a) * 28,
      y: 48 + Math.sin(a) * 32,
      label: nodes[i].text.slice(0, 28),
      kind: nodes[i].kind,
    })
  }
  for (let i = 0; i < placeholders; i++) {
    const a = (Math.PI * 2 * i) / placeholders + 0.4
    spots.push({
      x: 50 + Math.cos(a) * 38,
      y: 50 + Math.sin(a) * 40,
      empty: true,
    })
  }
  const lines = spots.map((s) =>
    `<line x1="50" y1="50" x2="${s.x}" y2="${s.y}" stroke="rgba(255,255,255,.12)" stroke-width="0.4"/>`,
  ).join('')
  const pills = spots.map((s) => s.empty
    ? `<span class="fs-mem-pill is-empty" style="left:${s.x}%;top:${s.y}%"></span>`
    : `<span class="fs-mem-pill" style="left:${s.x}%;top:${s.y}%" title="${esc(s.label)}">${esc(s.label)}</span>`,
  ).join('')
  return `<div class="fs-memory">
    <div class="fs-board-head">
      <h1>Memory</h1>
      <button type="button" class="btn fs-lime-btn" id="fs-mem-import">${icon('upload')} Import</button>
      <input type="file" id="fs-mem-file" accept=".txt,.md,.json,text/plain,application/json" hidden>
    </div>
    <div class="fs-mem-graph">
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">${lines}</svg>
      <div class="fs-mem-core"></div>
      <div class="fs-mem-copy">
        <strong>Vidso memory</strong>
        <span>Learning from every chat</span>
      </div>
      ${pills}
    </div>
    <form class="fs-mem-bar" id="fs-mem-form" autocomplete="off">
      <button type="button" class="fs-ref-add" id="fs-mem-plus" aria-label="Add to memory">${icon('plus')}</button>
      <input type="text" id="fs-mem-input" placeholder="Add a memory" maxlength="400">
      <button type="submit" class="fs-send" aria-label="Save memory">${icon('send')}</button>
    </form>
    <p class="fs-temp-note">Saved on this device. Temporary chats never write here.</p>
  </div>`
}

export function connectorsBoardHtml() {
  return `<div class="fs-board">
    <div class="fs-board-head"><h1>Connectors</h1></div>
    <div class="fs-conn-grid">
      <a class="fs-conn-card" href="/mcp">
        <img src="${esc(CLAUDE_ICON_URL)}" alt="" width="36" height="36">
        <strong>Claude</strong>
        <span>Connect Vidso inside Claude with your private MCP link.</span>
      </a>
      <a class="fs-conn-card" href="/youtube">
        <img src="${esc(YOUTUBE_LOGO_URL)}" alt="" width="36" height="36">
        <strong>YouTube</strong>
        <span>Connect a channel and send finished videos without leaving Vidso.</span>
      </a>
    </div>
    <p><a class="btn btn-ghost" href="/connections">Manage connectors</a></p>
  </div>`
}

export function closeStudioMenus() {
  document.querySelectorAll('#fs-pop .fs-menu, #fs-pop .fs-modal-back, #fs-ask-modal, #fs-search-modal').forEach((el) => el.remove())
  const pop = document.getElementById('fs-pop')
  if (pop) {
    pop.innerHTML = ''
    pop.hidden = true
  }
}

function popHost() {
  let host = document.getElementById('fs-pop')
  if (!host) {
    host = document.createElement('div')
    host.id = 'fs-pop'
    document.body.appendChild(host)
  }
  host.hidden = false
  return host
}

export function showMenu(html, anchor) {
  const host = popHost()
  host.innerHTML = html
  const menu = host.querySelector('.fs-menu')
  if (!menu || !anchor) return menu
  const r = anchor.getBoundingClientRect()
  menu.style.position = 'fixed'
  menu.style.zIndex = '80'
  const placeUp = r.top > window.innerHeight * 0.55
  if (placeUp) {
    menu.style.bottom = (window.innerHeight - r.top + 8) + 'px'
    menu.style.top = 'auto'
  } else {
    menu.style.top = (r.bottom + 8) + 'px'
    menu.style.bottom = 'auto'
  }
  menu.style.left = Math.max(12, Math.min(r.left, window.innerWidth - 280)) + 'px'
  return menu
}

export function showOverlay(html) {
  const host = popHost()
  host.innerHTML = html
  return host
}

export function confirmAsk(topic) {
  return new Promise((resolve) => {
    showOverlay(askConfirmHtml(topic))
    const root = document.getElementById('fs-ask-modal')
    const done = (ok) => {
      closeStudioMenus()
      resolve(ok)
    }
    root?.querySelector('[data-ask-go]')?.addEventListener('click', () => done(true))
    root?.querySelector('[data-ask-cancel]')?.addEventListener('click', () => done(false))
    root?.addEventListener('click', (e) => { if (e.target === root) done(false) })
  })
}
