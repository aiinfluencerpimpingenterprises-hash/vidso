import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  ARCHIVED_PANELS,
  HIDDEN_CHROME_PANELS,
  NAV_SEARCH_ITEMS,
  panelArchived,
  panelHiddenFromChrome,
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

test('faceless studio is live by URL but off the public chrome', () => {
  const restore = stubBrowser()
  try {
    assert.equal(ARCHIVED_PANELS.includes('facelessstudio'), false)
    assert.equal(panelArchived('facelessstudio'), false)
    assert.equal(HIDDEN_CHROME_PANELS.includes('facelessstudio'), true)
    assert.equal(panelHiddenFromChrome('facelessstudio'), true)
    const searchable = NAV_SEARCH_ITEMS
      .filter((it) => !panelArchived(it.id) && !panelHiddenFromChrome(it.id))
      .map((it) => it.id)
    assert.equal(searchable.includes('facelessstudio'), false)
    const cards = TOOL_GALLERY.filter((t) => !panelArchived(t.id) && !panelHiddenFromChrome(t.id)).map((t) => t.id)
    assert.equal(cards.includes('facelessstudio'), false)
  } finally {
    restore()
  }
})

test('the top nav, profile dropdown, and settings keep Faceless Studio hidden', () => {
  assert.match(dashboard, /id="nav-facelessstudio"[^>]*\bhidden\b/)
  assert.match(dashboard, /id="user-studio-btn"[^>]*\bhidden\b/)
  assert.match(dashboard, /id="settings-studio"[^>]*\bhidden\b/)
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
