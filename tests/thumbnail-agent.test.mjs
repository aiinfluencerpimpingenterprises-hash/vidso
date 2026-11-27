import { test } from 'node:test'
import assert from 'node:assert/strict'
import { thumbRecipeKey, cleanThumbText, thumbnailDirectorPrompt, parseDirectorResponse, thumbnailImagePrompt, fallbackConcept, thumbnailJudgePrompt, parseJudgeResponse } from '../lib/thumbnail-agent.js'

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
  assert.match(p, /sits on the left side, big and close/)
  assert.match(p, /'\$8 BILLION'.*empty right side/)
  assert.match(p, /Nothing important in the bottom-right corner/)
  assert.doesNotMatch(p, /video length/) // it made the model draw a blank timestamp box
  assert.match(p, /no blank or white rectangles, no placeholders, no timestamps/)
  assert.match(p, /only lettering in the whole image/)
  assert.match(p, /full-bleed/)
  assert.equal(parseDirectorResponse('no json'), null)
  assert.match(thumbnailImagePrompt({ concept: fallbackConcept({ title: 'X', recipeKey: 'kids' }), title: 'X' }), /No text at all: no letters/)
})

test('the brief asks for the story moment, never a generic symbol', () => {
  const p = thumbnailDirectorPrompt({ title: 'The rise and fall of the biggest crypto scammer', recipeKey: 'finance' })
  assert.match(p, /Show the specific story moment with emotion/)
  assert.match(p, /no coins, no Bitcoin logo/)
  assert.match(p, /fills 40-50% of the frame/)
})

test('the judge rejects broken candidates and picks the higher score', () => {
  assert.match(thumbnailJudgePrompt({ title: 'T', text: '$8 BILLION' }), /white or blank box/)
  assert.deepEqual(parseJudgeResponse('{"scores":[0,7],"best":1,"problem":"white box"}'), { best: 1, scores: [0, 7], problem: 'white box' })
  assert.equal(parseJudgeResponse('{"scores":[8,3],"best":2}').best, 0) // trusts the scores over a wrong "best"
  assert.equal(parseJudgeResponse('nope'), null)
})
