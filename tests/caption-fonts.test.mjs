import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  FACELESS_CAPTION_FONT_GROUPS,
  captionFontList,
  captionGoogleFamilies,
  googleFontsStylesheetHref,
  DEFAULT_CAPTION_FONT_CSS,
} from '../lib/caption-fonts.js'

test('Long Form caption fonts include the requested families', () => {
  const labels = captionFontList().map((f) => f.label.toLowerCase())
  for (const name of [
    'DM Mono', 'Arial', 'Arial Black', 'DM Sans Black', 'Inter', 'LEMON MILK BOLD',
    'MADE Tommy', 'KOULEN', 'Times New Roman', 'Impact', 'Lilita One', 'Helvetica',
    'Georgia', 'Comic Sans MS', 'Roboto', 'Poppins', 'Playfair Display', 'Bebas Neue',
    'Oswald', 'Bangers', 'Pacifico', 'Fira Code', 'JetBrains Mono', 'Rubik Glitch',
  ]) {
    assert.ok(labels.includes(name.toLowerCase()), 'missing ' + name)
  }
  assert.ok(captionFontList().length > 150)
  assert.equal(DEFAULT_CAPTION_FONT_CSS, 'Bangers, cursive')
})

test('caption font labels are unique and Google CSS URLs are well formed', () => {
  const labels = captionFontList().map((f) => f.label.toLowerCase())
  assert.equal(labels.length, new Set(labels).size)
  const href = googleFontsStylesheetHref(['DM Sans', 'Press Start 2P'])
  assert.match(href, /^https:\/\/fonts\.googleapis\.com\/css2\?/)
  assert.ok(href.includes('family=DM+Sans'))
  assert.ok(href.includes('Press+Start+2P'))
  assert.ok(captionGoogleFamilies().includes('Inter'))
  assert.ok(FACELESS_CAPTION_FONT_GROUPS.some((g) => g.label === 'Handwriting'))
})
