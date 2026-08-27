/** Browser helpers for YouTube connect + resumable upload. */

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
  const token = localStorage.getItem('clipzo_token')
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

export async function youtubeConnect(returnTo) {
  const data = await ytReq('POST', '/api/youtube/connect', { returnTo: returnTo || location.pathname })
  if (!data.url) throw new Error('Could not start YouTube connect')
  location.href = data.url
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
        url: mcpUrl || (apiOrigin() + '/api/youtube/mcp'),
        headers: {
          Authorization: 'Bearer ' + (token || 'PASTE_VIDSO_TOKEN'),
          Accept: 'application/json, text/event-stream',
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
