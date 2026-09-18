import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { MCP_AGENT_LOGOS, MCP_CHAT_MEDIA, MCP_FEATURE_MEDIA, mcpAgentLogo } from '../lib/landing-media.js'
import { TOOL_MENU_ITEMS } from '../lib/public-tools.js'
import { vidsoMcpTools } from '../lib/vidso-mcp.js'
import { mcpTools } from '../lib/youtube.js'

const html = readFileSync(new URL('../mcp/index.html', import.meta.url), 'utf8')
const landing = readFileSync(new URL('../home/index.html', import.meta.url), 'utf8')
const vercel = readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')
const css = readFileSync(new URL('../home/landing-redesign.css', import.meta.url), 'utf8')
const names = new Set([...mcpTools(), ...vidsoMcpTools()].map((t) => t.name))

test('mcp marketing page is public, indexable, and has every client tab', () => {
  assert.match(html, /<title>Vidso MCP/)
  assert.match(html, /<meta name="description"/)
  assert.match(html, /name="robots" content="index,follow"/)
  for (const id of ['claude', 'chatgpt', 'cursor', 'kimi', 'other']) {
    assert.ok(html.includes(`data-mcp-client="${id}"`), id)
    assert.ok(html.includes(`data-mcp-client-pane="${id}"`), id + ' pane')
  }
  assert.ok(html.includes('Other MCP agents'))
  assert.ok(html.includes('CLI'))
  assert.ok(html.includes('Soon'))
  assert.ok(!html.includes('curl'))
  assert.ok(!html.includes('install.sh'))
  assert.ok(!html.includes('OpenArt'))
  assert.ok(!html.includes('—'))
  assert.ok(html.includes('https://www.vidso.pro/mcp'))
  assert.ok(html.includes('https://claude.ai/settings/connectors'))
  assert.ok(html.includes('aria-selected'))
  assert.ok(html.includes('Steps vary slightly by app version'))
})

test('mcp page only claims real tools', () => {
  for (const name of [
    'longform_make_video',
    'longform_render_start',
    'thumbnail_generate',
    'clip_analyze',
    'clip_start',
    'ranking_start',
    'reframe_start',
    'commentary_start',
    'voiceover_generate',
    'captions_transcribe',
    'files_list',
    'vidso_catalog',
    'vidso_account',
    'youtube_upload',
  ]) {
    assert.ok(names.has(name), name)
    assert.ok(html.includes(name), name)
  }
  assert.ok(!html.includes('studio_generate'))
  assert.ok(html.includes('Video Editor and Faceless Studio are not exposed'))
})

test('placeholder mappings stay honest', () => {
  assert.deepEqual(MCP_AGENT_LOGOS.map((r) => r.file), [
    'agent-logo-claude.png',
    'agent-logo-chatgpt.png',
    'agent-logo-cursor.png',
    'agent-logo-kimi.png',
    'agent-logo-other.png',
  ])
  assert.ok(mcpAgentLogo('agent-logo-claude.png').endsWith('/landing/agent-logo-claude.png'))
  assert.deepEqual(MCP_FEATURE_MEDIA.map((r) => r.tab), ['longform', 'clips', 'thumbs', 'audio', 'files', 'connect'])
  assert.deepEqual(MCP_CHAT_MEDIA.map((r) => r.item), ['longform', 'thumbs', 'clips', 'voice', 'files', 'account'])
  for (const file of MCP_AGENT_LOGOS.map((r) => r.file)) {
    assert.ok(html.includes(file), file)
  }
  assert.ok(html.includes('data-mcp-feat="longform"'))
})

test('mcp page spacing tokens match the denser layout', () => {
  assert.ok(css.includes('clamp(56px,7vw,108px)'))
  assert.ok(css.includes('.lp-red.is-mcp-page{--sec-y:96px}'))
  assert.ok(css.includes('width:min(580px,100%)'))
})

test('landing excerpt and nav point at /mcp without duplicating the old block', () => {
  assert.equal(TOOL_MENU_ITEMS.mcp.href, '/mcp')
  assert.ok(landing.includes('id="connect-claude"'))
  assert.ok(landing.includes('class="mcp-excerpt"'))
  assert.ok(landing.includes('href="/mcp"'))
  assert.ok(!landing.includes('mcp-keys'))
  assert.ok(!landing.includes('id="hero-pin"'))
  assert.ok(vercel.includes('"/mcp/index.html"'))
  assert.ok(vercel.includes('"/api/youtube/mcp"'))
})
