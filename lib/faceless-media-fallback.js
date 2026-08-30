/**
 * Browser fallback when Railway faceless media fails on long scripts.
 * Clipzo chunks TTS then POSTs /api/media/concat — that route 404s on Railway.
 */

export const TTS_CHUNK_CHARS = 4500

export function isMediaConcatError(err) {
  const msg = typeof err === 'string' ? err : String(err?.message || err?.error || '')
  return /media\/concat|Cannot POST\s+\/api\/media\/concat/i.test(msg)
}

export function narrationNeedsChunking(text, maxChars = TTS_CHUNK_CHARS) {
  return String(text || '').trim().length > Number(maxChars || TTS_CHUNK_CHARS)
}

/** Split narration into TTS-sized chunks at sentence / paragraph boundaries. */
export function chunkNarrationText(text, maxChars = TTS_CHUNK_CHARS) {
  const raw = String(text || '').replace(/\r\n/g, '\n').trim()
  const limit = Math.max(500, Number(maxChars) || TTS_CHUNK_CHARS)
  if (!raw) return []
  if (raw.length <= limit) return [raw]

  const parts = raw.split(/(?<=[.!?])\s+|\n{2,}/)
  const chunks = []
  let buf = ''
  const push = () => {
    const t = buf.trim()
    if (t) chunks.push(t)
    buf = ''
  }
  for (const part of parts) {
    const piece = String(part || '').trim()
    if (!piece) continue
    if (piece.length > limit) {
      push()
      for (let i = 0; i < piece.length; i += limit) {
        chunks.push(piece.slice(i, i + limit).trim())
      }
      continue
    }
    if (!buf) {
      buf = piece
      continue
    }
    if (buf.length + 1 + piece.length <= limit) {
      buf += ' ' + piece
    } else {
      push()
      buf = piece
    }
  }
  push()
  return chunks.filter(Boolean)
}

export function estimateWordsFromText(text, durationSec) {
  const tokens = String(text || '').trim().split(/\s+/).filter(Boolean)
  const dur = Math.max(0.1, Number(durationSec) || tokens.length * 0.35)
  if (!tokens.length) return []
  const step = dur / tokens.length
  return tokens.map((word, i) => ({
    text: word,
    start: +(i * step).toFixed(3),
    end: +((i + 1) * step).toFixed(3),
  }))
}

export function audioBufferToWavBlob(buffer) {
  const numChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const format = 1
  const bitDepth = 16
  const samples = buffer.length
  const blockAlign = numChannels * bitDepth / 8
  const byteRate = sampleRate * blockAlign
  const dataSize = samples * blockAlign
  const ab = new ArrayBuffer(44 + dataSize)
  const view = new DataView(ab)
  const writeStr = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }
  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, format, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitDepth, true)
  writeStr(36, 'data')
  view.setUint32(40, dataSize, true)

  let offset = 44
  const channels = []
  for (let c = 0; c < numChannels; c++) channels.push(buffer.getChannelData(c))
  for (let i = 0; i < samples; i++) {
    for (let c = 0; c < numChannels; c++) {
      let sample = Math.max(-1, Math.min(1, channels[c][i] || 0))
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff
      view.setInt16(offset, sample, true)
      offset += 2
    }
  }
  return new Blob([ab], { type: 'audio/wav' })
}

export async function concatAudioUrls(urls, options = {}) {
  const list = (urls || []).map(String).filter(Boolean)
  if (!list.length) throw new Error('No voiceover chunks to join')
  const AudioCtx = options.AudioCtx
    || (typeof options === 'function' ? options : null)
    || globalThis.AudioContext
    || globalThis.webkitAudioContext
  if (!AudioCtx) throw new Error('This browser cannot join audio chunks')
  const fetchFn = options.fetch || globalThis.fetch.bind(globalThis)
  const headers = options.headers || {}

  const ctx = new AudioCtx()
  try {
    const decoded = []
    for (const url of list) {
      const res = await fetchFn(url, Object.keys(headers).length ? { headers } : undefined)
      if (!res.ok) throw new Error('Could not download a voiceover chunk')
      const ab = await res.arrayBuffer()
      decoded.push(await ctx.decodeAudioData(ab.slice(0)))
    }
    const channels = Math.max(1, ...decoded.map((b) => b.numberOfChannels))
    const sampleRate = decoded[0].sampleRate
    const total = decoded.reduce((n, b) => n + b.length, 0)
    const offline = new OfflineAudioContext(channels, total, sampleRate)
    let at = 0
    for (const buf of decoded) {
      const src = offline.createBufferSource()
      src.buffer = buf
      src.connect(offline.destination)
      src.start(at / sampleRate)
      at += buf.length
    }
    const rendered = await offline.startRendering()
    return {
      blob: audioBufferToWavBlob(rendered),
      duration: rendered.duration,
    }
  } finally {
    try { await ctx.close() } catch (_) {}
  }
}

export function evenTimelineFromClips(clips, durationSec) {
  const list = Array.isArray(clips) ? clips.filter(Boolean) : []
  const dur = Math.max(1, Number(durationSec) || 1)
  if (!list.length) {
    return [{
      id: 'placeholder',
      url: '',
      preview: null,
      query: 'stock',
      start: 0,
      end: dur,
      clip_start: 0,
    }]
  }
  const slice = dur / list.length
  return list.map((clip, i) => ({
    ...clip,
    start: +(i * slice).toFixed(3),
    end: +((i === list.length - 1 ? dur : (i + 1) * slice)).toFixed(3),
    clip_start: 0,
  }))
}
