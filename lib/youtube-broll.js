// Turn a faceless script into YouTube search queries and a B-roll timeline.
// Search itself stays on the existing Clipzo yt-dlp endpoint; this file is
// the matching + layout logic so it can run locally in tests.

const SKIP_HEADINGS = /^(intro|introduction|hook|outro|conclusion|cta|recap|summary|welcome|teaser|preview)$/i

export function cleanBrollQuery(raw) {
  let s = String(raw || '').replace(/\s+/g, ' ').trim()
  if (!s) return ''
  s = s.replace(/^#+\s*/, '')
  s = s.replace(/^(section|part|chapter)\s+\d+[:.\-–—]\s*/i, '')
  s = s.replace(/^(number\s+)?\d{1,2}([.)]|:|\s[-–—])\s*/i, '')
  s = s.replace(/^[-–—*•]\s*/, '')
  s = s.replace(/["“”']/g, '')
  s = s.replace(/\s+[\-–—|:]\s+(explained|review|facts|secrets?)$/i, '')
  s = s.trim()
  if (s.length > 80) s = s.slice(0, 80).replace(/\s+\S*$/, '').trim()
  if (s.length < 2) return ''
  if (SKIP_HEADINGS.test(s)) return ''
  return s
}

function firstSentence(text) {
  const s = String(text || '').replace(/\s+/g, ' ').trim()
  if (!s) return ''
  const m = s.match(/^[^.!?]+[.!?]?/)
  const cut = (m && m[0].trim()) || s
  return cut.length > 90 ? cut.slice(0, 90).replace(/\s+\S*$/, '').trim() : cut
}

export function brollQueriesFromScript(script = {}, opts = {}) {
  const max = Math.min(18, Math.max(1, Number(opts.max) || 12))
  const sections = Array.isArray(script.sections) ? script.sections : []
  const fromSections = sections
    .map((sec) => cleanBrollQuery(sec.heading || sec.title || firstSentence(sec.text)))
    .filter(Boolean)
  const fromKeywords = (Array.isArray(script.keywords) ? script.keywords : [])
    .map((k) => cleanBrollQuery(k))
    .filter(Boolean)
  const seen = []
  const out = []
  for (const q of fromSections.concat(fromKeywords)) {
    const key = q.toLowerCase()
    if (seen.some((s) => s === key || s.includes(key) || key.includes(s))) continue
    seen.push(key)
    out.push(q)
    if (out.length >= max) return out
  }
  if (out.length) return out
  const topic = cleanBrollQuery(script.topic)
  return topic ? [topic] : []
}

export function introSkipSeconds(videoDuration, segmentSeconds) {
  const dur = Number(videoDuration) || 0
  const need = Math.max(4, Number(segmentSeconds) || 8)
  if (dur <= need + 2) return 0
  const skip = Math.min(20, Math.max(6, Math.round(dur * 0.08)))
  return dur - skip >= need ? skip : 0
}

export function pickYoutubeVideo(videos, { minDuration = 40, usedIds = new Set() } = {}) {
  const list = (videos || []).filter((v) => v && (v.id || v.url) && !usedIds.has(v.id))
  if (!list.length) return null
  const longEnough = list.filter((v) => {
    const d = Number(v.duration) || 0
    return d === 0 || d >= minDuration
  })
  const pool = longEnough.length ? longEnough : list
  pool.sort((a, b) => (Number(b.duration) || 0) - (Number(a.duration) || 0))
  return pool[0] || null
}

export function timelineFromPicks({ duration, picks }) {
  const rows = (picks || []).filter((p) => p && p.clip && p.clip.url)
  const n = Math.max(1, rows.length)
  const dur = Math.max(1, Number(duration) || 0)
  const slice = dur / n
  if (!rows.length) return []
  return rows.map((p, i) => {
    const start = +(i * slice).toFixed(3)
    const end = +(i === n - 1 ? dur : (i + 1) * slice).toFixed(3)
    const segLen = Math.max(0.5, end - start)
    const video = p.video || {}
    const clip = p.clip
    return {
      start,
      end,
      url: clip.url,
      preview: clip.preview || video.thumbnail || null,
      query: p.query || clip.query || '',
      clip_start: introSkipSeconds(video.duration, segLen),
      source: 'youtube',
      youtube_url: video.url || clip.youtube_url || null,
      title: video.title || clip.title || '',
      id: clip.id || (video.id ? 'yt_' + video.id : null),
    }
  })
}

async function mapPool(items, limit, fn) {
  const out = new Array(items.length)
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++
      out[i] = await fn(items[i], i)
    }
  }
  const n = Math.max(1, Math.min(Number(limit) || 2, items.length || 1))
  await Promise.all(Array.from({ length: items.length ? n : 0 }, () => worker()))
  return out
}

export async function assembleYoutubeBroll({
  script,
  duration,
  search,
  mapClip,
  onProgress,
  concurrency = 2,
} = {}) {
  if (typeof search !== 'function' || typeof mapClip !== 'function') {
    throw new Error('YouTube B-roll needs search and mapClip functions')
  }
  const queries = brollQueriesFromScript(script)
  if (!queries.length) return { queries, clips: [], timeline: [], found: 0 }
  const usedIds = new Set()
  const rows = await mapPool(queries, concurrency, async (query, index) => {
    try {
      onProgress?.({ query, index: index + 1, total: queries.length })
      const res = await search(query)
      const videos = Array.isArray(res) ? res : (res && res.videos) || []
      const video = pickYoutubeVideo(videos, { usedIds })
      if (!video) return null
      if (video.id) usedIds.add(video.id)
      return { query, video, clip: mapClip(video, query) }
    } catch (_) {
      return null
    }
  })
  const picks = rows.filter(Boolean)
  return {
    queries,
    clips: picks.map((p) => p.clip).filter((c) => c && c.url),
    timeline: timelineFromPicks({ duration, picks }),
    found: picks.length,
  }
}
