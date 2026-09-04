import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MCP_OPEN_TOOLS, resolveDurationSpec, vidsoMcpTools, runVidsoMcpTool } from '../lib/vidso-mcp.js'
import { ruleFor } from '../lib/gate-run.js'
import { mcpTools, runMcpTool } from '../lib/youtube.js'

test('duration chips map labels and ids, default 3 min', () => {
  assert.deepEqual(resolveDurationSpec({}), { id: 'long_180', seconds: 180, label: '3 min' })
  assert.equal(resolveDurationSpec({ duration: '5 min' }).id, 'long_300')
  assert.equal(resolveDurationSpec({ duration: '60s' }).id, 'shorts_60')
  assert.equal(resolveDurationSpec({ duration_id: 'long_600' }).seconds, 600)
  assert.equal(resolveDurationSpec({ minutes: 10 }).id, 'long_600')
  assert.equal(resolveDurationSpec({ duration_seconds: 45 }).id, 'shorts_45')
})

test('Claude can see account without a paid plan check, but not generate', () => {
  assert.equal(MCP_OPEN_TOOLS.has('vidso_account'), true)
  assert.equal(MCP_OPEN_TOOLS.has('vidso_catalog'), true)
  assert.equal(MCP_OPEN_TOOLS.has('longform_make_video'), false)
})

test('MCP tools include long-form start plus poll, and skip archived Faceless Studio', () => {
  const names = vidsoMcpTools().map((t) => t.name)
  assert.ok(names.includes('longform_make_video'))
  assert.ok(names.includes('longform_render_start'))
  assert.ok(names.includes('vidso_poll'))
  assert.ok(names.includes('thumbnail_generate'))
  assert.equal(names.includes('studio_generate'), false)
  const poll = vidsoMcpTools().find((t) => t.name === 'vidso_poll')
  assert.ok(poll.inputSchema.properties.kind.enum.includes('media'))
  assert.ok(poll.inputSchema.properties.kind.enum.includes('render'))
})

test('youtube_upload accepts a long-form render_job_id', () => {
  const upload = mcpTools().find((t) => t.name === 'youtube_upload')
  assert.ok(upload.inputSchema.properties.render_job_id)
  assert.ok(upload.inputSchema.required.includes('title'))
})

test('unknown Vidso MCP tool is -32601', async () => {
  await assert.rejects(
    () => runVidsoMcpTool('faceless_hack', {}, { token: 'tok', user: { id: 'u' } }),
    (err) => err.code === -32601,
  )
  await assert.rejects(
    () => runMcpTool('longform_nope', {}, { token: 'tok', user: { id: 'u' } }),
    (err) => err.code === -32601,
  )
})

test('gate still treats faceless render as a quota consume', () => {
  assert.equal(ruleFor('POST', 'faceless/render').type, 'generate')
  assert.equal(ruleFor('POST', 'faceless/script').type, 'length')
  assert.equal(ruleFor('GET', 'faceless/media/abc').type, 'forward')
})
