import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  FEATURES_ITEMS,
  FEATURES_PROMO,
  MODELS_COLUMNS,
  MODELS_NAV_PROMO,
  NAV_CLOSE_MS,
  NAV_ITEMS,
  NAV_OMITTED,
  NAV_OPEN_MS,
  RESOURCES_COLUMNS,
  TOOLS_COLUMNS,
  TOOLS_CTA,
  allNavLinks,
} from '../lib/landing-nav.js'
import { APP_HOME_HREF, PRICING_HREF, TOOL_MENU_ITEMS } from '../lib/public-tools.js'
import { ROADMAP_SECTIONS } from '../lib/landing-capability.js'

const menuJs = readFileSync(new URL('../lib/landing-tools-menu.js', import.meta.url), 'utf8')
const css = readFileSync(new URL('../home/landing-redesign.css', import.meta.url), 'utf8')
const home = readFileSync(new URL('../home/index.html', import.meta.url), 'utf8')

test('nav config holds one editable list of live routes', () => {
  assert.deepEqual(NAV_ITEMS.map((i) => i.label), ['Tools', 'Models', 'Features', 'Resources', 'Pricing'])
  assert.equal(NAV_OPEN_MS, 100)
  assert.equal(NAV_CLOSE_MS, 200)
  assert.equal(TOOLS_CTA.href, APP_HOME_HREF)
  assert.equal(APP_HOME_HREF, '/dashboard')
  assert.ok(TOOLS_COLUMNS.flatMap((c) => c.items).filter((i) => i.id !== 'mcp').every((i) => i.href === APP_HOME_HREF))
  assert.equal(TOOLS_COLUMNS.flatMap((c) => c.items).find((i) => i.id === 'mcp').href, '/mcp')
  assert.equal(NAV_ITEMS.find((i) => i.id === 'pricing').href, PRICING_HREF)
  assert.equal(PRICING_HREF, '/home#pricing')
  assert.deepEqual(TOOLS_COLUMNS.map((c) => c.label), ['Create', 'Short form', 'Audio and captions', 'Edit', 'Popular'])
  assert.ok(TOOLS_COLUMNS.at(-1).popular)
  assert.equal(MODELS_NAV_PROMO.browseHref, '/models')
  assert.match(FEATURES_PROMO, /features-promo\.jpg$/)
  assert.equal(RESOURCES_COLUMNS.length, 1)
  assert.equal(RESOURCES_COLUMNS[0].label, 'Need help')
})

test('every menu href is a real shipped route or mailto', () => {
  const live = new Set(Object.values(TOOL_MENU_ITEMS).map((t) => t.href))
  for (const row of allNavLinks()) {
    assert.ok(row.label && !row.label.includes('—') && !row.label.includes('–'), row.label)
    if (row.description) {
      assert.ok(!row.description.includes('—') && !row.description.includes('–'), row.description)
    }
    if (row.href.startsWith('mailto:')) continue
    if (row.href.startsWith('/home#') || row.href.startsWith('/models#')) continue
    if (row.href === '/models' || row.href === '/mcp' || row.href === '/home#faq' || row.href === APP_HOME_HREF) continue
    assert.ok(live.has(row.href) || row.href === PRICING_HREF, row.href)
  }
  assert.ok(FEATURES_ITEMS.every((i) => i.href))
  assert.equal(FEATURES_ITEMS.some((i) => i.label === 'Vidso CLI'), false)
  assert.ok(MODELS_COLUMNS.every((c) => c.items.length))
  assert.equal(ROADMAP_SECTIONS, false)
})

test('omitted items are documented and ranking stays because /ranking ships', () => {
  const labels = NAV_OMITTED.map((o) => o.label)
  for (const name of ['Vidso CLI', 'Tutorials', 'Blog', "What's New", 'Changelog', 'Discord', 'Compare models']) {
    assert.ok(labels.includes(name), name)
  }
  assert.ok(allNavLinks().some((r) => r.id === 'ranking' && r.href === APP_HOME_HREF))
  assert.ok(FEATURES_ITEMS.filter((i) => i.id !== 'mcp').every((i) => i.href === APP_HOME_HREF))
})

test('menu mounter and bar CSS match the full-width OpenArt pattern', () => {
  assert.match(menuJs, /aria-haspopup/)
  assert.match(menuJs, /aria-expanded/)
  assert.match(menuJs, /setAttribute\('role', 'menu'\)/)
  assert.match(menuJs, /nav-drawer-lock/)
  assert.equal(TOOLS_CTA.label, 'Start Creating')
  assert.match(css, /background:#0e0e10/)
  assert.match(css, /border-bottom:1px solid/)
  assert.match(css, /#FE0C30/)
  assert.match(css, /prefers-reduced-motion/)
  assert.match(css, /nav-drawer-lock/)
  assert.match(home, /id="navDrawer"/)
  assert.match(home, /nav-drawer-foot/)
  assert.match(home, /href="\/signup"/)
})
