import test from 'node:test'
import assert from 'node:assert/strict'
import { routeManagerMessage as route } from '../lib/agents-chat.js'

test('edit requests never become video topics', () => {
  assert.equal(route('change the captions style', true).type, 'captions')
  assert.equal(route('change the captions style', false).type, 'captions')
  assert.equal(route('make the title shorter', true).type, 'title')
  assert.equal(route('different thumbnail', true).type, 'thumbnail')
  assert.equal(route('use a deeper voice', true).type, 'voice')
  assert.equal(route('add music', true).type, 'music')
  assert.equal(route('change it', true).type, 'edit')
})

test('real topics stay topics, vague asks get a question', () => {
  assert.equal(route('The rise and fall of Blockbuster', true).type, 'topic')
  assert.equal(route('The history of music in ancient Egypt', true).type, 'topic')
  assert.equal(route('Every special forces unit explained', false).type, 'topic')
  assert.equal(route('make a documentary video about my channel', false).type, 'vague')
  assert.equal(route('make a new video for my youtube channel', false).type, 'vague')
})

test('greetings, thanks and questions about the video never start a video', () => {
  for (const t of ['hii', 'Hi!', 'hello there', 'good morning']) assert.equal(route(t, false).type, 'greeting', t)
  for (const t of ['thanks!', 'ok', 'thank you so much']) assert.equal(route(t, true).type, 'thanks', t)
  assert.equal(route('how long will this take?', true).type, 'question')
  assert.equal(route('What did ancient humans do for fun?', false).type, 'topic')
  assert.equal(route('cats', false).type, 'vague')
})

test('asking to see the finished video shows it instead of starting a new one', async () => {
  const { routeManagerMessage: r } = await import('../lib/agents-chat.js')
  for (const t of ['show me', 'where can i watch it', 'done?', 'play the video', 'download it', 'is it ready']) assert.equal(r(t, true).type, 'watch', t)
  assert.equal(r('show me a video about cats', true).type, 'topic')
  assert.equal(r('make a video about sharks', false).type, 'topic')
})
