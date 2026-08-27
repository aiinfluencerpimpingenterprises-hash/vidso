import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  VOICE_SETTING_DEFAULTS,
  normalizeVoiceSettings,
  voiceSettingsPayload,
} from '../lib/voice-settings.js'

test('defaults match ElevenLabs convert API', () => {
  assert.deepEqual(normalizeVoiceSettings(), VOICE_SETTING_DEFAULTS)
  assert.equal(VOICE_SETTING_DEFAULTS.stability, 0.5)
  assert.equal(VOICE_SETTING_DEFAULTS.similarity_boost, 0.75)
  assert.equal(VOICE_SETTING_DEFAULTS.style, 0)
  assert.equal(VOICE_SETTING_DEFAULTS.speed, 1)
  assert.equal(VOICE_SETTING_DEFAULTS.use_speaker_boost, true)
})

test('clamps sliders and accepts similarity / style aliases', () => {
  const v = normalizeVoiceSettings({
    stability: 2,
    similarity: 0.4,
    style_exaggeration: 0.8,
    speed: 0.2,
    use_speaker_boost: false,
  })
  assert.equal(v.stability, 1)
  assert.equal(v.similarity_boost, 0.4)
  assert.equal(v.style, 0.8)
  assert.equal(v.speed, 0.7)
  assert.equal(v.use_speaker_boost, false)
})

test('payload sends nested voice_settings and flat aliases', () => {
  const body = voiceSettingsPayload({ stability: 0.3, similarity_boost: 0.9, style: 0.1, speed: 1.1 })
  assert.equal(body.voice_settings.stability, 0.3)
  assert.equal(body.similarity, 0.9)
  assert.equal(body.similarity_boost, 0.9)
  assert.equal(body.speed, 1.1)
  assert.equal(body.use_speaker_boost, true)
})
