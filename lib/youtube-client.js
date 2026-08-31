/** Browser helpers for YouTube connect + resumable upload. */

import { getToken } from './session-store.js'

const YT_UPLOAD = 'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status'

function apiOrigin() {
  try {
    if (typeof location !== 'undefined' && /^https?:/.test(location.origin)) return location.origin
  } catch (_) {}
  return ''
}

async function ytReq(method, path, body) {
  const origin = apiOrigin()
  if (!origin) throw new Error('YouTube publishing is only available on the live app.')
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
      client.requestAccessToken({ prompt: 'consent' })
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
  privacy = 'unlisted',
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
        title: String(title || 'Vidso video').slice(0, 100),
        description: String(description || 'Uploaded with Vidso').slice(0, 5000),
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
