import { restoreSession } from '/api.js'
import { getToken } from '/lib/session-store.js'
import {
  youtubeStatus,
  youtubeConnect,
  youtubeDisconnect,
  youtubeSaveSettings,
} from '/lib/youtube-client.js'

const $ = (id) => document.getElementById(id)

function setMsg(text, kind) {
  const el = $('msg')
  if (!el) return
  el.textContent = text || ''
  el.className = 'msg' + (kind === 'err' ? ' err' : kind === 'ok' ? ' ok' : '')
}

function render(st) {
  const on = !!st?.connected
  const state = $('state')
  state.textContent = on ? 'Connected' : (st?.configured === false ? 'Not set up' : 'Not connected')
  state.className = 'state ' + (on ? 'on' : 'off')
  $('off').classList.toggle('hidden', on || st?.configured === false)
  $('on').classList.toggle('hidden', !on)
  $('mcp').textContent = st?.mcpUrl || (location.origin.replace(/\/+$/, '') + '/mcp')
  if (!on) return
  $('title').textContent = st.channel?.title || 'YouTube channel'
  $('cid').textContent = st.channel?.id || ''
  const thumb = $('thumb')
  if (st.channel?.thumb) {
    thumb.src = st.channel.thumb
    thumb.hidden = false
  } else {
    thumb.removeAttribute('src')
    thumb.hidden = true
  }
  $('auto').checked = st.autoUpload !== false
  $('privacy').value = st.privacy || 'unlisted'
}

async function boot() {
  $('mcp').textContent = location.origin.replace(/\/+$/, '') + '/mcp'
  try { await restoreSession() } catch (_) {}
  if (!getToken()) {
    $('gate').hidden = false
    return
  }
  $('panel').hidden = false
  try {
    render(await youtubeStatus())
  } catch (e) {
    setMsg(e.message || 'Could not load YouTube status', 'err')
  }
  const wantConnect = new URLSearchParams(location.search).get('youtube') === 'connect'
  if (wantConnect) {
    history.replaceState(null, '', '/youtube')
    if ($('on')?.classList.contains('hidden')) $('connect')?.click()
  }
}

$('connect')?.addEventListener('click', async () => {
  setMsg('Waiting for Google…')
  try {
    const st = await youtubeConnect('/youtube')
    if (!st) return
    render(st)
    setMsg('Channel connected. New exports can upload automatically.', 'ok')
  } catch (e) {
    setMsg(e.message || 'Could not connect YouTube', 'err')
  }
})

$('disconnect')?.addEventListener('click', async () => {
  try {
    render(await youtubeDisconnect())
    setMsg('YouTube disconnected', 'ok')
  } catch (e) {
    setMsg(e.message || 'Could not disconnect', 'err')
  }
})

async function savePrefs() {
  try {
    render(await youtubeSaveSettings({
      autoUpload: !!$('auto')?.checked,
      privacy: $('privacy')?.value || 'unlisted',
    }))
    setMsg('Saved', 'ok')
  } catch (e) {
    setMsg(e.message || 'Could not save', 'err')
  }
}
$('auto')?.addEventListener('change', savePrefs)
$('privacy')?.addEventListener('change', savePrefs)

$('copy')?.addEventListener('click', async () => {
  const text = $('mcp')?.textContent || ''
  try {
    await navigator.clipboard.writeText(text)
    $('copy-msg').textContent = 'Copied'
    $('copy-msg').className = 'msg ok'
  } catch (_) {
    $('copy-msg').textContent = 'Copy the URL from the box'
    $('copy-msg').className = 'msg err'
  }
})

boot()
