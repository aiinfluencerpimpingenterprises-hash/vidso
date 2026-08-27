/**
 * Salvage LLM / Railway script JSON that was truncated or missing commas.
 * The 30 min generator often returns a broken array around 18KB.
 */

import { rebuildFullScript } from './faceless-length.js'

export function isJsonSyntaxError(err) {
  const msg = typeof err === 'string' ? err : String(err?.message || err?.code || '')
  return /JSON at position|Unexpected (token|end of JSON|string)|Expected ',' or|in JSON at position|Unterminated string|json_parse/i.test(msg)
}

export function looksLikeScript(obj) {
  if (!obj || typeof obj !== 'object') return false
  const inner = obj.script && typeof obj.script === 'object' ? obj.script : obj
  if (Array.isArray(inner.sections) && inner.sections.length) return true
  if (String(inner.full_script || '').trim()) return true
  return false
}

function stripFence(text) {
  let s = String(text || '').replace(/^\uFEFF/, '').trim()
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) s = fence[1].trim()
  const start = s.search(/[\{\[]/)
  if (start > 0) s = s.slice(start)
  return s.trim()
}

function insertMissingCommas(s) {
  return s
    .replace(/}\s*{/g, '},{')
    .replace(/]\s*\[/g, '],[')
}

function closeOpenStructures(s) {
  let next = s.replace(/,+\s*$/, '')
  let inStr = false
  let esc = false
  let braces = 0
  let brackets = 0
  for (let i = 0; i < next.length; i++) {
    const c = next[i]
    if (inStr) {
      if (esc) { esc = false; continue }
      if (c === '\\') { esc = true; continue }
      if (c === '"') inStr = false
      continue
    }
    if (c === '"') { inStr = true; continue }
    if (c === '{') braces++
    else if (c === '}') braces = Math.max(0, braces - 1)
    else if (c === '[') brackets++
    else if (c === ']') brackets = Math.max(0, brackets - 1)
  }
  if (inStr) next += '"'
  next = next
    .replace(/,\s*"[^"\\]*"\s*:\s*("[^"]*)?$/, '')
    .replace(/,\s*"[^"\\]*"\s*:\s*$/, '')
    .replace(/:\s*$/, ': null')
    .replace(/,+\s*$/, '')
  inStr = false
  esc = false
  braces = 0
  brackets = 0
  for (let i = 0; i < next.length; i++) {
    const c = next[i]
    if (inStr) {
      if (esc) { esc = false; continue }
      if (c === '\\') { esc = true; continue }
      if (c === '"') inStr = false
      continue
    }
    if (c === '"') { inStr = true; continue }
    if (c === '{') braces++
    else if (c === '}') braces = Math.max(0, braces - 1)
    else if (c === '[') brackets++
    else if (c === ']') brackets = Math.max(0, brackets - 1)
  }
  if (inStr) next += '"'
  while (brackets > 0) { next += ']'; brackets-- }
  while (braces > 0) { next += '}'; braces-- }
  return next
}

function extractCompleteObjects(text) {
  const objects = []
  let i = 0
  const s = String(text || '')
  while (i < s.length) {
    const start = s.indexOf('{', i)
    if (start < 0) break
    let depth = 0
    let inStr = false
    let esc = false
    let end = -1
    for (let j = start; j < s.length; j++) {
      const c = s[j]
      if (inStr) {
        if (esc) { esc = false; continue }
        if (c === '\\') { esc = true; continue }
        if (c === '"') inStr = false
        continue
      }
      if (c === '"') { inStr = true; continue }
      if (c === '{') depth++
      else if (c === '}') {
        depth--
        if (depth === 0) { end = j; break }
      }
    }
    if (end < 0) {
      i = start + 1
      continue
    }
    const slice = s.slice(start, end + 1)
    try {
      const obj = JSON.parse(slice)
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) objects.push(obj)
    } catch {}
    i = end + 1
  }
  return objects
}

function asSection(obj, index) {
  if (!obj || typeof obj !== 'object') return null
  if (Array.isArray(obj.sections) || obj.full_script) return null
  const text = String(obj.text || obj.content || obj.narration || '')
  const heading = String(obj.heading || obj.name || '')
  if (!text && !heading && obj.id == null) return null
  if (obj.title && !obj.heading && obj.id == null && !text) return null
  return {
    id: String(obj.id || 's' + (index + 1)),
    heading: heading || String(obj.title || ('Section ' + (index + 1))),
    text,
  }
}

export function normalizeScript(obj) {
  if (!obj || typeof obj !== 'object') return null
  const inner = obj.script && typeof obj.script === 'object' && !Array.isArray(obj.script)
    ? obj.script
    : obj
  let sections = Array.isArray(inner.sections) ? inner.sections : []
  sections = sections
    .map((s, i) => asSection(s, i))
    .filter(Boolean)
  if (!sections.length && String(inner.full_script || '').trim()) {
    return {
      title: inner.title || 'Untitled',
      keywords: inner.keywords,
      aspect: inner.aspect,
      full_script: String(inner.full_script),
      hook: inner.hook || '',
      sections: [],
    }
  }
  if (!sections.length) return null
  return rebuildFullScript({
    title: inner.title || 'Untitled',
    keywords: Array.isArray(inner.keywords) ? inner.keywords : [],
    aspect: inner.aspect,
    sections,
  })
}

function tryParse(text) {
  try { return JSON.parse(text) } catch { return null }
}

export function parseScriptResponse(text) {
  const raw = String(text || '').trim()
  if (!raw) return null
  const stripped = stripFence(raw)
  const attempts = [
    stripped,
    insertMissingCommas(stripped),
    closeOpenStructures(insertMissingCommas(stripped)),
  ]
  for (const candidate of attempts) {
    const parsed = tryParse(candidate)
    const script = normalizeScript(parsed)
    if (script) return script
  }

  const objects = extractCompleteObjects(insertMissingCommas(stripped))
  const root = objects.find((o) => Array.isArray(o.sections) || o.full_script || o.title)
  const fromRoot = normalizeScript(root)
  if (fromRoot) return fromRoot

  const sections = objects.map((o, i) => asSection(o, i)).filter(Boolean)
  if (sections.length) {
    const titleObj = objects.find((o) => o.title && !asSection(o, 0))
    return rebuildFullScript({
      title: titleObj?.title || root?.title || 'Untitled',
      sections,
    })
  }
  return null
}

export function recoverScriptData(data, rawText) {
  const direct = normalizeScript(data)
  if (direct) return direct
  const blobs = [
    rawText,
    data && data.raw,
    data && data.content,
    data && data.output,
    data && data.text,
    data && data.message && String(data.message).trim().startsWith('{') ? data.message : '',
  ]
  for (const blob of blobs) {
    if (typeof blob !== 'string' || !blob.trim()) continue
    const recovered = parseScriptResponse(blob)
    if (recovered) return recovered
  }
  return null
}
