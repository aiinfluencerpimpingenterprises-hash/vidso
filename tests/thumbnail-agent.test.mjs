import { test } from 'node:test'
import assert from 'node:assert/strict'
import { thumbRecipeKey, cleanThumbText, thumbnailDirectorPrompt, parseDirectorResponse, thumbnailImagePrompt, fallbackConcept } from '../lib/thumbnail-agent.js'

test('the recipe follows the topic first, then the kind of channel', () => {
  assert.equal(thumbRecipeKey({ title: 'The rise and fall of FTX', group: 'education' }), 'finance')
  assert.equal(thumbRecipeKey({ title: 'The village that vanished overnight' }), 'mystery')
  assert.equal(thumbRecipeKey({ title: 'What a black hole sounds like' }), 'science')
  assert.equal(thumbRecipeKey({ title: 'Something else', group: 'psychology' }), 'psychology')
  assert.equal(thumbRecipeKey({ title: 'Space cats', group: 'kids' }), 'kids')
})

test('thumbnail text: at most 4 words, under 26 characters, never just the title again', () => {
  assert.equal(cleanThumbText('the $26 billion lie', 'FTX explained'), 'THE $26 BILLION LIE')
  assert.equal(cleanThumbText('Understand FTX Fraud', 'If You Don\'t Understand FTX, You Don\'t Understand Fraud'), '')
  assert.equal(cleanThumbText('one two three four five six', ''), 'ONE TWO THREE FOUR')
  assert.equal(cleanThumbText('none', 'x'), '')
  assert.ok(cleanThumbText('extraordinarily unbelievable consequences', '').length <= 25)
})

test('the director brief bans clutter and carries the recipe, art style and what to avoid', () => {
  const p = thumbnailDirectorPrompt({ title: 'T', artStyle: 'Stickman cartoon', recipeKey: 'psychology', avoid: 'a tired stick figure' })
  assert.match(p, /Stickman cartoon/)
  assert.match(p, /expressive character or one classical statue/)
  assert.match(p, /Never: collages, grids of icons, infographics/)
  assert.match(p, /clearly different from the last thumbnail, which showed: a tired stick figure/)
})

test('director replies are parsed and the image prompt is a shot brief', () => {
  const c = parseDirectorResponse('Sure! {"subject":"A lone sports car in an empty garage, door open","emotion":"dread","shot":"low angle","side":"left","background":"dark garage","text":"$8 BILLION","palette":"black, red"}')
  assert.equal(c.side, 'left')
  const p = thumbnailImagePrompt({ concept: c, title: 'FTX', artStyle: 'Comic book', hasRefs: true })
  assert.match(p, /same art style/)
  assert.match(p, /sits on the left third/)
  assert.match(p, /'\$8 BILLION'.*empty right side/)
  assert.match(p, /bottom-right corner empty/)
  assert.match(p, /No icons, no infographic/)
  assert.equal(parseDirectorResponse('no json'), null)
  assert.match(thumbnailImagePrompt({ concept: fallbackConcept({ title: 'X', recipeKey: 'kids' }), title: 'X' }), /No text, no letters/)
})
