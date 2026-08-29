import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  createProjectRecord,
  isStudioSidecarName,
  pickDefaultVoiceId,
  projectFileName,
  projectVisibleTo,
  publicProject,
  requireProjectCreateBody,
  userIdOf,
} from '../lib/faceless-studio-store.js'
import { isHistorySidecarName, LFG_STEP_SHOTS } from '../lib/image-gen.js'
import {
  STUDIO_FILTERS,
  STUDIO_SECTIONS,
  studioHeadingHtml,
  studioPresetById,
  studioPresetsAll,
  studioSectionsForFilter,
} from '../lib/faceless-studio-presets.js'

test('studio sidecars are named and hidden from My Files', () => {
  const name = projectFileName('abc-123')
  assert.equal(name, 'vidso-fs-proj-abc-123.txt')
  assert.equal(isStudioSidecarName(name), true)
  assert.equal(isStudioSidecarName('vidso-fs-file-abcd-export.mp4'), true)
  assert.equal(isStudioSidecarName('Thumbnail-demo-abcd.jpg'), false)
})

test('new projects default to 16:9 and belong to the creating user', () => {
  const rec = createProjectRecord(
    { id: 'user-1', email: 'a@b.com' },
    { topic: 'Airport secrets airlines hide', length: 'long_300', duration_seconds: 300 },
  )
  assert.equal(rec.user_id, 'user-1')
  assert.equal(rec.aspect, '16:9')
  assert.equal(rec.length, 'long_300')
  assert.equal(rec.duration_seconds, 300)
  assert.equal(rec.status, 'draft')
  assert.equal(rec.assets.length, 0)
  assert.match(rec.title, /Airport secrets/)
})

test('create honors 9:16 and keeps a pipeline seed', () => {
  const rec = createProjectRecord(
    { id: 'u' },
    { aspect: '9:16', pipeline: { topic: 'x', phase: 1 }, references: [{ url: 'https://example.com/a.jpg', file_id: 'f1' }] },
  )
  assert.equal(rec.aspect, '9:16')
  assert.equal(rec.pipeline.phase, 1)
  assert.equal(rec.references.length, 1)
  assert.equal(rec.references[0].file_id, 'f1')
})

test('create persists a Fal video model for Studio B-roll', () => {
  const rec = createProjectRecord(
    { id: 'u' },
    { topic: 'x', video_model: 'kling-3-pro', pipeline: { videoModel: 'kling-3-pro' } },
  )
  assert.equal(rec.video_model, 'kling-3-pro')
  assert.equal(rec.pipeline.videoModel, 'kling-3-pro')
})

test('create persists clip duration, sound, and generation count', () => {
  const rec = createProjectRecord(
    { id: 'u' },
    { topic: 'x', clip_duration: 8, video_sound: true, video_count: 3 },
  )
  assert.equal(rec.clip_duration, 8)
  assert.equal(rec.video_sound, true)
  assert.equal(rec.video_count, 3)
})

test('publicProject strips internal file handles', () => {
  const pub = publicProject({ id: '1', user_id: 'u', _meta_file: { id: 'x' }, title: 'T' })
  assert.equal(pub._meta_file, undefined)
  assert.equal(pub.title, 'T')
})

test('userIdOf prefers id then email', () => {
  assert.equal(userIdOf({ id: 'abc' }), 'abc')
  assert.equal(userIdOf({ email: 'x@y.z' }), 'x@y.z')
})

test('pickDefaultVoiceId keeps a valid pick and falls back to the first voice', () => {
  const voices = [{ id: 'a', name: 'Ada' }, { id: 'b', name: 'Ben' }]
  assert.equal(pickDefaultVoiceId(voices, 'b'), 'b')
  assert.equal(pickDefaultVoiceId(voices, 'missing'), 'a')
  assert.equal(pickDefaultVoiceId(voices, ''), 'a')
  assert.equal(pickDefaultVoiceId([], 'b'), '')
})

test('image history hides studio project json but shows export mp4s in My Files', () => {
  assert.equal(isHistorySidecarName('vidso-img-1.meta.json'), true)
  assert.equal(isHistorySidecarName('vidso-fs-proj-abc-123.txt'), true)
  assert.equal(isHistorySidecarName('vidso-fs-proj-abc-123.json'), true)
  assert.equal(isHistorySidecarName('vidso-fs-file-abcd-export.mp4'), false)
})

test('LFG step shots use the shared R2 host', () => {
  assert.equal(LFG_STEP_SHOTS.script.endsWith('/Script.png'), true)
  assert.equal(LFG_STEP_SHOTS.media.endsWith('/Media.png'), true)
  assert.equal(LFG_STEP_SHOTS.export.endsWith('/Export.png'), true)
  assert.ok(LFG_STEP_SHOTS.script.includes('pub-f40c956471ff49feab622906892ec527.r2.dev'))
})

test('studio gallery config is unique, filterable, and has no em dashes', () => {
  const all = studioPresetsAll()
  const ids = all.map((c) => c.id)
  assert.equal(new Set(ids).size, ids.length)
  assert.equal(STUDIO_FILTERS[0].id, 'all')
  assert.equal(studioSectionsForFilter('all').length, STUDIO_SECTIONS.length)
  assert.equal(studioSectionsForFilter('shorts').length, 1)
  assert.equal(studioSectionsForFilter('shorts')[0].cards.length, 6)
  const dump = JSON.stringify(STUDIO_SECTIONS) + STUDIO_FILTERS.map((f) => f.label).join('')
  assert.equal(dump.includes('\u2014') || dump.includes('\u2013'), false)
  for (const card of all) {
    assert.ok(card.scaffold && card.scaffold.length > 20)
    assert.equal(card.image, '')
  }
})

test('renamed presets avoid existing tool names and Thumbnail Pack routes out', () => {
  assert.equal(studioPresetById('numbered-countdown').name, 'Numbered Countdown')
  assert.equal(studioPresetById('process-walkthrough').name, 'Process Walkthrough')
  assert.equal(studioPresetById('hook-burst').name, 'Hook Burst')
  assert.equal(studioPresetById('how-it-works'), null)
  assert.equal(studioPresetById('viral-moment'), null)
  assert.equal(studioPresetById('ranked-countdown'), null)
  const pack = studioPresetById('thumbnail-pack')
  assert.equal(pack.route, 'imagegen')
  assert.match(pack.scaffold, /thumbnail/i)
})

test('section headings put the first words in the accent span', () => {
  const esc = (s) => s
  assert.equal(studioHeadingHtml('LONG FORM', 2, esc), '<span class="accent">LONG FORM</span>')
  assert.equal(studioHeadingHtml('EXPLAINERS', 1, esc), '<span class="accent">EXPLAINERS</span>')
})

test('projects without an owner or with a different user are not visible', () => {
  const rec = { id: 'p1', user_id: 'user-1' }
  assert.equal(projectVisibleTo(rec, { id: 'user-1' }), true)
  assert.equal(projectVisibleTo(rec, { id: 'user-2' }), false)
  assert.equal(projectVisibleTo({ id: 'p1' }, { id: 'user-1' }), false)
  assert.equal(projectVisibleTo(rec, {}), false)
  assert.equal(projectVisibleTo(rec, null), false)
})

test('create rejects missing duration, aspect, voice, and topic', () => {
  assert.throws(() => requireProjectCreateBody({}), /topic/i)
  assert.throws(() => requireProjectCreateBody({ topic: 'x', aspect: '16:9', length: 'long_300' }), /duration/i)
  assert.throws(() => requireProjectCreateBody({ topic: 'x', aspect: '1:1', length: 'long_300', duration_seconds: 300, voice_id: 'v' }), /16:9 or 9:16/)
  assert.throws(() => requireProjectCreateBody({ topic: 'x', aspect: '16:9', length: 'long_300', duration_seconds: 300 }), /voice/i)
  const ok = requireProjectCreateBody({
    topic: 'Airport secrets',
    aspect: '16:9',
    length: 'long_300',
    duration_seconds: 300,
    voice_id: 'voice-1',
  })
  assert.equal(ok.duration_seconds, 300)
  assert.equal(ok.length, 'long_300')
})

test('create does not substitute a 3 minute duration', () => {
  const rec = createProjectRecord({ id: 'u' }, { topic: 'x', aspect: '9:16' })
  assert.equal(rec.duration_seconds, 0)
  assert.equal(rec.length, '')
})
