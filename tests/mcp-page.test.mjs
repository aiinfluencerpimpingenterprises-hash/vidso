import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { MCP_AGENT_LOGOS, MCP_CHAT_MEDIA, MCP_CONNECT_LABELS, MCP_CONNECT_TOOLS, MCP_FEATURE_MEDIA, VIDSO_AGENT_SETUP_PROMPT, VIDSO_CLI, mcpAgentLogo } from '../lib/landing-media.js'
import { TOOL_MENU_ITEMS } from '../lib/public-tools.js'
import { vidsoMcpTools } from '../lib/vidso-mcp.js'
import { mcpTools } from '../lib/youtube.js'

const html = readFileSync(new URL('../mcp/index.html', import.meta.url), 'utf8')
const landing = readFileSync(new URL('../home/index.html', import.meta.url), 'utf8')
const vercel = readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')
const css = readFileSync(new URL('../home/landing-redesign.css', import.meta.url), 'utf8')
const mocks = readFileSync(new URL('../lib/mcp-mocks.js', import.meta.url), 'utf8')
const page = readFileSync(new URL('../lib/mcp-page.js', import.meta.url), 'utf8')
const names = new Set([...mcpTools(), ...vidsoMcpTools()].map((t) => t.name))

test('mcp marketing page is public, indexable, and has every client tab plus CLI', () => {
  assert.match(html, /<title>Vidso MCP/)
  assert.match(html, /<meta name="description"/)
  assert.match(html, /name="robots" content="index,follow"/)
  for (const id of ['claude', 'chatgpt', 'cursor', 'kimi', 'grok', 'claude-code', 'openclaw', 'hermes', 'other']) {
    assert.ok(html.includes(`data-mcp-client="${id}"`), id)
    assert.ok(html.includes(`data-mcp-client-pane="${id}"`), id + ' pane')
  }
  assert.ok(html.includes('Other MCP agents'))
  assert.ok(html.includes('data-mcp-mode="cli"'))
  assert.ok(html.includes(VIDSO_CLI.unix))
  assert.ok(html.includes(VIDSO_CLI.windows))
  assert.ok(html.includes(VIDSO_CLI.login))
  assert.ok(!html.includes('Soon'))
  assert.ok(!html.includes('Coming soon'))
  assert.ok(!html.includes('OpenArt'))
  assert.ok(!html.includes('—'))
  assert.ok(html.includes('https://www.vidso.pro/mcp'))
  assert.ok(html.includes('https://claude.ai/settings/connectors'))
  assert.ok(html.includes('aria-selected'))
  assert.ok(html.includes('If you are using Claude Code or Codex, it\'s better to'))
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
  }
  for (const name of MCP_CONNECT_TOOLS) {
    assert.ok(names.has(name), name)
    assert.equal(typeof MCP_CONNECT_LABELS[name], 'string', name)
  }
  const bring = html.slice(html.indexOf('id="capabilities"'), html.indexOf('id="just-ask"'))
  assert.ok(!bring.includes('longform_make_video'))
  assert.ok(!bring.includes('clip_analyze'))
  assert.ok(!bring.includes('vidso_catalog'))
  assert.ok(!html.includes('studio_generate'))
  assert.ok(html.includes('Video Editor and Faceless Studio are not exposed'))
})

test('placeholder mappings stay honest', () => {
  assert.deepEqual(MCP_AGENT_LOGOS.map((r) => r.file), [
    'agent-logo-claude.png',
    'agent-logo-chatgpt.png',
    'agent-logo-cursor.png',
    'agent-logo-kimi.png',
    'agent-logo-grok-bot.png',
    'agent-logo-claude-code.png',
    'agent-logo-openclaw.png',
    'agent-logo-hermes.png',
    'agent-logo-other.png',
  ])
  assert.ok(mcpAgentLogo('agent-logo-claude.png').endsWith('/landing/agent-logo-claude.png'))
  assert.ok(html.includes('claude-ai-icon.webp'))
  assert.ok((html.match(/class="mcp-key /g) || []).length >= 9)
  assert.ok(html.includes('openai-icon.svg'))
  assert.ok(html.includes('is-chatgpt'))
  assert.ok(css.includes('.mcp-client.is-chatgpt svg'))
  assert.ok(css.includes('flex-wrap:wrap'))
  assert.ok(!html.includes('class="mcp-client-tab is-mark" role="tab" id="tab-kimi"'))
  assert.ok(html.includes('cursor-ai-code-icon.svg'))
  assert.ok(html.includes('kimi-ai-icon.svg'))
  assert.ok(html.includes('grokbotlogo.jpg'))
  assert.ok(html.includes('claude-code-icon.png'))
  assert.ok(html.includes('OpenClaw%20Logo%20-%20Colored%20-%20zonalogo.com.png'))
  assert.ok(html.includes('Hermes%20Agent%20Logo%20-%20Black%20-%20zonalogo.com.svg'))
  assert.ok(html.includes('vidso-logo.png'))
  assert.ok(html.includes('Chatgptmcp1'))
  assert.ok(html.includes('Chatgptmcp2'))
  assert.ok(html.includes('Chatgptmcp3'))
  assert.ok(html.includes('kimimcp1'))
  assert.ok(html.includes('kimimcp2'))
  assert.ok(html.includes('kimimcp3'))
  assert.ok(css.includes('.mcp-prompt pre') && css.includes('color:#FE0C30'))
  assert.ok(css.includes('.mcp-clients-wash{display:none}'))
  assert.ok(css.includes('width:fit-content'))
  assert.ok(css.includes('.mcp-steps.is-shots'))
  assert.ok(css.includes('.mcp-key-skirt{display:none}'))
  assert.ok(css.includes('.mcp-u{'))
  assert.ok(html.includes('class="mcp-u"'))
  assert.ok(html.includes('mcp-feat-cta'))
  assert.ok(html.includes('mcp-ask-prompt'))
  assert.ok(css.includes('.mcp-ask-media .mcp-blank'))
  assert.ok(css.includes('border:2px solid #FE0C30'))
  assert.ok(css.includes('.mcp-blank.is-blank::after'))
  assert.ok(css.includes('.mcp-blank.is-hover-audio'))
  assert.ok(html.includes('data-mcp-agent-prompt'))
  assert.ok((html.match(/<span class="n">1<\/span>/g) || []).length >= 9)
  assert.ok(html.includes('class="mcp-steps"'))
  assert.ok(html.includes('data-mcp-mock="longform"'))
  assert.ok(html.includes('mcplongformchatplaceholder'))
  assert.ok(html.includes('data-mcp-loop-seconds="15"'))
  assert.ok(html.includes('data-mcp-hover-audio'))
  assert.ok(html.includes('mcp-shorts-01'))
  assert.ok(html.includes('mcpthumbnailplaceholder1'))
  assert.ok(html.includes('mcpthumbnailplaceholder4'))
  assert.ok(!html.includes('thumb-a.jpg'))
  assert.ok(html.includes('Airport Secrets.mp4'))
  assert.ok(html.includes('Airport Secrets.jpg'))
  assert.ok(html.includes('Hidden Fees.mp4'))
  assert.ok(html.includes('Boarding Groups.mp3'))
  assert.ok(html.includes('Free Upgrade.jpg'))
  assert.ok(html.includes('Airport Secrets 9-16.mp4'))
  assert.ok(html.includes('01-airport-secrets-video-preview'))
  assert.ok(html.includes('06-reframe-9x16-video-preview'))
  assert.equal(MCP_FEATURE_MEDIA[0].file, 'mcplongformchatplaceholder')
  assert.equal(MCP_FEATURE_MEDIA[4].file, 'mcpthumbnailplaceholder1')
  assert.deepEqual(MCP_FEATURE_MEDIA.filter((r) => r.tab === 'files').map((r) => r.file), [
    '01-airport-secrets-video-preview',
    '02-airport-secrets-thumbnail-a',
    '03-airport-short-clip-preview',
    '04-voice-board-audio-cover',
    '05-free-upgrade-thumbnail-b',
    '06-reframe-9x16-video-preview',
  ])
  assert.deepEqual(MCP_FEATURE_MEDIA[0].tab, 'longform')
  assert.ok(mocks.includes('data-mcp-hover-audio'))
  assert.ok(mocks.includes('data-mcp-loop-seconds'))
  assert.ok(mocks.includes('bindHoverAudio'))
  assert.ok(mocks.includes('unbindHoverAudio'))
  assert.ok(mocks.includes('stopSlotVideo'))
  assert.ok(mocks.includes("video.addEventListener('pointerenter'"))
  assert.ok(page.includes('muteAskPreview'))
  assert.ok(page.includes("file === 'mcplongformchatplaceholder'"))
  assert.ok(css.includes('.mcp-ask-list{display:flex;flex-direction:column;gap:6px;position:relative;z-index:2}'))
  assert.deepEqual(MCP_CHAT_MEDIA.map((r) => r.item), ['longform', 'thumbs', 'clips', 'voice', 'files', 'account'])
  assert.deepEqual(MCP_CHAT_MEDIA.map((r) => r.file), [
    'mcplongformchatplaceholder',
    '01-thumbnail-generation-airport-secrets',
    'mcp-chat-clips-01',
    '02-narrator-voiceover-output',
    '03-recent-files-render-status',
    '04-plan-quota-plus-yearly',
  ])
  assert.ok(html.includes('01-thumbnail-generation-airport-secrets'))
  assert.ok(html.includes('04-plan-quota-plus-yearly'))
})

test('cli command constant matches the tab copy', () => {
  assert.equal(VIDSO_CLI.unix, 'curl -fsSL https://www.vidso.pro/install.sh | sh')
  assert.equal(VIDSO_CLI.windows, 'irm https://www.vidso.pro/install.ps1 | iex')
  assert.equal(VIDSO_CLI.login, 'vidso login')
  assert.match(VIDSO_CLI.generate, /vidso video/)
  assert.match(VIDSO_AGENT_SETUP_PROMPT, /vidso login/)
  assert.ok(!VIDSO_AGENT_SETUP_PROMPT.includes('higgsfield'))
})

test('mcp page spacing tokens match the denser layout', () => {
  assert.ok(css.includes('clamp(56px,7vw,108px)'))
  assert.ok(css.includes('.lp-red.is-mcp-page{--sec-y:96px}'))
  assert.ok(css.includes('width:min(960px,100%)'))
  assert.ok(css.includes('perspective:1200px'))
})

test('landing excerpt and nav point at /mcp without duplicating the old block', () => {
  assert.equal(TOOL_MENU_ITEMS.mcp.href, '/mcp')
  assert.ok(landing.includes('id="connect-claude"'))
  assert.ok(landing.includes('href="/mcp"'))
  assert.ok(!landing.includes('mcp-keys'))
  assert.ok(!landing.includes('id="hero-pin"'))
  assert.ok(vercel.includes('"/mcp/index.html"'))
  assert.ok(vercel.includes('"/api/youtube/mcp"'))
})
