import test from 'node:test'
import assert from 'node:assert/strict'
import {
  parseTitleResponse,
  rankTitles,
  runTitleAgent,
  titleBrief,
  titleIssues,
  TITLE_PATTERNS,
} from '../lib/title-agent.js'
import { SCRIPT_FORMATS, DEFAULT_SCRIPT_FORMAT } from '../lib/script-formats.js'
import { vidsoMcpTools } from '../lib/vidso-mcp.js'

test('every script format has title shapes', () => {
  for (const f of [...SCRIPT_FORMATS, DEFAULT_SCRIPT_FORMAT]) assert.ok(TITLE_PATTERNS[f.id]?.length, f.id)
})

test('guard rails pass real breakout titles and flag bad ones', () => {
  for (const t of [
    'What Did Ancient Humans Do For Pleasure?',
    'The Psychology of Gen X (Raised Without Applause)',
    'Why Almost NOBODY Lives On Australia\'s West Coast',
    'The ENTIRE History of the Vietnam War in 17 Minutes',
    'WTF Happened to Labubu?',
  ]) assert.deepEqual(titleIssues(t), [], t)
  assert.ok(titleIssues('This INSANE Fact Will SHOCK You!').length >= 2)
  assert.ok(titleIssues('I Tried Living Like a Roman for a Week').includes('first person'))
  assert.ok(titleIssues('Rome').includes('too short'))
})

test('parses fenced JSON, drops duplicates and empty titles', () => {
  const raw = 'Here you go:\n```json\n{"titles":[{"title":"Where Did Mansa Musa Get So Much Gold?","angle":"wealth"},{"title":"where did mansa musa get so much gold?"},{"title":""},"How Every Tudor Died"]}\n```'
  const out = parseTitleResponse(raw)
  assert.deepEqual(out.map((x) => x.title), ['Where Did Mansa Musa Get So Much Gold?', 'How Every Tudor Died'])
  assert.deepEqual(parseTitleResponse('no json here'), [])
})

test('ranking keeps the model order and drops rule breakers', () => {
  const list = [{ title: 'This Is INSANE!' }, { title: 'The German Major Who Saw D-Day First' }, { title: 'How Every Tudor Died' }]
  assert.deepEqual(rankTitles(list).map((x) => x.title), ['The German Major Who Saw D-Day First', 'How Every Tudor Died'])
  assert.equal(rankTitles([{ title: 'WOW!' }]).length, 1)
})

test('brief uses the format shapes and limits facts to the script', () => {
  const brief = titleBrief({ topic: 'The rise and fall of Blockbuster', script: 'In 2004 Blockbuster had 9,000 stores.' })
  assert.match(brief, /Format: Rise and fall/)
  assert.match(brief, /WTF Happened to Labubu/)
  assert.match(brief, /only source of facts/)
  assert.match(brief, /9,000 stores/)
})

test('falls back to the second model when the first fails', async () => {
  const calls = []
  const fetchImpl = async (url, opts) => {
    const model = JSON.parse(opts.body).model
    calls.push(model)
    if (calls.length === 1) return { ok: false, json: async () => ({ error: 'down' }) }
    return { ok: true, json: async () => ({ output: '{"titles":[{"title":"The Commander Who Watched His Fleet Die in 6 Minutes"}]}' }) }
  }
  const out = await runTitleAgent({ topic: 'Battle of Midway', falKey: 'k', fetchImpl })
  assert.equal(calls.length, 2)
  assert.equal(out.titles[0].title, 'The Commander Who Watched His Fleet Die in 6 Minutes')
  assert.equal(out.model, calls[1])
  await assert.rejects(runTitleAgent({ topic: 'x' }), /not configured/)
})

test('MCP exposes the title agent', () => {
  const tool = vidsoMcpTools().find((t) => t.name === 'title_generate')
  assert.ok(tool)
  assert.deepEqual(tool.inputSchema.required, ['topic'])
})
