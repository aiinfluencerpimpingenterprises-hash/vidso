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
  ['/agents', '/dashboard/index.html'],
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
  ['/youtube', '/dashboard/index.html'],
  ['/connections', '/dashboard/index.html'],
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

// Local only: open the app without signing in by switching on the dashboard's built-in
// UI preview mode (the same flag /preview sets). A real session still wins when you
// are signed in. Set LOCAL_AUTH=1 to get the normal login gate back.
const NO_AUTH = process.env.LOCAL_AUTH !== '1'
const NO_AUTH_TAG = "<script>try{localStorage.getItem('clipzo_token')||localStorage.setItem('vidso_ui_preview','1')}catch(e){}</script>"

function withNoAuth(file, data) {
  if (!NO_AUTH || path.extname(file) !== '.html') return data
  const html = data.toString('utf8')
  const at = html.search(/<head[^>]*>/i)
  if (at < 0) return NO_AUTH_TAG + html
  const end = html.indexOf('>', at) + 1
  return html.slice(0, end) + NO_AUTH_TAG + html.slice(end)
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
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    })
    res.end(withNoAuth(file, data))
  })
})

server.listen(PORT, HOST, () => {
  console.log('Preview  http://' + HOST + ':' + PORT + (NO_AUTH ? '/video-generation (no login)' : '/login'))
})
