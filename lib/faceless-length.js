/**
 * Single source of truth for faceless target length.
 * Duration chips pick seconds. Script generation must receive an explicit
 * word-count target. Missing duration is an error, never a silent 3 min.
 */

export const WORDS_PER_MINUTE = 150
export const LENGTH_TOLERANCE = 0.15

export function targetWordsFromSeconds(seconds, wpm = WORDS_PER_MINUTE) {
  const sec = Number(seconds)
  if (!Number.isFinite(sec) || sec <= 0) {
    throw new Error('A video duration is required.')
  }
  const rate = Number(wpm)
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error('Words per minute must be a positive number.')
  }
  return Math.max(1, Math.round((sec / 60) * rate))
}

export function countSpokenWords(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length
}

export function scriptWordCount(script) {
  if (!script || typeof script !== 'object') return countSpokenWords(script)
  const sections = Array.isArray(script.sections) ? script.sections : []
  const fromSections = sections.map((s) => String(s?.text || '')).join(' ')
  const blob = fromSections.trim() || String(script.full_script || script.hook || '')
  return countSpokenWords(blob)
}

export function impliedSecondsFromWords(wordCount, wpm = WORDS_PER_MINUTE) {
  const words = Number(wordCount)
  const rate = Number(wpm)
  if (!Number.isFinite(words) || words <= 0) return 0
  if (!Number.isFinite(rate) || rate <= 0) return 0
  return Math.round((words / rate) * 60)
}

export function isMateriallyShort(actualSeconds, targetSeconds, tolerance = LENGTH_TOLERANCE) {
  const actual = Number(actualSeconds)
  const target = Number(targetSeconds)
  if (!Number.isFinite(target) || target <= 0) {
    throw new Error('A video duration is required.')
  }
  if (!Number.isFinite(actual) || actual <= 0) return true
  return actual < target * (1 - Number(tolerance))
}

export function formatDurationSeconds(seconds) {
  const n = Math.max(0, Math.round(Number(seconds) || 0))
  if (n < 120) return n + 's'
  const mins = n / 60
  return Number.isInteger(mins) ? mins + ' min' : mins.toFixed(1) + ' min'
}

/**
 * Script POST body. Railway's script handler historically read `duration`
 * as minutes and defaulted to 3 when the field was absent. The 3 min chip
 * is long_180; sending only duration_id left that default in place.
 * Media/render keep using duration in seconds.
 */
export function facelessScriptPayload({ topic, aspect, durationId, durationSeconds }) {
  const seconds = Number(durationSeconds)
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error('A video duration is required.')
  }
  if (!durationId) throw new Error('A video duration is required.')
  const target_minutes = seconds / 60
  return {
    topic: String(topic || '').trim(),
    aspect: aspect || '16:9',
    duration_id: durationId,
    duration: target_minutes,
    duration_seconds: seconds,
    target_minutes,
    target_words: targetWordsFromSeconds(seconds),
    words_per_minute: WORDS_PER_MINUTE,
  }
}

export function facelessMediaPayloadExtras(durationId, durationSeconds) {
  const seconds = Number(durationSeconds)
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error('A video duration is required.')
  }
  if (!durationId) throw new Error('A video duration is required.')
  return {
    duration_id: durationId,
    duration: seconds,
    duration_seconds: seconds,
    target_minutes: seconds / 60,
    target_words: targetWordsFromSeconds(seconds),
    words_per_minute: WORDS_PER_MINUTE,
  }
}

export function enrichScriptBody(body, seconds) {
  const next = { ...(body || {}) }
  const sec = Number(seconds)
  if (!Number.isFinite(sec) || sec <= 0) return next
  next.duration_seconds = sec
  next.target_minutes = sec / 60
  next.target_words = targetWordsFromSeconds(sec)
  next.words_per_minute = WORDS_PER_MINUTE
  if (next.duration == null || next.duration === '') next.duration = sec / 60
  return next
}
