import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const port = Number(process.env.PORT) || 5173

const rewrites = new Map([
  ['/', '/dashboard/index.html'],
  ['/home', '/home/index.html'],
  ['/spin', '/spin/index.html'],
  ['/dashboard', '/dashboard/index.html'],
  ['/video-generation', '/dashboard/index.html'],
  ['/youtube-generation', '/dashboard/index.html'],
  ['/connectors', '/dashboard/index.html'],
  ['/login', '/auth.html'],
  ['/signup', '/auth.html'],
  ['/preview', '/dashboard/index.html'],
  ['/ui', '/dashboard/index.html'],
])

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
}

function safeJoin(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0].split('#')[0])
  const mapped = rewrites.get(clean.replace(/\/+$/, '') || '/') || clean
  const resolved = path.resolve(root, '.' + mapped)
  if (!resolved.startsWith(root)) return null
  return resolved
}

const server = http.createServer((req, res) => {
  let file = safeJoin(req.url || '/')
  if (!file) {
    res.writeHead(400)
    res.end('Bad path')
    return
  }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    file = path.join(file, 'index.html')
  }
  if (!fs.existsSync(file)) {
    res.writeHead(404)
    res.end('Not found')
    return
  }
  const ext = path.extname(file).toLowerCase()
  res.writeHead(200, {
    'Content-Type': types[ext] || 'application/octet-stream',
    'Cache-Control': 'no-store',
  })
  fs.createReadStream(file).pipe(res)
})

server.listen(port, '127.0.0.1', () => {
  console.log('Local Vidso: http://127.0.0.1:' + port + '/video-generation')
})
