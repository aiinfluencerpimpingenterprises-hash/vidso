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
  ['/studio', '/dashboard/index.html'],
  ['/brand', '/dashboard/index.html'],
  ['/create', '/dashboard/index.html'],
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

// Local only: answer the Manager and Title agent routes so localhost behaves like the
// live app. The fal key comes from FAL_KEY or the git-ignored .env.local.
function localFalKey() {
  if (process.env.FAL_KEY) return process.env.FAL_KEY.trim()
  try {
    const m = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').match(/^FAL_KEY=(.*)$/m)
    return m ? m[1].trim().replace(/^"|"$/g, '') : ''
  } catch (_) { return '' }
}
function readBody(req) {
  return new Promise((resolve) => {
    let raw = ''
    req.on('data', (c) => { raw += c; if (raw.length > 200000) req.destroy() })
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}')) } catch (_) { resolve({}) } })
  })
}
async function localAgentRoute(req, res, sub) {
  const json = (code, body) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)) }
  const falKey = localFalKey()
  if (!falKey) return json(501, { error: 'Set FAL_KEY or add it to .env.local to use the agents locally.' })
  const body = await readBody(req)
  try {
    if (sub === 'manager') {
      const { runManagerAgent } = await import('../lib/manager-agent.js')
      const out = await runManagerAgent({
        message: String(body.message || '').slice(0, 1000),
        context: body.context && typeof body.context === 'object' ? body.context : {},
        history: Array.isArray(body.history) ? body.history.slice(-8) : [],
        captionStyles: Array.isArray(body.caption_styles) ? body.caption_styles.slice(0, 12) : [],
        falKey,
      })
      return json(200, out)
    }
    if (sub === 'scenes' || sub === 'compose') {
      const { runCompose, runScenePlanner } = await import('../lib/scene-agent.js')
      if (sub === 'compose') return json(200, await runCompose({ segments: body.segments, falKey }))
      return json(200, { scenes: await runScenePlanner({ scenes: body.scenes, topic: body.topic, styleName: body.style, character: body.character, falKey }) })
    }
    if (sub === 'channel') {
      const { runChannelAgent } = await import('../lib/channel-agent.js')
      return json(200, await runChannelAgent({ genre: body.genre, about: body.about, niche: body.niche, reference: body.reference, falKey }))
    }
    if (sub === 'reference') {
      const { runReferenceAgent } = await import('../lib/reference-agent.js')
      try { return json(200, await runReferenceAgent({ url: body.url, falKey })) } catch (e) { return json(400, { error: e.message || 'Could not read that channel' }) }
    }
    if (sub === 'publish') {
      const { runPublishAgent } = await import('../lib/publish-agent.js')
      const out = await runPublishAgent({ title: body.title, topic: body.topic, script: String(body.script || '').slice(0, 6000), niche: body.niche, falKey })
      return json(200, out)
    }
    const { runTitleAgent } = await import('../lib/title-agent.js')
    const out = await runTitleAgent({ topic: body.topic, hook: body.hook, script: String(body.script || '').slice(0, 6000), scriptTitle: body.script_title, thumbnailText: body.thumbnail_text, falKey })
    return json(200, out)
  } catch (e) {
    console.error('[local] agent route failed:', e?.message || e)
    return json(502, { error: e.message || 'Agent failed' })
  }
}

// Local only: image and video generation straight through fal (no credits, no login),
// so thumbnails and AI scenes work on localhost. The live app uses /api/generate/*.
async function localGenerate(req, res, sub) {
  const json = (code, body) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)) }
  const falKey = localFalKey()
  if (!falKey) return json(501, { error: 'Set FAL_KEY or add it to .env.local to generate locally.' })
  const body = await readBody(req)
  if (sub === 'image-save') return json(200, { items: [{ storage_url: body.url, url: body.url }] })
  try {
    const video = body.kind === 'video' || body.mode === 'video'
    let built
    if (video) {
      const { falVideoInput } = await import('../lib/fal-video.js')
      built = falVideoInput(body.model, body.prompt, { aspect: body.aspect_ratio || body.aspect, duration: body.duration, resolution: String(body.resolution || '').toLowerCase(), generate_audio: body.generate_audio === true, image_urls: Array.isArray(body.image_urls) ? body.image_urls : (body.image_url ? [body.image_url] : []) })
    } else {
      const { falImageInput } = await import('../lib/fal-image.js')
      built = falImageInput(body.model, body.prompt, { aspect: body.aspect_ratio || body.aspect, num_images: body.num_images, resolution: body.resolution || body.quality, image_urls: body.image_urls })
    }
    const r = await fetch('https://fal.run/' + built.endpoint, { method: 'POST', headers: { Authorization: 'Key ' + falKey, 'Content-Type': 'application/json' }, body: JSON.stringify(built.input) })
    const data = await r.json().catch(() => ({}))
    if (!r.ok) return json(502, { error: data?.detail?.[0]?.msg || data?.detail || data?.error || 'Generation failed' })
    const urls = video ? [data.video?.url || data.video_url].filter(Boolean) : (data.images || []).map((x) => x.url).filter(Boolean)
    if (!urls.length) return json(502, { error: 'Nothing came back' })
    return json(200, { urls, kind: video ? 'video' : 'image', model: body.model })
  } catch (e) {
    console.error('[local] generate failed:', e?.message || e)
    return json(400, { error: e.message || 'Generation failed' })
  }
}

const server = http.createServer((req, res) => {
  const genRoute = req.method === 'POST' && (cleanPath(req.url).match(/^\/api\/generate\/(image|image-save)$/) || [])[1]
  if (genRoute) return localGenerate(req, res, genRoute)
  const agentRoute = req.method === 'POST' && (cleanPath(req.url).match(/^\/api\/youtube\/(manager|titles|publish|scenes|compose|channel|reference)$/) || [])[1]
  if (agentRoute) return localAgentRoute(req, res, agentRoute)
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
  console.log('Preview  http://' + HOST + ':' + PORT + (NO_AUTH ? '/create (no login)' : '/login'))
})
