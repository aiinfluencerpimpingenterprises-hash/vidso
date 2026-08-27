import {
  MCP_CONNECT_STEPS,
  MCP_DEMOS,
  MCP_FAQ,
  MCP_HERO,
  MCP_PROMO,
  MCP_WORKFLOW_CATEGORIES,
  MCP_WORKFLOWS,
} from '/lib/mcp-page.js'
import {
  bindPlaceholders,
  demoHtml,
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

function stepHtml(step, url) {
  let extra = ''
  if (step.action === 'copy-url') {
    extra = `<label class="copy-field">
      <span class="sr-only">Connector URL</span>
      <input id="mcp-url" type="text" readonly value="${url}">
      <button type="button" class="btn btn-ghost" data-copy="#mcp-url">Copy</button>
    </label>`
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

const demoTabs = document.getElementById('demo-tabs')
const demoRoot = document.getElementById('demo-root')
demoTabs.innerHTML = MCP_DEMOS.map((d, i) =>
  `<button type="button" role="tab" id="demo-tab-${d.id}" data-tab="${d.id}" aria-selected="${i === 0 ? 'true' : 'false'}" aria-controls="demo-panel-${d.id}" tabindex="${i === 0 ? 0 : -1}">${d.label}</button>`
).join('')
demoRoot.innerHTML = MCP_DEMOS.map((d, i) =>
  `<div id="demo-panel-${d.id}" role="tabpanel" aria-labelledby="demo-tab-${d.id}" ${i === 0 ? '' : 'hidden'}>${demoHtml(d)}</div>`
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

loadMcpTools().then((data) => {
  const url = data?.server?.url || defaultUrl
  const input = document.getElementById('mcp-url')
  if (input) input.value = url
  const tools = Array.isArray(data.tools) ? data.tools : []
  const root = document.getElementById('tools-grid')
  root.innerHTML = tools.length
    ? tools.map((t) => toolCardHtml({ name: t.name, description: t.description, image: '' })).join('')
    : '<p class="tools-empty">The live registry returned no tools.</p>'
  bindPlaceholders(root)
}).catch(() => {
  document.getElementById('tools-grid').innerHTML = '<p class="tools-empty">Could not load the live tool registry.</p>'
})
