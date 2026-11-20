import test from 'node:test'
import assert from 'node:assert/strict'
import { buildChapters, chaptersText, scriptFromText, scriptEstimate, nearestDuration, angleBrief, normalizeProfile } from '../lib/channel-kit.js'
import { parsePublishResponse, publishPrompt } from '../lib/publish-agent.js'

const words = (n) => Array.from({ length: n }, (_, i) => 'word' + i).join(' ')

test('chapters follow YouTube rules: 0:00 first, 3+, 10s apart', () => {
  const sections = [{ heading: 'Hook', text: words(40) }, { heading: 'The peak', text: words(200) }, { heading: 'Tiny', text: words(3) }, { heading: 'The fall', text: words(200) }, { heading: 'Today', text: words(100) }]
  const ch = buildChapters(sections, 360)
  assert.equal(ch[0].time, '0:00')
  assert.ok(ch.length >= 3)
  assert.ok(!ch.some((c) => c.title === 'Tiny'), 'sections under 10 seconds are merged')
  assert.match(chaptersText(ch), /^0:00 Hook\n/)
  assert.deepEqual(buildChapters([{ heading: 'A', text: words(50) }, { heading: 'B', text: words(50) }], 60), [], 'fewer than 3 chapters: none')
})

test('a pasted script becomes sections; headings are kept', () => {
  const s = scriptFromText('## The deal\nIn 2000 Netflix offered itself for $50 million.\n\nBlockbuster laughed.\n\n## The fall\nBy 2010 it was bankrupt.', { title: '' })
  assert.equal(s.sections.length, 3)
  assert.equal(s.sections[0].heading, 'The deal')
  assert.equal(s.sections[2].heading, 'The fall')
  assert.equal(s.title, 'In 2000 Netflix offered itself for $50 million.')
  assert.equal(scriptFromText('   '), null)
  const many = scriptFromText(Array.from({ length: 40 }, (_, i) => 'Paragraph ' + i + '.').join('\n\n'), { maxSections: 16 })
  assert.ok(many.sections.length <= 16)
})

test('estimates, presets, angles and profiles', () => {
  assert.equal(scriptEstimate(words(1500)).label, '1,500 words · about 10 min')
  assert.equal(nearestDuration(470).id, 'long_600')
  assert.equal(angleBrief('auto'), '')
  assert.match(angleBrief('tutorial'), /numbered steps/)
  const p = normalizeProfile({ name: '', aspect: '4:3', angle: 'weird' })
  assert.equal(p.name, 'My channel'); assert.equal(p.aspect, '16:9'); assert.equal(p.angle, 'auto')
})

test('publish response is cleaned: no hashtags, unique short tags', () => {
  const out = parsePublishResponse('{"description":"Blockbuster had 9,000 stores. #history","tags":["#Blockbuster","blockbuster","netflix vs blockbuster","video rental history"]}')
  assert.equal(out.description, 'Blockbuster had 9,000 stores.')
  assert.deepEqual(out.tags, ['blockbuster', 'netflix vs blockbuster', 'video rental history'])
  assert.equal(parsePublishResponse('nope'), null)
  assert.match(publishPrompt({ title: 'T', script: 'S' }), /only source of facts/)
})
