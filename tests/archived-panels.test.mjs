import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ARCHIVED_PANELS,
  NAV_SEARCH_ITEMS,
  archivePreviewOn,
  panelArchived,
  removeArchivedNav,
} from '../lib/app-chrome.js'
import { TOOL_GALLERY } from '../lib/tools-gallery.js'

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

test('faceless studio is archived and falls back to the default panel', () => {
  const restore = stubBrowser()
  try {
    assert.equal(ARCHIVED_PANELS.includes('facelessstudio'), true)
    assert.equal(panelArchived('facelessstudio'), true)
    assert.equal(panelArchived('videogen'), false)
  } finally {
    restore()
  }
})

test('?studio=1 unlocks the archived panel for the rest of the tab session', () => {
  const store = {}
  let restore = stubBrowser({ search: '?studio=1', store })
  try {
    assert.equal(archivePreviewOn(), true)
    assert.equal(panelArchived('facelessstudio'), false)
  } finally {
    restore()
  }
  // A later navigation drops the query string, but the session flag persists.
  restore = stubBrowser({ search: '', store })
  try {
    assert.equal(panelArchived('facelessstudio'), false)
  } finally {
    restore()
  }
})

test('a fresh tab without the flag stays archived', () => {
  const restore = stubBrowser({ search: '', store: {} })
  try {
    assert.equal(archivePreviewOn(), false)
    assert.equal(panelArchived('facelessstudio'), true)
  } finally {
    restore()
  }
})

test('archived entries drop out of the nav and the tools gallery', () => {
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

    const searchable = NAV_SEARCH_ITEMS.filter((it) => !panelArchived(it.id)).map((it) => it.id)
    assert.equal(searchable.includes('facelessstudio'), false)
    assert.equal(searchable.includes('videogen'), true)

    const cards = TOOL_GALLERY.filter((t) => !panelArchived(t.id)).map((t) => t.id)
    assert.equal(cards.includes('facelessstudio'), false)
    assert.equal(cards.includes('imagegen'), true)
  } finally {
    restore()
  }
})

test('previewing keeps the nav entry instead of removing it', () => {
  const restore = stubBrowser({ search: '?studio=1' })
  try {
    const unhidden = []
    const nodes = [
      { remove() { throw new Error('should not remove while previewing') }, removeAttribute: (a) => unhidden.push(a) },
    ]
    const savedDoc = globalThis.document
    globalThis.document = { querySelectorAll: () => nodes }
    try {
      removeArchivedNav()
    } finally {
      globalThis.document = savedDoc
    }
    assert.deepEqual(unhidden, ['hidden'])
  } finally {
    restore()
  }
})
