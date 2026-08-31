import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  boundBrollKeywords,
  boundBrollQuery,
  isGenericBrollQuery,
  speciesNearGeneric,
  stripGenericTerms,
  topicSubjects,
} from '../lib/broll-match.js'
import { brollQueriesFromScript } from '../lib/youtube-broll.js'
import { splitScriptForMedia } from '../lib/faceless-length.js'

test('species is read from the words in front of cub, not cub itself', () => {
  assert.equal(
    speciesNearGeneric('The mother honey badger stays close to her cub.'),
    'honey badger',
  )
  assert.equal(speciesNearGeneric('honey badger cub'), 'honey badger')
})

test('stock search drops cub so Pexels does not return lion cubs', () => {
  const topic = 'Mama Badger vs Crocodile'
  const text = 'The mother honey badger stays close to her cub while crocodiles wait nearby.'
  assert.equal(boundBrollQuery({ query: 'cub', text, topic, stock: true }), 'honey badger')
  assert.equal(boundBrollQuery({ query: 'honey badger cub', text, topic, stock: true }), 'honey badger')
  assert.equal(boundBrollQuery({ query: 'baby honey badger', stock: true }), 'honey badger')
})

test('YouTube search keeps the life-stage word once the species is attached', () => {
  assert.equal(
    boundBrollQuery({
      query: 'cub',
      text: 'The mother honey badger stays close to her cub.',
      topic: 'Mama Badger vs Crocodile',
      stock: false,
    }),
    'honey badger cub',
  )
})

test('specific headings are left alone', () => {
  assert.equal(boundBrollQuery({ query: 'Airbus A380', topic: '12 biggest planes', stock: true }), 'Airbus A380')
  assert.equal(isGenericBrollQuery('cub'), true)
  assert.equal(isGenericBrollQuery('honey badger'), false)
  assert.deepEqual(topicSubjects('Mama Badger vs Crocodile'), ['Mama Badger', 'Crocodile'])
  assert.equal(stripGenericTerms('honey badger cub'), 'honey badger')
})

test('media chunks send species keywords, not cub', () => {
  const chunks = splitScriptForMedia({
    topic: 'Mama Badger vs Crocodile',
    keywords: ['cub', 'honey badger cub', 'crocodile'],
    sections: [{
      heading: 'The cub',
      text: 'The mother honey badger stays close to her cub at the river bank.',
    }],
  })
  assert.deepEqual(chunks[0].keywords, ['honey badger', 'crocodile'])
})

test('YouTube queries do not search cub by itself', () => {
  assert.deepEqual(brollQueriesFromScript({
    topic: 'Mama Badger vs Crocodile',
    keywords: ['cub'],
    sections: [{
      heading: 'The cub',
      text: 'The mother honey badger stays close to her cub.',
    }],
  }), ['honey badger cub'])
})
