import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  CATALOG_TABS,
  HOME_PROMPT_MODES,
  PLACEHOLDER_FILES,
  SIDEBAR_SECTIONS,
  STUDIO_LENGTH,
  STUDIO_TOOL_COPY,
  TEMPLATES,
  TUTORIALS,
  WHATS_NEW,
  allStudioTools,
  appMedia,
  catalogTools,
} from '../lib/studio-nav.js'
import { DURATION_PRESETS } from '../lib/entitlements.js'
import { PUBLIC_TOOL_PATHS } from '../lib/public-tools.js'

const dash = readFileSync(fileURLToPath(new URL('../dashboard/index.html', import.meta.url)), 'utf8')
const css = readFileSync(fileURLToPath(new URL('../dashboard/studio-shell.css', import.meta.url)), 'utf8')
const vercel = readFileSync(fileURLToPath(new URL('../vercel.json', import.meta.url)), 'utf8')
const nav = readFileSync(fileURLToPath(new URL('../lib/studio-nav.js', import.meta.url)), 'utf8')
const shell = readFileSync(fileURLToPath(new URL('../lib/app-studio-shell.js', import.meta.url)), 'utf8')

test('studio shell mounts sidebar, top bar, and new skeleton pages', () => {
  assert.match(dash, /studio-shell/)
  assert.match(dash, /id="studio-sidebar"/)
  assert.match(dash, /id="studio-topbar"/)
  assert.match(dash, /id="studio-home-root"/)
  assert.match(dash, /id="studio-tools-root"/)
  assert.match(dash, /id="panel-brandkit"/)
  assert.match(dash, /id="panel-templates"/)
  assert.match(dash, /id="panel-tutorials"/)
  assert.match(dash, /id="files-sort"/)
  assert.match(dash, /initStudioShell/)
  assert.match(dash, /studioOnPanelChange/)
  assert.doesNotMatch(dash, /id="app-topnav"/)
  assert.doesNotMatch(nav, /Coming soon/)
  assert.doesNotMatch(shell, /Coming soon/)
  assert.doesNotMatch(css, /Coming soon/)
})

test('studio copy has no em dashes', () => {
  assert.doesNotMatch(nav, /—/)
  assert.doesNotMatch(shell, /—/)
  assert.doesNotMatch(css, /—/)
})

test('catalog categories and tools match the shipped list', () => {
  assert.deepEqual(CATALOG_TABS.map((t) => t.id), ['popular', 'long-form', 'shorts', 'thumbnails', 'audio', 'editing'])
  assert.deepEqual(catalogTools('long-form').map((t) => t.id), ['videogen'])
  assert.deepEqual(catalogTools('thumbnails').map((t) => t.id), ['imagegen'])
  assert.deepEqual(catalogTools('popular').map((t) => t.id), ['videogen', 'imagegen', 'clipper', 'voiceover'])
  assert.ok(catalogTools('shorts').map((t) => t.id).includes('clipper'))
  assert.ok(catalogTools('audio').map((t) => t.id).includes('voiceover'))
  assert.ok(catalogTools('editing').map((t) => t.id).includes('editor'))
  assert.equal(STUDIO_TOOL_COPY.videogen.href, '/video-generation')
  assert.equal(STUDIO_TOOL_COPY.clipper.name, 'Clipping')
})

test('home prompt modes and lengths come from the generator', () => {
  assert.deepEqual(HOME_PROMPT_MODES.map((m) => m.label), ['Long-form', 'Shorts', 'Thumbnail'])
  assert.deepEqual(STUDIO_LENGTH.shorts.map((d) => d.id), DURATION_PRESETS.shorts.map((d) => d.id))
  assert.deepEqual(STUDIO_LENGTH.long.map((d) => d.id), DURATION_PRESETS.long.map((d) => d.id))
})

test('sidebar sections use real routes', () => {
  const hrefs = SIDEBAR_SECTIONS.flatMap((s) => s.items.map((i) => i.href))
  assert.ok(hrefs.includes('/dashboard'))
  assert.ok(hrefs.includes('/video-generation'))
  assert.ok(hrefs.includes('/brand-kit'))
  assert.ok(hrefs.includes('/templates'))
  assert.ok(hrefs.includes('/tutorials'))
  assert.ok(hrefs.includes('/files'))
  assert.equal(hrefs.includes('/faceless-studio'), false)
})

test('placeholder filenames are fixed under the app R2 prefix', () => {
  assert.equal(appMedia('tool-thumb-long-form-generator.jpg'), 'https://pub-f40c956471ff49feab622906892ec527.r2.dev/app/tool-thumb-long-form-generator.jpg')
  assert.equal(PLACEHOLDER_FILES.tools.length, allStudioTools().length)
  assert.equal(TEMPLATES.length, 12)
  assert.equal(TUTORIALS.length, 8)
  assert.equal(WHATS_NEW[0].title, 'Seedream 5.0 Pro')
  assert.match(WHATS_NEW[0].href, /image-generation/)
})

test('new skeleton routes rewrite to the dashboard SPA and stay public', () => {
  assert.match(vercel, /"source": "\/brand-kit"/)
  assert.match(vercel, /"source": "\/templates"/)
  assert.match(vercel, /"source": "\/tutorials"/)
  assert.ok(PUBLIC_TOOL_PATHS.includes('/brand-kit'))
  assert.ok(PUBLIC_TOOL_PATHS.includes('/templates'))
  assert.ok(!PUBLIC_TOOL_PATHS.includes('/dashboard'))
  assert.ok(!PUBLIC_TOOL_PATHS.includes('/files'))
})
