#!/usr/bin/env node
// Delete video and audio files from the clipzo-uploads Supabase bucket, plus the
// upload rows that point at them (so libraries don't show dead entries).
// Keeps everything else: saved projects, images, YouTube connections.
//
//   node scripts/purge-media-uploads.mjs            # dry run: report only
//   node scripts/purge-media-uploads.mjs --delete   # really delete (no undo)
//
// Needs SUPABASE_SERVICE_ROLE_KEY in the environment or in .env.local.
// The key is never printed.

import { readFileSync } from 'node:fs'

const BUCKET = 'clipzo-uploads'
const BASE = (process.env.SUPABASE_URL || 'https://ymtmgpgcmrazqeklixwf.supabase.co').replace(/\/+$/, '')
const DELETE = process.argv.includes('--delete')

function keyFromEnvFile() {
  try {
    const text = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    const m = text.match(/^\s*(?:SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY)\s*=\s*["']?([^"'\s]+)/m)
    return m ? m[1] : ''
  } catch { return '' }
}
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || keyFromEnvFile()
if (!KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY (env or .env.local).')
  process.exit(1)
}
const headers = { apikey: KEY, 'Content-Type': 'application/json' }
if (KEY.startsWith('eyJ')) headers.Authorization = 'Bearer ' + KEY

const MEDIA_EXT = /\.(mp4|mov|m4v|webm|mkv|avi|mp3|wav|m4a|aac|ogg|oga|flac|opus)$/i
function isMedia(name, mime) {
  const m = String(mime || '').toLowerCase()
  return m.startsWith('video/') || m.startsWith('audio/') || MEDIA_EXT.test(String(name || ''))
}

async function call(method, path, body) {
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined })
  const text = await res.text()
  let data
  try { data = JSON.parse(text) } catch { data = text }
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${typeof data === 'string' ? data.slice(0, 200) : JSON.stringify(data).slice(0, 200)}`)
  return data
}

/** Every object in the bucket, walking folders. */
async function listAll(prefix = '') {
  const out = []
  for (let offset = 0; ; offset += 1000) {
    const page = await call('POST', `/storage/v1/object/list/${BUCKET}`, {
      prefix, limit: 1000, offset, sortBy: { column: 'name', order: 'asc' },
    })
    for (const item of page) {
      const path = prefix ? `${prefix}/${item.name}` : item.name
      if (item.id == null && !item.metadata) out.push(...await listAll(path))
      else out.push({ path, size: Number(item.metadata?.size) || 0, mime: item.metadata?.mimetype || '' })
    }
    if (page.length < 1000) break
  }
  return out
}

/** Tables in the public schema that look like the upload records (have original_name). */
async function uploadTables() {
  const spec = await call('GET', '/rest/v1/')
  const defs = spec?.definitions || spec?.components?.schemas || {}
  return Object.entries(defs)
    .filter(([, d]) => d?.properties && 'original_name' in d.properties)
    .map(([name, d]) => ({ name, columns: Object.keys(d.properties) }))
}

async function rowsOf(table) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const res = await fetch(`${BASE}/rest/v1/${table}?select=*`, {
      headers: { ...headers, Range: `${from}-${from + 999}`, 'Range-Unit': 'items' },
    })
    if (!res.ok) throw new Error(`read ${table} → ${res.status}`)
    const page = await res.json()
    rows.push(...page)
    if (page.length < 1000) break
  }
  return rows
}

function mb(bytes) {
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

const objects = await listAll()
const media = objects.filter((o) => isMedia(o.path, o.mime))
const kept = objects.filter((o) => !isMedia(o.path, o.mime))
const sum = (list) => list.reduce((n, o) => n + o.size, 0)

const byType = {}
for (const o of media) {
  const t = (o.mime || o.path.split('.').pop() || 'unknown').toLowerCase()
  byType[t] = byType[t] || { files: 0, bytes: 0 }
  byType[t].files++
  byType[t].bytes += o.size
}

console.log(`Bucket ${BUCKET}: ${objects.length} files, ${mb(sum(objects))}`)
console.log(`  delete (video/audio): ${media.length} files, ${mb(sum(media))}`)
for (const [t, v] of Object.entries(byType).sort((a, b) => b[1].bytes - a[1].bytes)) {
  console.log(`    ${t.padEnd(22)} ${String(v.files).padStart(5)} files  ${mb(v.bytes)}`)
}
console.log(`  keep (projects, images, YouTube, other): ${kept.length} files, ${mb(sum(kept))}`)

// Upload rows that point at a media file: some string column contains its path.
const mediaPaths = media.map((o) => o.path)
const tables = await uploadTables()
const rowPlan = []
for (const t of tables) {
  const idCol = t.columns.includes('id') ? 'id' : null
  if (!idCol) continue
  const rows = await rowsOf(t.name)
  const hit = rows.filter((r) => Object.values(r).some((v) => typeof v === 'string' && v.length > 8 && mediaPaths.some((p) => v.includes(p))))
  rowPlan.push({ table: t.name, idCol, total: rows.length, ids: hit.map((r) => r[idCol]) })
  console.log(`  table ${t.name}: ${rows.length} rows, ${hit.length} point at files being deleted`)
}
if (!tables.length) console.log('  no upload table with original_name found in the public schema (rows left as they are)')

if (!DELETE) {
  console.log('\nDry run only. Nothing was deleted. Re-run with --delete to delete the files and rows above.')
  process.exit(0)
}

let deleted = 0
for (let i = 0; i < mediaPaths.length; i += 100) {
  const batch = mediaPaths.slice(i, i + 100)
  const out = await call('DELETE', `/storage/v1/object/${BUCKET}`, { prefixes: batch })
  deleted += Array.isArray(out) ? out.length : batch.length
  process.stdout.write(`\r  files deleted: ${deleted}/${mediaPaths.length}`)
}
console.log()
for (const plan of rowPlan) {
  let gone = 0
  for (let i = 0; i < plan.ids.length; i += 100) {
    const ids = plan.ids.slice(i, i + 100).map((id) => `"${String(id).replace(/"/g, '')}"`).join(',')
    await call('DELETE', `/rest/v1/${plan.table}?${plan.idCol}=in.(${encodeURIComponent(ids)})`)
    gone += Math.min(100, plan.ids.length - i)
  }
  console.log(`  rows deleted from ${plan.table}: ${gone}`)
}
const left = await listAll()
console.log(`Done. Bucket now: ${left.length} files, ${mb(sum(left))}`)
