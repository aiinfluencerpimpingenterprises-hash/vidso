import { test } from 'node:test'
import assert from 'node:assert/strict'
import { INTEGRATION_PROOF, mcpLandingUrl } from '../lib/landing-integrations.js'

test('landing MCP URL is the public Vidso connector', () => {
  assert.equal(mcpLandingUrl(), 'https://www.vidso.pro/mcp')
})

test('landing proof only ships Claude', () => {
  assert.ok(INTEGRATION_PROOF.claude.thumb.includes('claudemcpthumbnail.png'))
  assert.equal(INTEGRATION_PROOF.youtube, undefined)
})
