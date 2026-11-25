/** Browser helpers for YouTube connect + resumable upload. */

import { getToken } from './session-store.js'

const YT_UPLOAD = 'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status'

function apiOrigin() {
  try {
    if (typeof location !== 'undefined' && /^https?:/.test(location.origin)) return location.origin
  } catch (_) {}
  return ''
}

async function ytReq(method, path, body, retried = false) {
  const origin = apiOrigin()
  if (!origin) throw new Error('YouTube publishing is only available on the live app.')
  // An hour-old access token would 401 here; refresh first (and once more after a 401).
  try { if (typeof window !== 'undefined') await window._ensureFreshToken?.() } catch (_) {}
  const token = getToken()
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = 'Bearer ' + token
  const res = await fetch(origin + path, {
    method,
    headers,
    credentials: 'same-origin',
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (res.status === 401 && !retried && typeof window !== 'undefined' && window._refreshSession) {
    let ok = false
    try { ok = await window._refreshSession() } catch (_) {}
    if (ok) return ytReq(method, path, body, true)
  }
  if (!res.ok) {
    const err = new Error(data.message || data.error || 'YouTube request failed')
    err.status = res.status
    err.code = data.code
    throw err
  }
  return data
}

export async function youtubeStatus() {
  return ytReq('GET', '/api/youtube/status')
}

function loadGoogleOauth2() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('YouTube connect only works in the browser')
  }
  if (window.google?.accounts?.oauth2) return Promise.resolve(window.google.accounts.oauth2)
  return new Promise((resolve, reject) => {
    const done = () => {
      if (window.google?.accounts?.oauth2) resolve(window.google.accounts.oauth2)
      else reject(new Error('Google sign-in failed to load'))
    }
    const existing = document.querySelector('script[data-vidso-gis]')
    if (existing) {
      if (existing.getAttribute('data-ready') === '1') return done()
      existing.addEventListener('load', done, { once: true })
      existing.addEventListener('error', () => reject(new Error('Could not load Google sign-in')), { once: true })
      return
    }
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.dataset.vidsoGis = '1'
    s.onload = () => {
      s.dataset.ready = '1'
      done()
    }
    s.onerror = () => reject(new Error('Could not load Google sign-in'))
    document.head.appendChild(s)
  })
}

export async function youtubeConnect(returnTo) {
  try { sessionStorage.setItem('vidso_yt_oauth', '1') } catch (_) {}
  try {
    const data = await ytReq('POST', '/api/youtube/connect', { returnTo: returnTo || location.pathname })
    if (data.url && data.mode !== 'gis') {
      location.href = data.url
      return null
    }
    const oauth2 = await loadGoogleOauth2()
    const clientId = data.clientId || '715298595148-v01b90t5fvsjeqsbcvme9u69318a89gj.apps.googleusercontent.com'
    const scope = data.scopes || 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube'
    return await new Promise((resolve, reject) => {
      const client = oauth2.initTokenClient({
        client_id: clientId,
        scope,
        include_granted_scopes: true,
        callback: (resp) => {
          if (resp.error) {
            reject(new Error(resp.error_description || resp.error || 'Google denied YouTube access'))
            return
          }
          if (!resp.access_token) {
            reject(new Error('Google did not return YouTube access'))
            return
          }
          youtubeImportProvider({
            accessToken: resp.access_token,
            refreshToken: resp.refresh_token || '',
            expiresIn: resp.expires_in,
          }).then(resolve).catch(reject)
        },
        error_callback: (err) => {
          reject(new Error(err?.message || 'Google sign-in was closed'))
        },
      })
      client.requestAccessToken({ prompt: 'select_account consent' })
    })
  } catch (e) {
    try { sessionStorage.removeItem('vidso_yt_oauth') } catch (_) {}
    throw e
  }
}

export async function youtubeImportProvider({ accessToken, refreshToken, expiresIn }) {
  return ytReq('POST', '/api/youtube/import', {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: expiresIn,
  })
}

export async function youtubeDisconnect() {
  return ytReq('POST', '/api/youtube/disconnect', {})
}

export async function youtubeSaveSettings({ autoUpload, privacy }) {
  return ytReq('POST', '/api/youtube/settings', { autoUpload, privacy })
}

export async function youtubeAccessToken() {
  const data = await ytReq('POST', '/api/youtube/token', {})
  if (!data.accessToken) throw new Error('Could not get a YouTube upload token')
  return data
}

export function mcpConfigJson(mcpUrl, token) {
  return JSON.stringify({
    mcpServers: {
      'vidso-youtube': {
        url: mcpUrl || (apiOrigin() + '/mcp'),
        headers: {
          Authorization: 'Bearer ' + (token || 'PASTE_VIDSO_TOKEN'),
          Accept: 'application/json, text/event-stream',
        },
      },
    },
  }, null, 2)
}

/** Claude Desktop only launches stdio servers from claude_desktop_config.json. */
export function claudeDesktopMcpConfigJson(mcpUrl, token) {
  const url = mcpUrl || (apiOrigin() + '/mcp')
  return JSON.stringify({
    mcpServers: {
      'vidso-youtube': {
        command: 'npx',
        args: ['-y', 'mcp-remote', url, '--header', 'Authorization:${VIDSO_AUTH}'],
        env: {
          VIDSO_AUTH: 'Bearer ' + (token || 'PASTE_VIDSO_TOKEN'),
        },
      },
    },
  }, null, 2)
}

/** Claude Code / `.mcp.json` remote HTTP. */
export function claudeCodeMcpConfigJson(mcpUrl, token) {
  return JSON.stringify({
    mcpServers: {
      'vidso-youtube': {
        type: 'http',
        url: mcpUrl || (apiOrigin() + '/mcp'),
        headers: {
          Authorization: 'Bearer ' + (token || 'PASTE_VIDSO_TOKEN'),
        },
      },
    },
  }, null, 2)
}

function xhrPut(url, { headers, body, onProgress }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    Object.entries(headers || {}).forEach(([k, v]) => xhr.setRequestHeader(k, v))
    xhr.responseType = 'json'
    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable || !onProgress) return
      onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      const data = xhr.response || {}
      if (xhr.status >= 200 && xhr.status < 300 && data.id) {
        resolve({
          videoId: data.id,
          url: 'https://www.youtube.com/watch?v=' + data.id,
          studioUrl: 'https://studio.youtube.com/video/' + data.id + '/edit',
          title: data.snippet?.title || '',
          privacy: data.status?.privacyStatus || '',
        })
        return
      }
      const msg = data.error?.message || data.message || ('YouTube upload failed (' + xhr.status + ')')
      reject(new Error(msg))
    }
    xhr.onerror = () => reject(new Error('Could not reach YouTube. Try again, or upload from a desktop browser.'))
    xhr.send(body)
  })
}

export async function uploadBlobToYoutube({
  accessToken,
  blob,
  title,
  description,
  privacy = 'public',
  tags = ['vidso'],
  onProgress,
}) {
  if (!blob) throw new Error('Missing video file')
  const mime = blob.type || 'video/mp4'
  const start = await fetch(YT_UPLOAD, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + accessToken,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': mime,
      'X-Upload-Content-Length': String(blob.size),
    },
    body: JSON.stringify({
      snippet: {
        title: String(title || 'TubeOps video').slice(0, 100),
        description: String(description || 'Uploaded with TubeOps').slice(0, 5000),
        tags: Array.isArray(tags) ? tags.slice(0, 15) : ['vidso'],
        categoryId: '22',
      },
      status: {
        privacyStatus: privacy,
        selfDeclaredMadeForKids: false,
      },
    }),
  })
  const startData = await start.json().catch(() => ({}))
  if (!start.ok) {
    throw new Error(startData.error?.message || startData.error_description || 'Could not start YouTube upload')
  }
  const location = start.headers.get('Location') || start.headers.get('location')
  if (!location) throw new Error('YouTube did not return an upload URL')
  onProgress?.(2)
  return xhrPut(location, {
    headers: {
      Authorization: 'Bearer ' + accessToken,
      'Content-Type': mime,
    },
    body: blob,
    onProgress,
  })
}

export async function uploadViaServer({ renderJobId, videoUrl, title, description, privacy, tags }) {
  return ytReq('POST', '/api/youtube/upload', {
    renderJobId,
    videoUrl,
    title,
    description,
    privacy,
    tags,
  })
}

/** Title agent: ranked title options for a video. Resolves null when the route
 *  is not available (local static preview) so callers keep the script's title. */
export async function suggestTitles({ topic, hook, script, scriptTitle, thumbnailText } = {}) {
  try {
    return await ytReq('POST', '/api/youtube/titles', {
      topic,
      hook,
      script,
      script_title: scriptTitle,
      thumbnail_text: thumbnailText,
    })
  } catch (e) {
    if (e.status === 404 || e.status === 405 || e.status === 501 || !e.status) return null
    throw e
  }
}

/** Manager agent: Claude decides what the crew does with a chat message.
 *  Resolves null when the route isn't available (local static server) so the
 *  chat falls back to its keyword router. */
export async function askManager({ message, context, history, captionStyles } = {}) {
  try {
    return await ytReq('POST', '/api/youtube/manager', { message, context, history, caption_styles: captionStyles })
  } catch (e) {
    return null
  }
}

/** Publish agent: YouTube description and tags. Resolves null when unavailable. */
export async function publishMeta({ title, topic, script, niche } = {}) {
  try {
    return await ytReq('POST', '/api/youtube/publish', { title, topic, script, niche })
  } catch (e) {
    return null
  }
}

/** Channel setup: a channel name and first-episode topics. Resolves null on failure. */
export async function setupChannel({ genre, about, niche, reference } = {}) {
  try {
    return await ytReq('POST', '/api/youtube/channel', { genre, about, niche, reference })
  } catch (e) {
    return null
  }
}

/** Read a reference YouTube channel. Throws with a readable message on failure. */
export async function readReference(url) {
  return ytReq('POST', '/api/youtube/reference', { url })
}

/** AI scenes: scene descriptions, and joining stills into a clip. Throw on failure. */
export async function planSceneVisuals({ scenes, topic, style, character } = {}) {
  return ytReq('POST', '/api/youtube/scenes', { scenes, topic, style, character })
}
/** Join stills into one clip: start the job, then check on it until fal is done (up to ~8 min). */
export async function composeScenes(segments) {
  const job = await ytReq('POST', '/api/youtube/compose', { segments })
  if (job?.url) return job
  if (!job?.id) throw new Error('Could not start joining the scenes')
  const until = Date.now() + 8 * 60 * 1000
  let wait = 1500
  let fails = 0
  let state = 'IN_QUEUE'
  while (Date.now() < until) {
    await new Promise((r) => setTimeout(r, wait + Math.min(6000, fails * 2000)))
    wait = Math.min(4000, wait + 500)
    let out
    try { out = await ytReq('POST', '/api/youtube/compose', { id: job.id, ms: job.ms }) } catch (e) {
      if (e.status && e.status < 500) throw e // a real failure (422 from fal): show it now
      // A dropped check: try again, but don't spin to the deadline on a server that keeps failing.
      if (++fails >= 6) throw e
      continue
    }
    fails = 0
    if (out?.url) return out
    if (out?.status) state = out.status
  }
  throw new Error(state === 'IN_QUEUE'
    ? 'The scene joiner is busy and never started this job. Try Export again in a minute.'
    : 'Joining the scenes took too long. Try Export again.')
}
