/** Local static preview with the same pretty routes Vercel uses. */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PORT = Number(process.env.PORT || 8765)
const HOST = process.env.HOST || '127.0.0.1'

const REWRITES = new Map([
  ['/', '/home/index.html'],
  ['/login', '/auth.html'],
  ['/signup', '/auth.html'],
  ['/preview', '/dashboard/index.html'],
  ['/ui', '/dashboard/index.html'],
  ['/dashboard', '/dashboard/index.html'],
  ['/video-generation', '/dashboard/index.html'],
  ['/image-generation', '/dashboard/index.html'],
  ['/files', '/dashboard/index.html'],
  ['/clipping', '/dashboard/index.html'],
  ['/ranking', '/dashboard/index.html'],
  ['/captions', '/dashboard/index.html'],
  ['/voiceover', '/dashboard/index.html'],
  ['/editor', '/dashboard/index.html'],
  ['/reframe', '/dashboard/index.html'],
  ['/downloader', '/dashboard/index.html'],
  ['/commentary', '/dashboard/index.html'],
  ['/tools', '/dashboard/index.html'],
  ['/overview', '/dashboard/index.html'],
  ['/faceless-studio', '/dashboard/index.html'],
  ['/youtube', '/youtube/index.html'],
  ['/connections', '/youtube/index.html'],
  ['/home', '/home/index.html'],
  ['/pricing', '/home/index.html'],
])

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
}

function cleanPath(urlPath) {
  return decodeURIComponent(String(urlPath || '/').split('?')[0]).replace(/\/+$/, '') || '/'
}

function resolveRel(urlPath) {
  const clean = cleanPath(urlPath)
  if (REWRITES.has(clean)) return REWRITES.get(clean)
  if (clean.startsWith('/faceless-studio/')) return '/dashboard/index.html'
  return clean
}

function safeFile(rel) {
  const abs = path.normalize(path.join(ROOT, rel))
  if (!abs.startsWith(ROOT + path.sep) && abs !== ROOT) return null
  return abs
}

const server = http.createServer((req, res) => {
  const rel = resolveRel(req.url)
  let file = safeFile(rel)
  if (!file) {
    res.writeHead(400)
    return res.end()
  }
  try {
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html')
  } catch (_) {}
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      return res.end('Not found')
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' })
    res.end(data)
  })
})

server.listen(PORT, HOST, () => {
  console.log('Preview  http://' + HOST + ':' + PORT + '/login')
})
