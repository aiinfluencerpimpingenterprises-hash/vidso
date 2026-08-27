import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  isJsonSyntaxError,
  parseScriptResponse,
  recoverScriptData,
} from '../lib/json-repair.js'

const userError = "Expected ',' or ']' after array element in JSON at position 18102 (line 59 column 6)"

test('detects the Railway JSON syntax error the dashboard showed', () => {
  assert.equal(isJsonSyntaxError(userError), true)
  assert.equal(isJsonSyntaxError({ message: userError }), true)
  assert.equal(isJsonSyntaxError({ code: 'json_parse' }), true)
  assert.equal(isJsonSyntaxError('Cannot reach Clipzo API'), false)
})

test('parses a complete script object', () => {
  const script = parseScriptResponse(JSON.stringify({
    title: 'Biggest tigers',
    sections: [
      { id: 's1', heading: 'Siberian tiger', text: 'The Siberian tiger is huge.' },
      { id: 's2', heading: 'Bengal tiger', text: 'The Bengal tiger is famous.' },
    ],
  }))
  assert.equal(script.title, 'Biggest tigers')
  assert.equal(script.sections.length, 2)
  assert.match(script.full_script, /Siberian tiger/)
})

test('inserts a missing comma between array elements', () => {
  const raw = '{"title":"Tigers","sections":[{"id":"s1","heading":"One","text":"First tiger."}{"id":"s2","heading":"Two","text":"Second tiger."}]}'
  const script = parseScriptResponse(raw)
  assert.equal(script.sections.length, 2)
  assert.equal(script.sections[1].heading, 'Two')
})

test('salvages complete sections from truncated JSON', () => {
  const raw = `{
    "title": "15 biggest tigers",
    "sections": [
      {"id":"s1","heading":"Siberian","text":"The Siberian tiger lives in the snow."},
      {"id":"s2","heading":"Bengal","text":"The Bengal tiger is found in India."},
      {"id":"s3","heading":"Indochinese","text":"This tiger is unfinished`
  const script = parseScriptResponse(raw)
  assert.ok(script)
  assert.ok(script.sections.length >= 2)
  assert.equal(script.sections[0].heading, 'Siberian')
  assert.equal(script.sections[1].heading, 'Bengal')
})

test('recovers script JSON nested in an error body', () => {
  const raw = '{"title":"Tigers","sections":[{"id":"s1","heading":"One","text":"Hello there."}]}'
  const script = recoverScriptData({ error: userError, raw }, '')
  assert.equal(script.sections.length, 1)
  assert.equal(script.sections[0].text, 'Hello there.')
})
