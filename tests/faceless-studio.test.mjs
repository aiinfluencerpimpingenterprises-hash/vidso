import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  createProjectRecord,
  isStudioSidecarName,
  projectFileName,
  publicProject,
  userIdOf,
} from '../lib/faceless-studio-store.js'
import { isHistorySidecarName, LFG_STEP_SHOTS } from '../lib/image-gen.js'

test('studio sidecars are named and hidden from My Files', () => {
  const name = projectFileName('abc-123')
  assert.equal(name, 'vidso-fs-proj-abc-123.json')
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
    { aspect: '9:16', pipeline: { topic: 'x', phase: 1 } },
  )
  assert.equal(rec.aspect, '9:16')
  assert.equal(rec.pipeline.phase, 1)
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

test('image history filter also hides studio json once wired', () => {
  assert.equal(isHistorySidecarName('vidso-img-1.meta.json'), true)
  assert.equal(isHistorySidecarName('vidso-fs-proj-abc-123.json'), true)
  assert.equal(isHistorySidecarName('vidso-fs-file-abcd-export.mp4'), true)
})

test('LFG step shots use the shared R2 host', () => {
  assert.equal(LFG_STEP_SHOTS.script.endsWith('/Script.png'), true)
  assert.equal(LFG_STEP_SHOTS.media.endsWith('/Media.png'), true)
  assert.equal(LFG_STEP_SHOTS.export.endsWith('/Export.png'), true)
  assert.ok(LFG_STEP_SHOTS.script.includes('pub-f40c956471ff49feab622906892ec527.r2.dev'))
})
