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
export function listCountFromTopic(topic) {
  const s = String(topic || '')
  const m = s.match(/\b(\d{1,2})\b/)
  if (!m) return null
  const n = Number(m[1])
  if (!Number.isFinite(n) || n < 3 || n > 20) return null
  return n
}

export function targetSectionCount(topic, durationSeconds) {
  const listed = listCountFromTopic(topic)
  if (listed) return listed
  const sec = Number(durationSeconds)
  if (!Number.isFinite(sec) || sec <= 0) return 4
  if (sec <= 60) return 3
  if (sec <= 180) return 4
  if (sec <= 300) return 6
  if (sec <= 600) return 8
  if (sec <= 900) return 10
  return 12
}

export function wordsPerSection(targetWords, sectionCount) {
  const words = Math.max(1, Number(targetWords) || 1)
  const n = Math.max(1, Number(sectionCount) || 1)
  return Math.max(40, Math.round(words / n))
}

/** One JSON blob larger than this regularly comes back truncated. */
export const FULL_JSON_WORD_CAP = 900
export const OUTLINE_WORDS_PER_SECTION = 60

export function shouldOutlineFirst(targetWords) {
  return Number(targetWords) > FULL_JSON_WORD_CAP
}

export function outlineTargetWords(sectionCount) {
  return OUTLINE_WORDS_PER_SECTION * Math.max(1, Number(sectionCount) || 1)
}

export function scriptOutlineBrief({ topic, durationSeconds, targetWords }) {
  const seconds = Number(durationSeconds)
  const words = Number(targetWords) || targetWordsFromSeconds(seconds)
  const sections = targetSectionCount(topic, seconds)
  const listed = listCountFromTopic(topic)
  const structure = listed
    ? `Use exactly ${listed} separate sections, one item each. Do not put multiple numbered items in one section.`
    : `Use ${sections} separate spoken sections.`
  return [
    'Return valid JSON only. No markdown. No commentary.',
    `This is an outline for a ${formatDurationSeconds(seconds)} video that will later be about ${words} words.`,
    structure,
    `Each section text must be ${OUTLINE_WORDS_PER_SECTION} spoken words or fewer.`,
    'Do not write the full narration yet. Incomplete JSON is a failure.',
  ].join(' ')
}

export function scriptUpstreamBody(body) {
  const next = { ...(body || {}) }
  if (next.outline) {
    delete next.duration_id
    delete next.durationId
  }
  return next
}

export function scriptLengthBrief({ topic, durationSeconds, targetWords }) {
  const seconds = Number(durationSeconds)
  const words = Number(targetWords) || targetWordsFromSeconds(seconds)
  const sections = targetSectionCount(topic, seconds)
  const per = wordsPerSection(words, sections)
  const listed = listCountFromTopic(topic)
  const structure = listed
    ? `Use exactly ${listed} separate sections, one item each. Do not put multiple numbered items in one section.`
    : `Use ${sections} separate spoken sections.`
  return [
    `Write a spoken narration for a ${formatDurationSeconds(seconds)} video.`,
    `Hard length: about ${words} words at ${WORDS_PER_MINUTE} words per minute.`,
    structure,
    `Each section should be about ${per} spoken words.`,
    'Do not compress this into a short listicle or a 3 minute recap.',
  ].join(' ')
}

/** Clipzo rejects `topic` over 500 characters. Keep the user prompt in topic
 *  when it fits; put length notes and overflow in `brief` / `prompt`. */
export const RAILWAY_TOPIC_MAX = 500

export function clipTopicForRailway(topic, max = RAILWAY_TOPIC_MAX) {
  const s = String(topic || '').trim()
  const cap = Math.max(1, Number(max) || RAILWAY_TOPIC_MAX)
  if (s.length <= cap) return s
  const slice = s.slice(0, cap)
  const sp = Math.max(slice.lastIndexOf(' '), slice.lastIndexOf('\n'))
  if (sp >= cap * 0.6) return slice.slice(0, sp).trim()
  return slice.trim()
}

export function packScriptRequest({ topic, brief, extra } = {}) {
  const full = String(topic || '').trim()
  const notes = [brief, extra].filter(Boolean).join('\n\n')
  const topicOut = clipTopicForRailway(full)
  const overflow = full.length > topicOut.length
  const briefOut = [overflow ? full : '', notes].filter(Boolean).join('\n\n')
  return {
    topic: topicOut,
    brief: briefOut,
    prompt: full,
    user_prompt: full,
  }
}

export function scriptTimeoutMs(durationSeconds) {
  const sec = Number(durationSeconds)
  const n = Number.isFinite(sec) && sec > 0 ? sec : 180
  return Math.min(180000, Math.max(90000, Math.round(n * 80)))
}

export function sectionNeedsExpand(text, wordTarget, ratio = 0.7) {
  const want = Number(wordTarget)
  const r = Number(ratio)
  if (!Number.isFinite(want) || want <= 0) return false
  if (!Number.isFinite(r) || r <= 0) return false
  return countSpokenWords(text) < want * r
}

export function stitchSectionText(previous, next) {
  const prev = String(previous || '').trim()
  const add = String(next || '').trim()
  if (!add) return prev
  if (!prev) return add
  if (countSpokenWords(add) >= countSpokenWords(prev) + 25) return add
  const head = prev.slice(0, Math.min(80, prev.length))
  if (head && add.startsWith(head) && countSpokenWords(add) > countSpokenWords(prev)) return add
  const combined = prev + '\n\n' + add
  if (countSpokenWords(combined) > countSpokenWords(prev)) return combined
  return countSpokenWords(add) > countSpokenWords(prev) ? add : prev
}

export function trimSpokenText(text, maxWords) {
  const raw = String(text || '').trim()
  const max = Math.max(1, Math.floor(Number(maxWords) || 0))
  const words = raw.split(/\s+/).filter(Boolean)
  if (words.length <= max) return raw
  const sliced = words.slice(0, max).join(' ')
  const cut = sliced.match(/^(.*[.!?])(?:\s+[^.!?]*)$/)
  if (cut && countSpokenWords(cut[1]) >= Math.floor(max * 0.82)) return cut[1].trim()
  return sliced
}

export function capScriptToTarget(script, targetWords) {
  if (!script || typeof script !== 'object') return script
  const want = Math.max(1, Math.floor(Number(targetWords) || 0))
  const sections = Array.isArray(script.sections) ? script.sections : []
  if (!sections.length) {
    if (script.full_script) script.full_script = trimSpokenText(script.full_script, want)
    return script
  }
  const per = wordsPerSection(want, sections.length)
  for (const s of sections) s.text = trimSpokenText(s.text, per)
  rebuildFullScript(script)
  let guard = 0
  while (scriptWordCount(script) > want && guard++ < 40) {
    const overflow = scriptWordCount(script) - want
    let idx = -1
    let most = 0
    sections.forEach((s, i) => {
      const n = countSpokenWords(s.text)
      if (n > most) { most = n; idx = i }
    })
    if (idx < 0 || most <= 20) break
    const keep = Math.max(20, most - overflow)
    const next = trimSpokenText(sections[idx].text, keep)
    if (countSpokenWords(next) <= keep) sections[idx].text = next
    else sections[idx].text = String(sections[idx].text || '').trim().split(/\s+/).filter(Boolean).slice(0, keep).join(' ')
    rebuildFullScript(script)
  }
  return script
}

export function headingKey(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

export function mergeNewSections(existing, incoming, limit) {
  const have = new Set((existing || []).map((s) => headingKey(s?.heading || s?.id)))
  const added = []
  const max = Math.max(0, Number(limit) || 0)
  for (const sec of incoming || []) {
    if (added.length >= max) break
    const heading = String(sec?.heading || sec?.title || '').trim()
    const text = String(sec?.text || sec?.content || '')
    const key = headingKey(heading || sec?.id)
    if (!key || have.has(key)) continue
    have.add(key)
    added.push({
      id: String(sec?.id || 's' + ((existing || []).length + added.length + 1)),
      heading: heading || ('Section ' + ((existing || []).length + added.length + 1)),
      text,
    })
  }
  return added
}

export function padListSections(sections, want) {
  const next = Array.isArray(sections) ? sections.map((s, i) => ({
    id: String(s?.id || 's' + (i + 1)),
    heading: String(s?.heading || s?.title || ('Section ' + (i + 1))),
    text: String(s?.text || ''),
  })) : []
  const n = Math.max(1, Number(want) || 1)
  while (next.length < n) {
    const i = next.length + 1
    next.push({ id: 's' + i, heading: 'Item ' + i + ' of ' + n, text: '' })
  }
  return next.slice(0, n)
}

export function needsMoreSections(script, want) {
  const n = Math.max(1, Number(want) || 1)
  return (Array.isArray(script?.sections) ? script.sections.length : 0) < n
}

export function rebuildFullScript(script) {
  if (!script || typeof script !== 'object') return script
  const sections = Array.isArray(script.sections) ? script.sections : []
  script.full_script = sections.map((s) => String(s?.text || '')).filter(Boolean).join('\n\n')
  if (sections[0]) script.hook = sections[0].text
  return script
}

export function facelessScriptPayload({ topic, aspect, durationId, durationSeconds, outline }) {
  const seconds = Number(durationSeconds)
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error('A video duration is required.')
  }
  if (!durationId) throw new Error('A video duration is required.')
  const rawTopic = String(topic || '').trim()
  const target_minutes = seconds / 60
  const target_words = targetWordsFromSeconds(seconds)
  const target_sections = targetSectionCount(rawTopic, seconds)
  const useOutline = outline === true || (outline !== false && shouldOutlineFirst(target_words))
  if (useOutline) {
    const outlineWords = outlineTargetWords(target_sections)
    const outlineMinutes = outlineWords / WORDS_PER_MINUTE
    return {
      topic: rawTopic,
      aspect: aspect || '16:9',
      duration_id: durationId,
      duration: outlineMinutes,
      duration_seconds: Math.round(outlineMinutes * 60),
      target_minutes: outlineMinutes,
      target_words: outlineWords,
      final_target_words: target_words,
      words_per_minute: WORDS_PER_MINUTE,
      target_sections,
      words_per_section: OUTLINE_WORDS_PER_SECTION,
      outline: true,
      brief: scriptOutlineBrief({ topic: rawTopic, durationSeconds: seconds, targetWords: target_words }),
    }
  }
  return {
    topic: rawTopic,
    aspect: aspect || '16:9',
    duration_id: durationId,
    duration: target_minutes,
    duration_seconds: seconds,
    target_minutes,
    target_words,
    final_target_words: target_words,
    words_per_minute: WORDS_PER_MINUTE,
    target_sections,
    words_per_section: wordsPerSection(target_words, target_sections),
    brief: scriptLengthBrief({ topic: rawTopic, durationSeconds: seconds, targetWords: target_words }),
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
  next.words_per_minute = WORDS_PER_MINUTE
  const topic = String(next.topic || '').trim()
  if (topic && (next.target_sections == null || next.target_sections === '')) {
    next.target_sections = targetSectionCount(topic, sec)
  }
  if (next.outline) {
    const sections = next.target_sections || targetSectionCount(topic, sec)
    if (next.target_words == null || next.target_words === '') {
      next.target_words = outlineTargetWords(sections)
    }
    if (next.final_target_words == null || next.final_target_words === '') {
      next.final_target_words = targetWordsFromSeconds(sec)
    }
    if (next.duration == null || next.duration === '') {
      next.duration = Number(next.target_words) / WORDS_PER_MINUTE
    }
    if (next.target_minutes == null || next.target_minutes === '') {
      next.target_minutes = Number(next.duration)
    }
    next.duration_seconds = Math.round(Number(next.duration) * 60)
    if (next.words_per_section == null || next.words_per_section === '') {
      next.words_per_section = OUTLINE_WORDS_PER_SECTION
    }
    if (!next.brief && topic) {
      next.brief = scriptOutlineBrief({
        topic,
        durationSeconds: sec,
        targetWords: next.final_target_words,
      })
    }
    return next
  }
  next.duration_seconds = sec
  next.target_minutes = sec / 60
  next.target_words = targetWordsFromSeconds(sec)
  next.final_target_words = next.target_words
  if (next.duration == null || next.duration === '') next.duration = sec / 60
  if (topic) {
    if (next.words_per_section == null || next.words_per_section === '') {
      next.words_per_section = wordsPerSection(next.target_words, next.target_sections)
    }
    if (!next.brief) {
      next.brief = scriptLengthBrief({
        topic,
        durationSeconds: sec,
        targetWords: next.target_words,
      })
    }
  }
  return next
}
