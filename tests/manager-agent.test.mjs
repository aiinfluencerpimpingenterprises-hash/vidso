import test from 'node:test'
import assert from 'node:assert/strict'
import { managerPrompt, parseManagerResponse, runManagerAgent, MANAGER_ACTIONS } from '../lib/manager-agent.js'

const ids = ['bold', 'clean']

test('drops unknown actions, bad styles and empty topics', () => {
  const out = parseManagerResponse('```json\n{"reply":"On it.","actions":[{"type":"delete_account"},{"type":"captions","style":"neon"},{"type":"new_video","topic":"x"},{"type":"titles","direction":"punchier"}]}\n```', { captionIds: ids })
  assert.equal(out.reply, 'On it.')
  assert.deepEqual(out.actions, [{ type: 'captions', style: 'choose' }, { type: 'titles', direction: 'punchier' }])
})

test('a new video never rides along with edits, and at most 3 actions run', () => {
  const nv = parseManagerResponse('{"reply":"ok","actions":[{"type":"titles"},{"type":"new_video","topic":"The fall of Rome"}]}')
  assert.deepEqual(nv.actions, [{ type: 'new_video', topic: 'The fall of Rome' }])
  const many = parseManagerResponse('{"reply":"ok","actions":[{"type":"titles"},{"type":"thumbnail"},{"type":"rerender"},{"type":"upload"}]}')
  assert.equal(many.actions.length, 3)
})

test('garbage and empty plans are rejected so the keyword router takes over', () => {
  assert.equal(parseManagerResponse('sorry, I cannot help'), null)
  assert.equal(parseManagerResponse('{"reply":"","actions":[]}'), null)
})

test('prompt carries the situation, the actions and the caption ids', () => {
  const p = managerPrompt({ message: 'why so short?', context: { hasVideo: true, topic: 'Blockbuster', targetLength: '10 min', actualLength: '2.1 min' }, captionStyles: [{ id: 'bold', name: 'Bold yellow' }] })
  for (const k of Object.keys(MANAGER_ACTIONS)) assert.match(p, new RegExp('- ' + k + ':'))
  assert.match(p, /Narration came out at 2\.1 min/)
  assert.match(p, /bold \(Bold yellow\)/)
})

test('falls back to the second model', async () => {
  const seen = []
  const fetchImpl = async (_u, o) => {
    seen.push(JSON.parse(o.body).model)
    if (seen.length === 1) return { ok: false, json: async () => ({ error: 'down' }) }
    return { ok: true, json: async () => ({ output: '{"reply":"Thanks!","actions":[]}' }) }
  }
  const out = await runManagerAgent({ message: 'thanks', falKey: 'k', fetchImpl })
  assert.equal(out.reply, 'Thanks!')
  assert.equal(seen.length, 2)
})
