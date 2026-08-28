/** Accordion, tabs, copy-to-clipboard, and dismissible promo for marketing pages. */

import { bannerDismissed, dismissBanner } from '/lib/app-chrome.js'
import { CLAUDE_ICON_URL, VIDSO_LOGO_URL } from '/lib/brand-assets.js'
import { bindMediaPlaceholders, mediaPlaceholderHtml } from '/lib/media-placeholder.js'

export { mediaPlaceholderHtml }

export function initPromo(cfg) {
  const bar = document.getElementById('mcp-promo')
  if (!bar || !cfg) return
  const show = !!(cfg.enabled && cfg.message && !bannerDismissed(cfg.id))
  bar.hidden = !show
  if (!show) return
  const msg = bar.querySelector('[data-promo-msg]')
  const cta = bar.querySelector('[data-promo-cta]')
  const x = bar.querySelector('[data-promo-dismiss]')
  if (msg) msg.textContent = cfg.message
  if (cta) {
    cta.textContent = cfg.ctaLabel || 'Open'
    cta.setAttribute('href', cfg.ctaHref || '#')
  }
  x?.addEventListener('click', () => {
    dismissBanner(cfg.id)
    bar.hidden = true
  })
}

export function initCopyButtons(root = document) {
  root.querySelectorAll('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const sel = btn.getAttribute('data-copy')
      const live = document.getElementById('copy-live')
      let text = ''
      if (sel === 'value') {
        const field = btn.closest('label, .copy-field')?.querySelector('input, textarea')
        text = field?.value || ''
      } else if (sel) {
        text = document.querySelector(sel)?.value || document.querySelector(sel)?.textContent || ''
      }
      const ok = !!(text && navigator.clipboard?.writeText)
      try {
        if (ok) await navigator.clipboard.writeText(text)
      } catch (_) {}
      const prev = btn.textContent
      btn.textContent = ok ? 'Copied' : 'Copy failed'
      if (live) live.textContent = ok ? 'Copied to clipboard' : 'Could not copy'
      window.setTimeout(() => {
        btn.textContent = prev
        if (live) live.textContent = ''
      }, 1600)
    })
  })
}

export function initAccordion(root) {
  const wrap = root || document.getElementById('faq-list')
  if (!wrap) return
  wrap.querySelectorAll('.faq-item').forEach((item) => {
    const btn = item.querySelector('.faq-q')
    const panel = item.querySelector('.faq-a')
    if (!btn || !panel) return
    btn.addEventListener('click', () => toggleFaq(wrap, item, btn, panel))
    btn.addEventListener('keydown', (e) => {
      const items = [...wrap.querySelectorAll('.faq-q')]
      const i = items.indexOf(btn)
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        items[(i + 1) % items.length]?.focus()
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        items[(i - 1 + items.length) % items.length]?.focus()
      }
      if (e.key === 'Home') {
        e.preventDefault()
        items[0]?.focus()
      }
      if (e.key === 'End') {
        e.preventDefault()
        items[items.length - 1]?.focus()
      }
    })
  })
}

function toggleFaq(wrap, item, btn, panel) {
  const open = btn.getAttribute('aria-expanded') === 'true'
  wrap.querySelectorAll('.faq-item').forEach((other) => {
    const b = other.querySelector('.faq-q')
    const p = other.querySelector('.faq-a')
    b?.setAttribute('aria-expanded', 'false')
    if (p) p.hidden = true
    other.classList.remove('is-open')
  })
  if (!open) {
    btn.setAttribute('aria-expanded', 'true')
    panel.hidden = false
    item.classList.add('is-open')
  }
}

export function initTabs({ tabsId, panels }) {
  const list = document.getElementById(tabsId)
  if (!list) return
  const tabs = [...list.querySelectorAll('[role="tab"]')]
  function select(id, focus) {
    tabs.forEach((tab) => {
      const on = tab.getAttribute('data-tab') === id
      tab.setAttribute('aria-selected', on ? 'true' : 'false')
      tab.tabIndex = on ? 0 : -1
      tab.classList.toggle('is-on', on)
      if (on && focus) tab.focus()
    })
    Object.entries(panels).forEach(([key, el]) => {
      if (!el) return
      el.hidden = key !== id
    })
  }
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => select(tab.getAttribute('data-tab'), false))
    tab.addEventListener('keydown', (e) => {
      const i = tabs.indexOf(tab)
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault()
        const next = tabs[(i + 1) % tabs.length]
        select(next.getAttribute('data-tab'), true)
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        const prev = tabs[(i - 1 + tabs.length) % tabs.length]
        select(prev.getAttribute('data-tab'), true)
      }
      if (e.key === 'Home') {
        e.preventDefault()
        select(tabs[0].getAttribute('data-tab'), true)
      }
      if (e.key === 'End') {
        e.preventDefault()
        select(tabs[tabs.length - 1].getAttribute('data-tab'), true)
      }
    })
  })
  const first = tabs.find((t) => t.getAttribute('aria-selected') === 'true') || tabs[0]
  if (first) select(first.getAttribute('data-tab'), false)
}

export function pairLockupHtml({ partnerSrc, partnerAlt, caption }) {
  const src = String(partnerSrc || '').trim()
  const partner = src
    ? `<img src="${esc(src)}" alt="${esc(partnerAlt || '')}" width="72" height="72" decoding="async">`
    : ''
  return `<div class="pair-lockup">
    <div class="pair-row">
      <div class="pair-logo">${partner}</div>
      <span class="pair-x" aria-hidden="true">×</span>
      <div class="pair-logo pair-vidso"><img src="${esc(VIDSO_LOGO_URL)}" alt="Vidso" width="72" height="72" decoding="async" data-vidso-logo></div>
    </div>
    <p class="pair-caption">${esc(caption)}</p>
  </div>`
}

export function fanHtml(count = 5) {
  const cards = []
  for (let i = 0; i < count; i++) {
    const center = i === Math.floor(count / 2)
    cards.push(`<div class="hero-fan-card${center ? ' is-mark' : ''}" data-media-ph>${center ? '<div class="hero-fan-mark" aria-hidden="true">V</div>' : ''}</div>`)
  }
  return `<div class="hero-fan" aria-hidden="true">${cards.join('')}</div>`
}

export function demoHtml(demo) {
  const shot = demo.image
    ? `<div class="demo-pane">
        <div class="demo-pane-h">${esc(demo.resultLabel || 'Result')}</div>
        ${mediaPlaceholderHtml({ src: demo.image, ratio: '9 / 16', className: 'demo-shot', alt: demo.resultLabel || 'Result' })}
      </div>`
    : ''
  return `
    <div class="demo-grid${shot ? '' : ' is-single'}">
      <div class="demo-pane">
        <div class="demo-pane-h">Prompt</div>
        <p class="demo-prompt">${esc(demo.prompt)}</p>
        <div class="tool-call">
          <div class="tool-call-h">${esc(demo.toolName)}</div>
          <div class="chips">${(demo.chips || []).map((c) => `<span class="chip">${esc(c.label)}</span>`).join('')}</div>
        </div>
        <p class="demo-reply">${esc(demo.reply)}</p>
      </div>
      ${shot}
    </div>`
}

export function claudeDemoHtml(demo, cards = []) {
  const count = Math.max(0, Number(demo.placeholders) || 0)
  const grid = count
    ? `<div class="claude-ph-grid">${Array.from({ length: count }, () =>
        mediaPlaceholderHtml({ src: '', ratio: '3 / 4', className: 'claude-ph' })
      ).join('')}</div>`
    : ''
  const cardHtml = cards.map((c) => `
    <article class="claude-card">
      <p class="claude-card-n">${esc(c.n)}</p>
      <div>
        <h3>${esc(c.title)}</h3>
        <p>${esc(c.body)}</p>
      </div>
    </article>`).join('')
  return `
    <div class="claude-demo">
      <div class="mac-window">
        <div class="mac-bar">
          <div class="mac-dots" aria-hidden="true">
            <span class="mac-dot mac-close"></span>
            <span class="mac-dot mac-min"></span>
            <span class="mac-dot mac-full"></span>
          </div>
          <p class="mac-title">${esc(demo.windowTitle || 'Claude • Vidso connector')}</p>
        </div>
        <div class="mac-body">
          <div class="claude-bubble">${esc(demo.prompt)}</div>
          <div class="claude-reply">
            <img class="claude-mark" src="${esc(CLAUDE_ICON_URL)}" alt="" width="28" height="28" decoding="async">
            <div>
              <p>${esc(demo.reply)}</p>
              <div class="tool-call">
                <div class="tool-call-h">${esc(demo.toolName)}</div>
                <div class="chips">${(demo.chips || []).map((c) => `<span class="chip">${esc(c.label)}</span>`).join('')}</div>
              </div>
            </div>
          </div>
          ${grid}
          ${demo.status ? `<p class="claude-status">${esc(demo.status)}</p>` : ''}
        </div>
      </div>
      <div class="claude-cards">${cardHtml}</div>
    </div>`
}

export function workflowCardHtml(card) {
  const inner = `${card.image
    ? mediaPlaceholderHtml({ src: card.image, ratio: '16 / 9', className: 'wf-shot', alt: card.name })
    : ''}
    <div class="wf-meta">
      <span class="wf-name">${esc(card.name)}</span>
      <span class="wf-right"><span class="wf-time">${esc(card.time)}</span><span class="wf-tag">${esc(card.tag)}</span></span>
    </div>`
  if (card.href) {
    return `<a class="wf-card" href="${esc(card.href)}">${inner}</a>`
  }
  return `<article class="wf-card">${inner}</article>`
}

export function faqHtml(items) {
  return items.map((it, i) => {
    const id = 'faq-' + i
    return `<div class="faq-item">
      <h3>
        <button type="button" class="faq-q" id="${id}-q" aria-expanded="${i === 0 ? 'true' : 'false'}" aria-controls="${id}-a">
          <span>${esc(it.q)}</span>
          <span class="faq-ico" aria-hidden="true"></span>
        </button>
      </h3>
      <div class="faq-a" id="${id}-a" role="region" aria-labelledby="${id}-q" ${i === 0 ? '' : 'hidden'}>
        <p>${esc(it.a)}</p>
      </div>
    </div>`
  }).join('')
}

export function toolCardHtml(tool) {
  const title = tool.title || tool.name
  const href = tool.href
  const shot = tool.image
    ? mediaPlaceholderHtml({ src: tool.image, ratio: '16 / 9', className: 'tool-shot', alt: title })
    : ''
  const inner = `${shot}
    <div class="tool-copy">
      <h3>${esc(title)}</h3>
      <p>${esc(tool.description)}</p>
    </div>`
  if (href) {
    return `<a class="tool-card" href="${esc(href)}">${inner}</a>`
  }
  return `<article class="tool-card">${inner}</article>`
}

export async function loadMcpTools() {
  const res = await fetch('/api/mcp/tools', { headers: { Accept: 'application/json' } })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Could not load MCP tools')
  return data
}

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]))
}

export function bindPlaceholders(root = document) {
  bindMediaPlaceholders(root)
}
