import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  fileKind,
  fileKindLabel,
  formatFileSize,
  galleryItems,
  generationFileName,
  sortFilesNewest,
} from '../lib/files-gallery.js'

test('generation filenames are dated and kind-prefixed', () => {
  const at = new Date('2026-08-28T00:00:00.000Z')
  assert.equal(
    generationFileName('longform', '5 Biggest Tigers of All Time', at),
    'Long-form-5-biggest-tigers-of-all-time-2026-08-28.mp4',
  )
  assert.equal(
    generationFileName('thumbnail', 'Airport secrets', at),
    'Thumbnail-airport-secrets-2026-08-28.jpg',
  )
})

test('gallery classifies and filters uploads', () => {
  const files = [
    { original_name: 'Long-form-tigers-2026-08-28.mp4', mime_type: 'video/mp4' },
    { original_name: 'Thumbnail-plane-2026-08-28.jpg', mime_type: 'image/jpeg' },
    { original_name: 'voice.mp3', mime_type: 'audio/mpeg' },
  ]
  assert.equal(fileKind(files[0]), 'video')
  assert.equal(fileKindLabel(files[0]), 'Long Form')
  assert.equal(fileKindLabel(files[1]), 'Thumbnail')
  assert.equal(galleryItems(files, 'videos').length, 1)
  assert.equal(galleryItems(files, 'thumbnails').length, 1)
  assert.equal(galleryItems(files, 'audio').length, 1)
  assert.equal(galleryItems(files, 'all').length, 3)
})

test('files sort newest first and sizes format', () => {
  const sorted = sortFilesNewest([
    { id: 'a', created_at: '2026-01-01T00:00:00.000Z' },
    { id: 'b', created_at: '2026-08-28T00:00:00.000Z' },
  ])
  assert.equal(sorted[0].id, 'b')
  assert.equal(formatFileSize(2.5 * 1024 * 1024), '2.5 MB')
})
