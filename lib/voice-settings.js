/**
 * ElevenLabs voice settings used by Long Form, Voiceover, and TTS generate.
 * Names match the TTS convert API: stability, similarity_boost, style, speed,
 * use_speaker_boost.
 */

export const VOICE_SETTING_DEFAULTS = {
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0,
  speed: 1,
  use_speaker_boost: true,
}

export const VOICE_SETTING_BOUNDS = {
  stability: { min: 0, max: 1 },
  similarity_boost: { min: 0, max: 1 },
  style: { min: 0, max: 1 },
  speed: { min: 0.7, max: 1.2 },
}

function num(value, fallback) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function clamp(value, min, max, fallback) {
  const n = num(value, fallback)
  return Math.min(max, Math.max(min, n))
}

export function normalizeVoiceSettings(input) {
  const src = input && typeof input === 'object'
    ? (input.voice_settings && typeof input.voice_settings === 'object' ? input.voice_settings : input)
    : {}
  const similarity = src.similarity_boost ?? src.similarity
  const style = src.style ?? src.style_exaggeration
  const boost = src.use_speaker_boost
  return {
    stability: clamp(src.stability, 0, 1, VOICE_SETTING_DEFAULTS.stability),
    similarity_boost: clamp(similarity, 0, 1, VOICE_SETTING_DEFAULTS.similarity_boost),
    style: clamp(style, 0, 1, VOICE_SETTING_DEFAULTS.style),
    speed: clamp(src.speed, 0.7, 1.2, VOICE_SETTING_DEFAULTS.speed),
    use_speaker_boost: boost !== false && boost !== 'false' && boost !== 0,
  }
}

/** Flat + nested fields so Railway can read either shape. */
export function voiceSettingsPayload(input) {
  const v = normalizeVoiceSettings(input)
  return {
    voice_settings: v,
    stability: v.stability,
    similarity_boost: v.similarity_boost,
    similarity: v.similarity_boost,
    style: v.style,
    speed: v.speed,
    use_speaker_boost: v.use_speaker_boost,
  }
}
