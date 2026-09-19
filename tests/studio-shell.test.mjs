import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  ASK_BEHAVIORS,
  ATTACH_MENU,
  CATALOG_TABS,
  HOME_CHIPS,
  HOME_PRESETS,
  HOME_PROMPT_IDEAS,
  HOME_PROMPT_MODES,
  INSPIRE_CATEGORIES,
  PLACEHOLDER_FILES,
  SIDEBAR_OMITTED,
  SIDEBAR_SECTIONS,
  START_FORMATS,
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
  assert.deepEqual(catalogTools('popular').map((t) => t.id), ['videogen', 'imagegen', 'clipper', 'voiceover', 'mcp'])
  assert.ok(catalogTools('shorts').map((t) => t.id).includes('clipper'))
  assert.ok(catalogTools('audio').map((t) => t.id).includes('voiceover'))
  assert.ok(catalogTools('editing').map((t) => t.id).includes('editor'))
  assert.equal(STUDIO_TOOL_COPY.videogen.href, '/video-generation')
  assert.equal(STUDIO_TOOL_COPY.clipper.name, 'Clipping')
  assert.equal(STUDIO_TOOL_COPY.mcp.href, '/mcp')
  assert.equal(STUDIO_TOOL_COPY.mcp.badge, 'NEW')
})

test('home prompt modes and lengths come from the generator', () => {
  assert.deepEqual(HOME_PROMPT_MODES.map((m) => m.label), ['Long-form', 'Shorts', 'Thumbnail', 'Voiceover'])
  assert.deepEqual(STUDIO_LENGTH.shorts.map((d) => d.id), DURATION_PRESETS.shorts.map((d) => d.id))
  assert.deepEqual(STUDIO_LENGTH.long.map((d) => d.id), DURATION_PRESETS.long.map((d) => d.id))
  assert.ok(HOME_PROMPT_IDEAS[0].toLowerCase().includes('airport'))
  assert.deepEqual(HOME_CHIPS.map((c) => c.label), [
    'Make a long-form video',
    'Design a thumbnail',
    'Clip my last upload',
    'Write a voiceover',
  ])
  assert.deepEqual(ASK_BEHAVIORS.map((b) => b.label), ['Ask first', 'Just make it'])
  assert.deepEqual(ATTACH_MENU.map((a) => a.id), ['upload', 'url'])
})

test('sidebar uses Create because Chat Mode and Director Mode do not exist', () => {
  const labels = SIDEBAR_SECTIONS.map((s) => s.label)
  assert.deepEqual(labels, ['', 'Create', 'Tools', 'Assets', 'Inspire', 'Pinned'])
  assert.ok(SIDEBAR_OMITTED.some((o) => o.label === 'Chat Mode'))
  assert.ok(SIDEBAR_OMITTED.some((o) => o.label === 'Director Mode'))
  const hrefs = SIDEBAR_SECTIONS.flatMap((s) => s.items.map((i) => i.href))
  assert.ok(hrefs.includes('/dashboard'))
  assert.ok(hrefs.includes('/video-generation'))
  assert.ok(hrefs.includes('/brand-kit'))
  assert.ok(hrefs.includes('/templates'))
  assert.ok(hrefs.includes('/tutorials'))
  assert.ok(hrefs.includes('/files'))
  assert.ok(hrefs.includes('/mcp'))
  assert.equal(hrefs.includes('/faceless-studio'), false)
  const tools = SIDEBAR_SECTIONS.find((s) => s.id === 'tools')
  assert.ok(tools.chips)
  assert.ok(tools.items.some((i) => i.id === 'mcp' && i.badge === 'NEW'))
})

test('home rails and inspiration tabs are config-driven', () => {
  assert.deepEqual(START_FORMATS.map((f) => f.label), [
    'Long-form', 'Short', 'Thumbnail', 'Clip', 'Ranking video', 'UGC', 'Explainer', 'Listicle',
  ])
  assert.equal(WHATS_NEW[0].title, 'Seedream 5.0 Pro')
  assert.match(WHATS_NEW[0].href, /image-generation/)
  assert.equal(WHATS_NEW[0].image, 'home-whatsnew-01.jpg')
  assert.equal(HOME_PRESETS.length, 12)
  assert.deepEqual(INSPIRE_CATEGORIES.map((c) => c.id), [
    'marketing', 'film', 'music', 'animation', 'ugc', 'micro', 'anime', 'explainer',
  ])
  assert.match(shell, /Start creating/)
  assert.match(shell, /Your recent renders/)
  assert.match(shell, /What's new/)
  assert.match(shell, /Presets/)
  assert.match(shell, /Inspirations/)
  assert.match(shell, /Get started with tools/)
  assert.match(shell, /studio-home-rails/)
  assert.match(shell, /paintHomeMode/)
})

test('placeholder filenames follow the app R2 scheme', () => {
  assert.equal(appMedia('tool-thumb-long-form-generator.jpg'), 'https://pub-f40c956471ff49feab622906892ec527.r2.dev/app/tool-thumb-long-form-generator.jpg')
  assert.equal(PLACEHOLDER_FILES.tools.length, allStudioTools().length)
  assert.deepEqual(PLACEHOLDER_FILES.start, START_FORMATS.map((f) => `home-start-${f.slug}.mp4`))
  assert.equal(PLACEHOLDER_FILES.whatsNew.length, 4)
  assert.equal(PLACEHOLDER_FILES.presets.length, 12)
  assert.equal(PLACEHOLDER_FILES.inspire.length, INSPIRE_CATEGORIES.length * 6)
  assert.equal(TEMPLATES.length, 12)
  assert.equal(TUTORIALS.length, 8)
})

test('home is public preview and files stay private', () => {
  assert.match(vercel, /"source": "\/brand-kit"/)
  assert.match(vercel, /"source": "\/templates"/)
  assert.match(vercel, /"source": "\/tutorials"/)
  assert.match(vercel, /"source": "\/overview"[\s\S]*?"destination": "\/dashboard"/)
  assert.ok(PUBLIC_TOOL_PATHS.includes('/brand-kit'))
  assert.ok(PUBLIC_TOOL_PATHS.includes('/templates'))
  assert.ok(PUBLIC_TOOL_PATHS.includes('/dashboard'))
  assert.ok(!PUBLIC_TOOL_PATHS.includes('/files'))
  assert.match(css, /--studio-sidebar:224px/)
  assert.match(css, /--studio-sidebar-sm:64px/)
  assert.match(css, /#FE0C30/)
  assert.match(css, /prefers-reduced-motion/)
  assert.match(css, /studio-prompt:focus-within/)
  assert.match(shell, /getElementById\('studio-prompt'\)/)
  assert.match(shell, /q\.get\('topic'\) \|\| q\.get\('idea'\)/)
})
