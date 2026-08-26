import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_IMAGE_MODEL, falImageInput, imageModelById, urlsFromFalResult } from '../lib/fal-image.js'

test('Nano Banana Pro maps to fal-ai/nano-banana-pro with 2K resolution', () => {
  const { endpoint, input, model } = falImageInput('nano-banana-pro', 'a dog', { aspect: '9:16' })
  assert.equal(model.id, 'nano-banana-pro')
  assert.equal(endpoint, 'fal-ai/nano-banana-pro')
  assert.equal(input.aspect_ratio, '9:16')
  assert.equal(input.resolution, '2K')
  assert.equal(input.image_size, undefined)
  assert.equal(input.num_images, 1)
  assert.equal(input.prompt, 'a dog')
})

test('unknown model ids fall back to Nano Banana Pro', () => {
  assert.equal(imageModelById('flux-schnell').id, DEFAULT_IMAGE_MODEL)
  const { endpoint } = falImageInput('not-a-real-model', 'x', { aspect: '16:9' })
  assert.equal(endpoint, 'fal-ai/nano-banana-pro')
})

test('Flux 2 Pro sends pixel size instead of banana resolution', () => {
  const { endpoint, input } = falImageInput('flux-2-pro', 'city', { aspect: '16:9', num_images: 2 })
  assert.equal(endpoint, 'fal-ai/flux-2-pro')
  assert.equal(input.aspect_ratio, '16:9')
  assert.ok(input.image_size?.width > 0)
  assert.equal(input.num_images, 2)
  assert.equal(input.resolution, undefined)
})

test('reference images switch Banana Pro to the edit endpoint', () => {
  const { endpoint, input, model } = falImageInput('nano-banana-pro', 'match this face', {
    aspect: '16:9',
    image_urls: ['https://example.com/ref.jpg'],
  })
  assert.equal(model.imageInput, true)
  assert.equal(endpoint, 'fal-ai/nano-banana-pro/edit')
  assert.deepEqual(input.image_urls, ['https://example.com/ref.jpg'])
})

test('text-only models reject reference images', () => {
  assert.throws(
    () => falImageInput('flux-2-max', 'x', { image_urls: ['https://example.com/ref.jpg'] }),
    (err) => err.code === 'no_image_input'
  )
})

test('auto aspect keeps auto on banana and sizes 16:9 pixels on flux', () => {
  const banana = falImageInput('nano-banana-pro', 'x', { aspect: 'auto' })
  assert.equal(banana.input.aspect_ratio, 'auto')
  const flux = falImageInput('flux-2-pro', 'x', { aspect: '21:9', resolution: '1K' })
  assert.equal(flux.input.aspect_ratio, '21:9')
  assert.ok(flux.input.image_size.width > flux.input.image_size.height)
})

test('fal result parser reads images[].url', () => {
  assert.deepEqual(
    urlsFromFalResult({ images: [{ url: 'https://a' }, { url: 'https://b' }], image: { url: 'https://a' } }),
    ['https://a', 'https://b']
  )
})
