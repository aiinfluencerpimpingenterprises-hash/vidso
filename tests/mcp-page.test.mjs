import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { MCP_AGENT_LOGOS, MCP_CHAT_MEDIA, MCP_FEATURE_MEDIA } from '../lib/landing-media.js'
import { TOOL_MENU_ITEMS } from '../lib/public-tools.js'
import { vidsoMcpTools } from '../lib/vidso-mcp.js'
import { mcpTools } from '../lib/youtube.js'

const html = readFileSync(new URL('../mcp/index.html', import.meta.url), 'utf8')
const landing = readFileSync(new URL('../home/index.html', import.meta.url), 'utf8')
const vercel = readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')
const names = new Set([...mcpTools(), ...vidsoMcpTools()].map((t) => t.name))

test('mcp marketing page is public, indexable, and Claude-only', () => {
  assert.match(html, /<title>Vidso MCP/)
  assert.match(html, /<meta name="description"/)
  assert.match(html, /name="robots" content="index,follow"/)
  assert.ok(html.includes('Works with Claude'))
  assert.ok(!html.includes('ChatGPT'))
  assert.ok(!html.includes('Kimi'))
  assert.ok(!html.includes('Cursor'))
  assert.ok(!html.includes('CLI'))
  assert.ok(!html.includes('coming soon'))
  assert.ok(!html.includes('OpenArt'))
  assert.ok(!html.includes('—'))
  assert.ok(html.includes('https://www.vidso.pro/mcp'))
  assert.ok(html.includes('https://claude.ai/settings/connectors'))
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
  assert.equal(MCP_AGENT_LOGOS[0].client, 'Claude')
  assert.ok(MCP_AGENT_LOGOS.slice(1).every((row) => row.client == null))
  assert.deepEqual(MCP_FEATURE_MEDIA.map((r) => r.tab), ['longform', 'clips', 'thumbs', 'audio', 'files', 'connect'])
  assert.deepEqual(MCP_CHAT_MEDIA.map((r) => r.item), ['longform', 'thumbs', 'clips', 'voice', 'files', 'account'])
  assert.ok(html.includes('agent-logo-01.png'))
  assert.ok(html.includes('mcp-feature-01') || html.includes('data-mcp-feat="longform"'))
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
