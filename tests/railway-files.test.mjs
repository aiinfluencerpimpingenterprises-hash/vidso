import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  isSidecarUpload,
  isTypeRejected,
  packJsonBytes,
  parseJsonSidecar,
} from '../lib/railway-files.js'
import { projectFileName, projectIdFromName } from '../lib/faceless-studio-store.js'
import { isHistorySidecarName, isMetaFileName, metaIdFromName } from '../lib/image-gen.js'

test('sidecar upload detection covers studio and history names', () => {
  assert.equal(isSidecarUpload('vidso-fs-proj-abc.txt', 'text/plain'), true)
  assert.equal(isSidecarUpload('notes.json', 'application/json'), true)
  assert.equal(isSidecarUpload('Thumbnail-demo.jpg', 'image/jpeg'), false)
})

test('type-rejected errors include Railway file type copy', () => {
  assert.equal(isTypeRejected(new Error('File type not allowed')), true)
  assert.equal(isTypeRejected(new Error('Upload failed')), false)
})

test('json sidecars round-trip through a jpeg wrapper', () => {
  const rec = { id: 'p1', topic: 'chess' }
  const packed = packJsonBytes(Buffer.from(JSON.stringify(rec)))
  assert.equal(packed[0], 0xff)
  assert.equal(packed[1], 0xd8)
  assert.deepEqual(parseJsonSidecar(packed), rec)
  assert.deepEqual(parseJsonSidecar(Buffer.from(JSON.stringify(rec))), rec)
})

test('studio project names stay findable after type fallback', () => {
  assert.equal(projectFileName('abc-123'), 'vidso-fs-proj-abc-123.txt')
  assert.equal(projectIdFromName('vidso-fs-proj-abc-123.txt'), 'abc-123')
  assert.equal(projectIdFromName('vidso-fs-proj-abc-123.json'), 'abc-123')
  assert.equal(projectIdFromName('vidso-fs-proj-abc-123.jpg'), 'abc-123')
  assert.equal(isHistorySidecarName('vidso-fs-proj-abc-123.jpg'), true)
  assert.equal(isHistorySidecarName('vidso-fs-file-abcd-export.mp4'), false)
})

test('image meta names still resolve after type fallback', () => {
  assert.equal(isMetaFileName('vidso-img-1.meta.json'), true)
  assert.equal(isMetaFileName('vidso-img-1.meta.txt'), true)
  assert.equal(metaIdFromName('vidso-img-1.meta.jpg'), '1')
})
