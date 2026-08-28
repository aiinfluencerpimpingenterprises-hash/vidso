import {
  MCP_APP_TOOLS,
  MCP_CONNECT_STEPS,
  MCP_DEMOS,
  MCP_FAQ,
  MCP_FEATURE_CARDS,
  MCP_HERO,
  MCP_PROMO,
  MCP_TOOL_COPY,
  MCP_WORKFLOW_CATEGORIES,
  MCP_WORKFLOWS,
} from '/lib/mcp-page.js'
import {
  bindPlaceholders,
  claudeDemoHtml,
  faqHtml,
  initAccordion,
  initCopyButtons,
  initPromo,
  initTabs,
  loadMcpTools,
  pairLockupHtml,
  toolCardHtml,
  workflowCardHtml,
} from '/lib/connect-pages.js'
import { CLAUDE_ICON_URL } from '/lib/brand-assets.js'
import { mcpIssueToken, mcpConnectorUrl } from '/lib/youtube-client.js'

document.getElementById('hero-fan').innerHTML = pairLockupHtml({
  partnerSrc: CLAUDE_ICON_URL,
  partnerAlt: 'Claude',
  caption: 'Claude × Vidso',
})
document.getElementById('hero-top').textContent = MCP_HERO.headingTop
document.getElementById('hero-accent').textContent = MCP_HERO.headingAccent
document.getElementById('hero-sub').textContent = MCP_HERO.subheading
initPromo(MCP_PROMO)

const origin = location.origin
const defaultUrl = origin + '/api/mcp'

document.querySelectorAll('[data-claude-tab]').forEach((img) => { img.src = CLAUDE_ICON_URL })

function stepHtml(step, url) {
  let extra = ''
  if (step.action === 'copy-url') {
    extra = `<label class="copy-field">
      <span class="sr-only">Connector URL</span>
      <input id="mcp-url" type="text" readonly value="${url}">
      <button type="button" class="btn btn-ghost" data-copy="#mcp-url">Copy</button>
    </label>
    <p class="mcp-url-hint" id="mcp-url-hint">Sign in to fill your personal connector URL.</p>`
  } else if (step.href) {
    const ext = /^https?:/i.test(step.href)
    extra = `<a class="btn btn-primary" href="${step.href}"${ext ? ' target="_blank" rel="noopener noreferrer"' : ''}>${step.label || 'Open'}</a>`
  }
  return `<div class="step">
    <div class="n">${step.n}</div>
    <h3>${step.title}</h3>
    <p>${step.body}</p>
    ${extra}
  </div>`
}

document.getElementById('connect-steps').innerHTML = MCP_CONNECT_STEPS.map((s) => stepHtml(s, defaultUrl)).join('')
initCopyButtons()

async function fillPersonalUrl() {
  const input = document.getElementById('mcp-url')
  const hint = document.getElementById('mcp-url-hint')
  if (!input) return
  try {
    const data = await mcpIssueToken()
    const url = data.connectorUrl || mcpConnectorUrl(data.mcpUrl || defaultUrl, data.token)
    if (url) input.value = url
    if (hint) hint.textContent = 'This URL is private to your Vidso account.'
  } catch (_) {
    if (hint) hint.innerHTML = 'Sign in on <a href="/connections">Connections</a> to get a personal connector URL. The public endpoint is filled for now.'
  }
}
fillPersonalUrl()

const demoTabs = document.getElementById('demo-tabs')
const demoRoot = document.getElementById('demo-root')
if (MCP_DEMOS.length < 2) demoTabs.hidden = true
demoTabs.innerHTML = MCP_DEMOS.map((d, i) =>
  `<button type="button" role="tab" id="demo-tab-${d.id}" data-tab="${d.id}" aria-selected="${i === 0 ? 'true' : 'false'}" aria-controls="demo-panel-${d.id}" tabindex="${i === 0 ? 0 : -1}">${d.label}</button>`
).join('')
demoRoot.innerHTML = MCP_DEMOS.map((d, i) =>
  `<div id="demo-panel-${d.id}" role="tabpanel" aria-labelledby="demo-tab-${d.id}" ${i === 0 ? '' : 'hidden'}>${claudeDemoHtml(d, MCP_FEATURE_CARDS)}</div>`
).join('')
initTabs({
  tabsId: 'demo-tabs',
  panels: Object.fromEntries(MCP_DEMOS.map((d) => [d.id, document.getElementById('demo-panel-' + d.id)])),
})

const rail = document.getElementById('wf-rail')
const grid = document.getElementById('wf-grid')
function renderWorkflows(cat) {
  rail.querySelectorAll('.wf-cat').forEach((b) => {
    const on = b.getAttribute('data-tab') === cat
    b.classList.toggle('is-on', on)
    b.setAttribute('aria-selected', on ? 'true' : 'false')
    b.tabIndex = on ? 0 : -1
  })
  const cards = MCP_WORKFLOWS.filter((c) => c.categories.includes(cat))
  grid.innerHTML = cards.map(workflowCardHtml).join('') || '<p class="tools-empty">No workflows in this category.</p>'
  bindPlaceholders(grid)
}
rail.innerHTML = MCP_WORKFLOW_CATEGORIES.map((c, i) =>
  `<button type="button" class="wf-cat${i === 0 ? ' is-on' : ''}" role="tab" data-tab="${c.id}" aria-selected="${i === 0 ? 'true' : 'false'}">
    <span class="nm">${c.name}</span>
    <span class="bl">${c.blurb}</span>
  </button>`
).join('')
rail.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-tab]')
  if (btn) renderWorkflows(btn.getAttribute('data-tab'))
})
rail.addEventListener('keydown', (e) => {
  const tabs = [...rail.querySelectorAll('[data-tab]')]
  const i = tabs.indexOf(document.activeElement)
  if (i < 0) return
  if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
    e.preventDefault()
    const next = tabs[(i + 1) % tabs.length]
    next.focus()
    renderWorkflows(next.getAttribute('data-tab'))
  }
  if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
    e.preventDefault()
    const prev = tabs[(i - 1 + tabs.length) % tabs.length]
    prev.focus()
    renderWorkflows(prev.getAttribute('data-tab'))
  }
})
renderWorkflows(MCP_WORKFLOW_CATEGORIES[0].id)

document.getElementById('faq-list').innerHTML = faqHtml(MCP_FAQ)
document.querySelector('#faq-list .faq-item')?.classList.add('is-open')
initAccordion()
initCopyButtons()
bindPlaceholders()

function paintTools(list) {
  const root = document.getElementById('tools-grid')
  if (!root) return
  const hrefFor = {
    youtube_status: '/connections',
    youtube_connect_url: '/connections',
    youtube_upload: '/connections',
  }
  const fallback = Object.entries(MCP_TOOL_COPY).map(([name, copy]) => ({ name, ...copy }))
  const tools = Array.isArray(list) && list.length ? list : fallback
  root.innerHTML = tools.map((t) => {
    const copy = MCP_TOOL_COPY[t.name] || {}
    return toolCardHtml({
      name: t.name,
      title: copy.title || t.title || t.name,
      description: copy.description || t.description || '',
      href: hrefFor[t.name] || '/connections',
    })
  }).join('')
}

paintTools()
const appTools = document.getElementById('app-tools-grid')
if (appTools) {
  appTools.innerHTML = MCP_APP_TOOLS.map((t) => toolCardHtml(t)).join('')
}

loadMcpTools().then((data) => {
  const url = data?.server?.url || defaultUrl
  const input = document.getElementById('mcp-url')
  if (input) input.value = url
  if (Array.isArray(data.tools) && data.tools.length) paintTools(data.tools)
}).catch(() => {})
