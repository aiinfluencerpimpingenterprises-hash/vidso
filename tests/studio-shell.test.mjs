import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  ASK_BEHAVIORS,
  ATTACH_MENU,
  CATALOG_TABS,
  HOME_CHIPS,
  HOME_CHIPS_MORE,
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
  inspireItems,
  startMedia,
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
  assert.deepEqual(ATTACH_MENU.map((a) => a.id), ['local-image', 'local-audio', 'local-video', 'files', 'brandkit'])
  assert.ok(HOME_CHIPS_MORE.length >= 8)
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
    'Long-form', 'Short film', 'Thumbnail', 'Clip', 'Ranking video', 'Social content', 'Explainer', 'Listicle',
  ])
  assert.ok(START_FORMATS.every((f) => !/16:9|9:16/.test(f.chip || '')))
  assert.equal(START_FORMATS.find((f) => f.id === 'thumbnail').badge, '')
  assert.match(WHATS_NEW[0].title, /Seedream 5.0 Pro/)
  assert.match(WHATS_NEW[0].href, /image-generation/)
  assert.equal(WHATS_NEW[0].image, 'home-whatsnew-01.jpg')
  assert.equal(HOME_PRESETS.length, 24)
  assert.match(shell, /Latest AI models/)
  assert.match(shell, /m\.id !== 'claude'/)
  assert.match(shell, /'gpt-image-2': 'gpt-image-2-5'/)
  assert.match(shell, /modelCardClipSrc/)
  assert.match(shell, /catalogHasClip\(mediaId\)/)
  assert.match(shell, /quickstart/)
  assert.match(dash, /id="panel-quickstart"/)
  assert.match(dash, /id="panel-homepresets"/)
  assert.match(dash, /id="panel-inspirecat"/)
  assert.deepEqual(INSPIRE_CATEGORIES.map((c) => c.id), [
    'marketing', 'film', 'music', 'animation', 'ugc', 'explainer',
  ])
  assert.deepEqual(inspireItems('marketing').map((it) => it.file), [
    'marketing&advertising1.mp4',
    'marketing&advertising2.mp4',
    'enhanced.mp4',
    'cgt-20260807111954-75dbb.mp4',
    'cgt-20260807151156-nb9g9.mp4',
    'DTyNeUYoyWApxM8kcE2-l_sEctF05h.mp4',
    'QUGZkmX1peda29ttJc9V.mp4',
    'WKW9nnh62A7d4fF8vaMr.mp4',
    '0 (1).mp4',
    '0 (2).mp4',
    '0 (3).mp4',
    '0.mp4',
    '0217758004894090000000000000000000ffffc0a88f20abbd19.mp4',
    '0217759311483810000000000000000000ffffc0a88f207d8f97.mp4',
    '0217759729565820000000000000000000ffffc0a88f205ef6eb.mp4',
    '0217762723194640000000000000000000ffffc0a85601533128.mp4',
    '0217764234263770000000000000000000ffffc0a87c2bba90ea.mp4',
    '0217769016813690000000000000000000ffffc0a878ec749fec.mp4',
    '0217769037193710000000000000000000ffffc0a8b0d38ab6a2.mp4',
    '0217786308711890000000000000000000ffffc0a884a94805a9.mp4',
    '0217798786332840000000000000000000ffffc0a8871cc3f4d7.mp4',
    '0217803136432900000000000000000000ffffc0a8baf8f13b06.mp4',
    '0217810292584330000000000000000000ffffc0a87bec6e8848.mp4',
    '0217810303282970000000000000000000ffffc0a89a6520c641.mp4',
    '0217810642229740000000000000000000ffffc0a8871c36aaa5.mp4',
    '0217811218617590000000000000000000ffffc0a899c5ea48c3.mp4',
    '0217811221135330000000000000000000ffffc0a87bec8bff9f.mp4',
    '0217811224136330000000000000000000ffffc0a87bec371464.mp4',
    '0217811225298560000000000000000000ffffc0a8bb20ce46cb.mp4',
    '0217811230939430000000000000000000ffffc0a87c204b5097.mp4',
    '0217815481326720000000000000000000ffffc0a87852537a61.mp4',
    '4d29747fb33fbafcce8a4e88b1f72ecc-ea9ef434-5cf9-455e-ae59-54fdaf75869f.mp4',
  ])
  assert.ok(inspireItems('marketing').every((it) => it.src && it.src.endsWith(encodeURIComponent(it.file))))
  assert.equal(inspireItems('film').length, 47)
  assert.ok(inspireItems('film').every((it) => it.src && it.src.endsWith(encodeURIComponent(it.file))))
  assert.deepEqual(inspireItems('film').map((it) => it.file).slice(0, 4), [
    'enhanced (1).mp4',
    'enhanced.mp4',
    'nQm3rImMePl95E44v1ly.mp4',
    'gouYzB3HE1g1I0T8Nw7j.mp4',
  ])
  assert.deepEqual(inspireItems('music').map((it) => it.file), [
    'cgt-20260807135044-jl4cb.mp4',
    'cgt-20260808042429-r42dr.mp4',
    'cgt-20260808064211-8r9lh.mp4',
    'sample_0.mp4',
    'ssDblxbgz5C1wS4VRC6y.mp4',
    '0217765651118490000000000000000000ffffc0a885857ca316.mp4',
    '0217765666267790000000000000000000ffffc0a8792eb88c96.mp4',
    '0217786676548480000000000000000000ffffc0a87c69b5c956.mp4',
    '0217815485626240000000000000000000ffffc0a88fa1c0f922.mp4',
    '0217815502532680000000000000000000ffffc0a87ff35d31df.mp4',
    '0217815502730530000000000000000000ffffc0a8712a8e8ac3.mp4',
    '0217815527401250000000000000000000ffffc0a88c3c7c3b9a.mp4',
  ])
  assert.equal(inspireItems('animation').length, 50)
  assert.ok(inspireItems('animation').every((it) => it.src && it.src.endsWith(encodeURIComponent(it.file))))
  assert.deepEqual(inspireItems('animation').map((it) => it.file).slice(0, 5), [
    'cgt-20260808190147-fjj55.mp4',
    'enhanced (1).mp4',
    'enhanced.mp4',
    'PuPae-05Sv0ym3inyCwbW_5otT4my4.mp4',
    'xai-video-3da86be6-1f9f-4333-bd56-4abd9c820aed.mp4',
  ])
  assert.equal(inspireItems('ugc').length, 8)
  assert.equal(inspireItems('ugc')[0].file, 'landingpageugc.mp4')
  assert.ok(inspireItems('ugc').every((it) => it.src.endsWith(encodeURIComponent(it.file))))
  assert.equal(inspireItems('explainer').length, 10)
  assert.equal(inspireItems('explainer')[0].file, 'facelessstudio.mp4')
  assert.ok(inspireItems('explainer').every((it) => it.src.endsWith(encodeURIComponent(it.file))))
  assert.ok(inspireItems('music').every((it) => it.src.endsWith(encodeURIComponent(it.file))))
  assert.match(shell, /vid\.videoWidth/)
  assert.match(shell, /aspectRatio/)
  assert.ok(!shell.includes('is-slot'))
  assert.match(css, /\.studio-inspire-grid\{[^}]*align-items:start/)
  assert.ok(!shell.includes('id="rail-start"'))
  assert.ok(!shell.includes('Start creating'))
  assert.equal(startMedia('long-form'), 'https://pub-f40c956471ff49feab622906892ec527.r2.dev/landingpagelongform.mp4')
  assert.equal(startMedia('short'), 'https://pub-f40c956471ff49feab622906892ec527.r2.dev/landingpageshort.mp4')
  assert.equal(startMedia('thumbnail'), 'https://pub-f40c956471ff49feab622906892ec527.r2.dev/thumbnail.png')
  assert.equal(startMedia('clip'), 'https://pub-f40c956471ff49feab622906892ec527.r2.dev/landingpageformatsshort.mp4')
  assert.equal(startMedia('ugc'), 'https://pub-f40c956471ff49feab622906892ec527.r2.dev/landingpageugc.mp4')
  assert.equal(startMedia('explainer'), 'https://pub-f40c956471ff49feab622906892ec527.r2.dev/facelessstudio1.mp4')
  assert.equal(startMedia('ranking'), '')
  assert.equal(startMedia('listicle'), '')
  assert.match(shell, /Your recent renders/)
  assert.ok(!shell.includes('id="rail-news"'))
  assert.ok(!shell.includes("What's new"))
  assert.ok(!shell.includes('id="rail-presets"'))
  assert.match(shell, /Inspirations/)
  assert.ok(!shell.includes('id="rail-tools"'))
  assert.ok(!shell.includes('Get started with tools'))
  assert.match(shell, /studio-home-rails/)
  assert.match(shell, /paintHomeMode/)
})

test('placeholder filenames follow the app R2 scheme', () => {
  assert.equal(appMedia('tool-thumb-long-form-generator.jpg'), 'https://pub-f40c956471ff49feab622906892ec527.r2.dev/app/tool-thumb-long-form-generator.jpg')
  assert.equal(PLACEHOLDER_FILES.tools.length, allStudioTools().length)
  assert.deepEqual(PLACEHOLDER_FILES.start, START_FORMATS.map((f) => `home-start-${f.slug}.mp4`))
  assert.equal(PLACEHOLDER_FILES.whatsNew.length, 6)
  assert.equal(PLACEHOLDER_FILES.presets.length, 24)
  assert.equal(PLACEHOLDER_FILES.inspire.length, INSPIRE_CATEGORIES.length * 8)
  assert.equal(TEMPLATES.length, 12)
  assert.equal(TUTORIALS.length, 8)
})

test('home is public preview and files stay private', () => {
  assert.match(vercel, /"source": "\/brand-kit"/)
  assert.match(vercel, /"source": "\/templates"/)
  assert.match(vercel, /"source": "\/tutorials"/)
  assert.match(vercel, /"source": "\/home\/quick-start"/)
  assert.match(vercel, /"source": "\/home\/presets"/)
  assert.match(vercel, /"source": "\/overview"[\s\S]*?"destination": "\/dashboard"/)
  assert.ok(PUBLIC_TOOL_PATHS.includes('/brand-kit'))
  assert.ok(PUBLIC_TOOL_PATHS.includes('/templates'))
  assert.ok(PUBLIC_TOOL_PATHS.includes('/dashboard'))
  assert.ok(!PUBLIC_TOOL_PATHS.includes('/files'))
  assert.match(css, /--studio-sidebar:260px/)
  assert.match(css, /--studio-sidebar-ease/)
  assert.match(css, /grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)/)
  assert.match(css, /studio-collapsed \.studio-nav-ico/)
  assert.match(shell, /studio-brand-row/)
  assert.match(shell, /All tools/)
  assert.match(css, /--studio-sidebar-sm:64px/)
  assert.match(css, /#0a0a0b/)
  assert.match(css, /#17171a/)
  assert.match(css, /#FE0C30/)
  assert.match(css, /prefers-reduced-motion/)
  assert.match(css, /studio-prompt:focus-within/)
  assert.doesNotMatch(dash, /id="topo-bg"/)
  assert.doesNotMatch(dash, /topo-bg\.js/)
  assert.doesNotMatch(css, /#F3C4C8/)
  assert.match(shell, /studio-mcp-row/)
  assert.match(shell, /studio-tile-shot/)
  assert.match(shell, /getElementById\('studio-prompt'\)/)
  assert.match(shell, /q\.get\('topic'\) \|\| q\.get\('idea'\)/)
})

test('home top bar drops Search and names the workspace from account data', () => {
  assert.doesNotMatch(dash, /id="studio-search-btn"/)
  assert.doesNotMatch(dash, /id="studio-grid-btn"/)
  assert.doesNotMatch(dash, /⌘K/)
  assert.match(dash, /id="studio-help-btn"/)
  assert.match(dash, />Help</)
  assert.match(dash, /id="studio-collapse-top"/)
  assert.match(dash, /id="topbar-title" hidden/)
  assert.match(shell, /My workspace/)
  assert.match(shell, /'s workspace/)
  assert.match(shell, /id="studio-ws-label"/)
  assert.doesNotMatch(shell, /studio-workspace-btn[\s\S]{0,400}ICO\.chev/)
  assert.match(css, /top:calc\(100% \+ 8px\)/)
  assert.match(css, /#1c1c1f/)
  assert.match(css, /studio-collapsed \.studio-top-logo\{display:none\}/)
  assert.match(css, /is-home-mark/)
  assert.match(shell, /is-home-mark/)
  assert.match(shell, /data-vidso-socials/)
  assert.match(shell, /studio-account-head/)
  assert.doesNotMatch(shell, /discord|youtube\.com|twitter|x\.com/i)
  assert.match(readFileSync(fileURLToPath(new URL('../brand.js', import.meta.url)), 'utf8'), /VIDSO_INSTAGRAM_URL/)
})
