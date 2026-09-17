import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  EXCLUDED_TOOLS,
  GENERATE_HREF,
  PUBLIC_TOOL_PATHS,
  PRIVATE_TOOL_PATHS,
  TOOL_MENU_COLUMNS,
  TOOL_MENU_ITEMS,
  isPrivateToolPath,
  isPublicToolPath,
  seoForPath,
} from '../lib/public-tools.js'
import { ruleFor } from '../lib/gate-run.js'

const html = readFileSync(new URL('../home/index.html', import.meta.url), 'utf8')
const landingJs = readFileSync(new URL('../lib/landing-page.js', import.meta.url), 'utf8')
const menuJs = readFileSync(new URL('../lib/landing-tools-menu.js', import.meta.url), 'utf8')
const dash = readFileSync(new URL('../dashboard/index.html', import.meta.url), 'utf8')

test('public tools stay public and dashboard/files stay private', () => {
  assert.equal(isPublicToolPath('/video-generation'), true)
  assert.equal(isPublicToolPath('/image-generation'), true)
  assert.equal(isPrivateToolPath('/dashboard'), true)
  assert.equal(isPrivateToolPath('/files'), true)
  assert.ok(PRIVATE_TOOL_PATHS.every((p) => !PUBLIC_TOOL_PATHS.includes(p)))
})

test('mega menu uses real shipped routes and existing copy', () => {
  assert.equal(TOOL_MENU_ITEMS.videogen.href, GENERATE_HREF)
  assert.equal(TOOL_MENU_COLUMNS.length, 5)
  assert.ok(TOOL_MENU_COLUMNS.some((c) => c.id === 'popular' && c.popular))
  assert.match(TOOL_MENU_ITEMS.videogen.description, /script, voice, B-roll/)
  assert.match(TOOL_MENU_ITEMS.mcp.description, /Claude/)
  assert.ok(EXCLUDED_TOOLS.some((t) => t.name === 'Dashboard'))
  assert.ok(EXCLUDED_TOOLS.some((t) => t.name === 'Faceless Studio'))
})

test('landing points generate CTAs at the long-form tool', () => {
  assert.match(landingJs, /mountLandingToolsMenu/)
  assert.match(menuJs, /nav-tools-btn/)
  assert.match(html, /href="\/video-generation"/)
  assert.match(html, /Long Form Generator/)
  assert.match(html, /Thumbnail Generator/)
  assert.match(html, /Clipping/)
  assert.match(html, /hero-prompt[\s\S]{0,80}action="\/video-generation"/)
})

test('dashboard boot allows guest preview on public tools', () => {
  assert.match(dash, /is-guest-preview/)
  assert.match(dash, /Create an account to generate/)
  assert.match(dash, /See plans/)
  assert.match(dash, /requireToolAction/)
})

test('public tool pages are indexable and private pages are not', () => {
  assert.equal(seoForPath('/video-generation').index, true)
  assert.equal(seoForPath('/dashboard').index, false)
  assert.equal(seoForPath('/files').index, false)
})

test('gate rejects generation starts without a plan rule', () => {
  assert.equal(ruleFor('POST', 'faceless/script').type, 'length')
  assert.equal(ruleFor('POST', 'tts/generate').type, 'plan')
})
