import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  ARCHIVED_PANELS,
  NAV_SEARCH_ITEMS,
  panelArchived,
  removeArchivedNav,
} from '../lib/app-chrome.js'
import { TOOL_GALLERY } from '../lib/tools-gallery.js'

const dashboard = readFileSync(fileURLToPath(new URL('../dashboard/index.html', import.meta.url)), 'utf8')

function stubBrowser({ search = '', store = {} } = {}) {
  const saved = { location: globalThis.location, sessionStorage: globalThis.sessionStorage }
  globalThis.location = { search }
  globalThis.sessionStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v) },
  }
  return () => {
    globalThis.location = saved.location
    globalThis.sessionStorage = saved.sessionStorage
  }
}

test('faceless studio is live and reachable as its own panel', () => {
  const restore = stubBrowser()
  try {
    assert.equal(ARCHIVED_PANELS.includes('facelessstudio'), false)
    assert.equal(panelArchived('facelessstudio'), false)
    const searchable = NAV_SEARCH_ITEMS.filter((it) => !panelArchived(it.id)).map((it) => it.id)
    assert.equal(searchable.includes('facelessstudio'), true)
    const cards = TOOL_GALLERY.filter((t) => !panelArchived(t.id)).map((t) => t.id)
    assert.equal(cards.includes('facelessstudio'), true)
  } finally {
    restore()
  }
})

test('the profile dropdown and settings keep Faceless Studio hidden', () => {
  assert.match(dashboard, /id="user-studio-btn"[^>]*\bhidden\b/)
  assert.match(dashboard, /id="settings-studio"[^>]*\bhidden\b/)
  // The top nav entry is the live way in — it must not stay archived.
  assert.match(dashboard, /id="nav-facelessstudio"[^>]*data-panel="facelessstudio"/)
  assert.doesNotMatch(dashboard, /id="nav-facelessstudio"[^>]*data-archived/)
})

test('archived entries still drop out of the nav when something is archived', () => {
  const restore = stubBrowser()
  try {
    const removed = []
    const nodes = [
      { attrs: { 'data-archived': '', hidden: '' }, remove() { removed.push('nav') }, removeAttribute() {} },
    ]
    const savedDoc = globalThis.document
    globalThis.document = { querySelectorAll: () => nodes }
    try {
      removeArchivedNav()
    } finally {
      globalThis.document = savedDoc
    }
    assert.deepEqual(removed, ['nav'])
  } finally {
    restore()
  }
})
