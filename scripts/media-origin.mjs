#!/usr/bin/env node
// Point the site's media at a CDN (Cloudflare R2), or back at Vercel.
//
//   node scripts/media-origin.mjs https://pub-xxxx.r2.dev/tubeops   # serve media from there (a folder is fine)
//   node scripts/media-origin.mjs --local                     # serve /home/img and /home/vid from Vercel again
//
// Under that address the bucket holds three folders, uploaded as they are from the Desktop
// (see BUCKET_FOLDERS), plus the old R2-only files (proof1.png, trustedcreators1.png, ...).
// The current origin is kept in scripts/media-origin.json so the script can be run again to move it.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const stateFile = new URL('./media-origin.json', import.meta.url)

// Files that load /home/img, /home/vid or the old R2 bucket.
export const MEDIA_FILES = [
  'auth.html',
  'brand.js',
  'dashboard/index.html',
  'home/index.html',
  'lib/agents-chat.js',
  'lib/brand-assets.js',
  'lib/brand-studio.js',
  'lib/channel-creator.js',
  'lib/image-gen.js',
  'lib/landing-integrations.js',
  'lib/results.js',
  'lib/tools-gallery.js',
  'lib/visual-styles.js',
  'topo-bg.js',
  'youtube/index.html',
]

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Site path -> bucket path. Most specific first: styles sit inside /home/img/.
export const BUCKET_FOLDERS = [
  ['/home/img/styles/', '/styles/'],
  ['/home/vidso-hero-poster.jpg', '/img/vidso-hero-poster.jpg'],
  ['/home/img/', '/img/'],
  ['/home/vid/', '/vid/'],
]

// Where a site media path loads from: itself on this site, or its bucket folder on the CDN.
export function mediaUrl(sitePath, origin = '') {
  if (!origin) return sitePath
  const hit = BUCKET_FOLDERS.find(([site]) => sitePath.startsWith(site))
  return hit ? origin + hit[1] + sitePath.slice(hit[0].length) : sitePath
}

export function readState() {
  try { return JSON.parse(readFileSync(stateFile, 'utf8')) } catch { return {} }
}

export function normalizeOrigin(raw) {
  const u = new URL(String(raw).trim())
  if (u.protocol !== 'https:' && u.hostname !== 'localhost' && u.hostname !== '127.0.0.1') throw new Error('Use an https:// address')
  return (u.origin + u.pathname).replace(/\/+$/, '')
}

// Rewrite one file's text from the current origin to the next one ('' = this site).
export function rewrite(text, { from = '', to = '', legacyFrom, legacyTo }) {
  let out = text
  // Back to site paths first ("https://cdn/styles/x.jpg" -> "/home/img/styles/x.jpg")...
  if (from) {
    for (const [site, bucket] of BUCKET_FOLDERS) out = out.split(from + bucket).join(site)
  }
  // ...then out to the new CDN. Only paths that start a string or url( are touched.
  if (to) {
    for (const [site, bucket] of BUCKET_FOLDERS) {
      out = out.replace(new RegExp('(?<=["\'(`=\\s])' + esc(site), 'g'), to + bucket)
    }
  }
  // Files that only ever lived on R2 have no copy here, so they follow the CDN but never go "local".
  if (legacyFrom && legacyTo && legacyFrom !== legacyTo) {
    out = out.split(legacyFrom + '/').join(legacyTo + '/')
    out = out.split(legacyFrom + "'").join(legacyTo + "'")
  }
  return out
}

async function main() {
  const arg = process.argv[2]
  if (!arg) {
    console.log('Usage: node scripts/media-origin.mjs <https://cdn-address> | --local')
    process.exit(1)
  }
  const state = readState()
  const from = state.origin || ''
  const legacyFrom = state.legacy || 'https://pub-f40c956471ff49feab622906892ec527.r2.dev'
  const to = arg === '--local' ? '' : normalizeOrigin(arg)
  const legacyTo = to || legacyFrom
  let changed = 0
  for (const f of MEDIA_FILES) {
    const path = root + f
    const before = readFileSync(path, 'utf8')
    const after = rewrite(before, { from, to, legacyFrom, legacyTo })
    if (after !== before) { writeFileSync(path, after); changed++; console.log('updated', f) }
  }
  writeFileSync(stateFile, JSON.stringify({ origin: to, legacy: legacyTo }, null, 2) + '\n')
  console.log(`${changed} files now load media from ${to || 'this site'}`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()
