/** In-app Connections panel: MCP token + YouTube channel + upload history. */

import {
  mcpConfigJson,
  mcpConnectionStatus,
  mcpConnectorUrl,
  mcpIssueToken,
  mcpRevokeToken,
  youtubeConnect,
  youtubeDisconnect,
  youtubeRetryUpload,
  youtubeStatus,
  youtubeUploads,
} from '/lib/youtube-client.js'
import { CLAUDE_ICON_URL, CLAUDE_CONNECTORS_URL, VIDSO_LOGO_URL, YOUTUBE_LOGO_URL } from '/lib/brand-assets.js'

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]))
}

function fmtTime(iso) {
  if (!iso) return 'Never'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'Unknown'
  return d.toLocaleString()
}

async function copyText(text, liveId) {
  const live = document.getElementById(liveId)
  try {
    await navigator.clipboard.writeText(text)
    if (live) live.textContent = 'Copied to clipboard'
    return true
  } catch (_) {
    if (live) live.textContent = 'Could not copy'
    return false
  }
}

export function connectionsPageHtml() {
  return `
    <div class="conn-page">
      <div class="page-header">
        <h2>Connections</h2>
        <p>MCP and YouTube, read from your account. Nothing on this page is hardcoded.</p>
      </div>
      <p class="sr-only" id="conn-live" aria-live="polite"></p>
      <p class="conn-msg" id="conn-msg" hidden></p>

      <section class="conn-card" aria-labelledby="conn-mcp-title">
        <div class="conn-card-h">
          <h3 id="conn-mcp-title">Claude × Vidso</h3>
          <span class="conn-state" id="conn-mcp-state">Loading</span>
        </div>
        <div class="conn-pair" aria-hidden="true">
          <img src="${esc(CLAUDE_ICON_URL)}" alt="" width="28" height="28">
          <span>×</span>
          <img src="${esc(VIDSO_LOGO_URL)}" alt="" width="28" height="28">
        </div>
        <p class="conn-sub">This is your personal Claude connector URL. Paste it in Claude under Customize → Connectors. Anyone with this URL can call your YouTube MCP tools, so revoke it if it leaks.</p>
        <ol class="conn-steps">
          <li>Copy the connector URL on this page.</li>
          <li>In Claude, open Customize, then Connectors, and paste it.</li>
          <li>Ask Claude to check YouTube or upload a finished video. Revoke here when you are done.</li>
        </ol>
        <label class="copy-field">
          <span class="sr-only">Claude connector URL</span>
          <input id="conn-mcp-url" type="text" readonly value="">
          <button type="button" class="btn btn-ghost btn-sm" id="conn-mcp-copy-url">Copy URL</button>
        </label>
        <div class="conn-actions">
          <a class="btn btn-primary btn-sm" id="conn-mcp-open-claude" href="${esc(CLAUDE_CONNECTORS_URL)}" target="_blank" rel="noopener noreferrer">Open Claude connectors</a>
          <button type="button" class="btn btn-ghost btn-sm" id="conn-mcp-issue">Reissue token</button>
          <button type="button" class="btn btn-ghost btn-sm" id="conn-mcp-revoke">Revoke</button>
        </div>
        <details class="conn-cursor">
          <summary>Cursor JSON config</summary>
          <p class="conn-sub">Cursor can use this JSON with a Bearer header. Claude only needs the URL above.</p>
          <pre class="conn-pre" id="conn-mcp-json" hidden></pre>
          <button type="button" class="btn btn-ghost btn-sm" id="conn-mcp-copy-json" hidden>Copy config</button>
        </details>
        <p class="conn-meta">Last used: <span id="conn-mcp-used">Never</span></p>
      </section>

      <section class="conn-card" aria-labelledby="conn-yt-title">
        <div class="conn-card-h">
          <h3 id="conn-yt-title">YouTube × Vidso</h3>
          <span class="conn-state" id="conn-yt-state">Loading</span>
        </div>
        <div class="conn-pair" aria-hidden="true">
          <img src="${esc(YOUTUBE_LOGO_URL)}" alt="" width="28" height="28">
          <span>×</span>
          <img src="${esc(VIDSO_LOGO_URL)}" alt="" width="28" height="28">
        </div>
        <p class="conn-sub" id="conn-yt-oauth" hidden></p>
        <div id="conn-yt-off">
          <button type="button" class="btn btn-primary btn-sm" id="conn-yt-connect">Connect YouTube</button>
        </div>
        <div id="conn-yt-on" hidden>
          <div class="conn-channel">
            <img id="conn-yt-thumb" alt="" width="40" height="40" hidden>
            <div>
              <div class="conn-channel-t" id="conn-yt-name">YouTube channel</div>
              <div class="conn-channel-id" id="conn-yt-id"></div>
            </div>
          </div>
          <p class="conn-meta" id="conn-yt-quota"></p>
          <p class="conn-sub">One channel per Vidso account. Disconnect revokes the Google token immediately.</p>
          <button type="button" class="btn btn-ghost btn-sm" id="conn-yt-disconnect">Disconnect</button>
        </div>
      </section>

      <section class="conn-card" aria-labelledby="conn-hist-title">
        <h3 id="conn-hist-title">Upload history</h3>
        <div class="conn-table-wrap">
          <table class="conn-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Channel</th>
                <th>Status</th>
                <th>URL</th>
                <th>When</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="conn-hist-body">
              <tr><td colspan="6">Loading…</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>`
}

function setMsg(text, kind) {
  const el = document.getElementById('conn-msg')
  if (!el) return
  if (!text) { el.hidden = true; el.textContent = ''; return }
  el.hidden = false
  el.textContent = text
  el.className = 'conn-msg' + (kind === 'err' ? ' is-err' : kind === 'ok' ? ' is-ok' : '')
}

let skipAutoIssue = false

async function refresh() {
  const token = localStorage.getItem('clipzo_token') || ''
  let yt = {}
  let mcp = {}
  let uploads = []
  try { yt = await youtubeStatus() } catch (e) { setMsg(e.message || 'Could not load YouTube', 'err') }
  try { mcp = yt.mcp && typeof yt.mcp === 'object' ? yt.mcp : await mcpConnectionStatus() } catch (_) {
    try { mcp = await mcpConnectionStatus() } catch (__) {}
  }
  if (!mcp.issued && !skipAutoIssue && token) {
    try { mcp = await mcpIssueToken() } catch (_) {}
  }
  try {
    const data = await youtubeUploads()
    uploads = data.uploads || []
    if (data.quota) yt.quota = data.quota
  } catch (_) {}

  const baseUrl = mcp.mcpUrl || yt.mcpUrl || (location.origin + '/api/mcp')
  const connector = mcp.connectorUrl || mcpConnectorUrl(baseUrl, mcp.token)
  const urlInput = document.getElementById('conn-mcp-url')
  if (urlInput) urlInput.value = connector
  const mcpState = document.getElementById('conn-mcp-state')
  if (mcpState) {
    mcpState.textContent = mcp.issued ? 'Ready for Claude' : 'No connector yet'
    mcpState.classList.toggle('is-on', !!mcp.issued)
  }
  const used = document.getElementById('conn-mcp-used')
  if (used) used.textContent = fmtTime(mcp.lastUsedAt)
  const jsonEl = document.getElementById('conn-mcp-json')
  const copyJson = document.getElementById('conn-mcp-copy-json')
  if (jsonEl && mcp.token) {
    jsonEl.dataset.token = mcp.token
    jsonEl.textContent = mcpConfigJson(baseUrl, mcp.token)
    jsonEl.hidden = false
    if (copyJson) copyJson.hidden = false
  } else if (jsonEl && !mcp.issued) {
    jsonEl.hidden = true
    jsonEl.dataset.token = ''
    jsonEl.textContent = ''
    if (copyJson) copyJson.hidden = true
  }

  const on = !!yt.connected
  const ytState = document.getElementById('conn-yt-state')
  if (ytState) {
    ytState.textContent = on ? 'Connected' : (yt.configured === false ? 'Not set up' : 'Not connected')
    ytState.classList.toggle('is-on', on)
  }
  document.getElementById('conn-yt-off').hidden = on || yt.configured === false
  document.getElementById('conn-yt-on').hidden = !on
  const oauthNote = document.getElementById('conn-yt-oauth')
  if (oauthNote) {
    const show = yt.oauthVerified === false
    oauthNote.hidden = !show
    oauthNote.textContent = show
      ? 'Google has not published this OAuth app for all accounts yet. You may see an unverified-app warning, and only test users can connect until verification is complete.'
      : ''
  }
  if (yt.configured === false) {
    setMsg('YouTube publishing is not configured on this deployment yet.', 'err')
  }
  if (on) {
    document.getElementById('conn-yt-name').textContent = yt.channel?.title || 'YouTube channel'
    document.getElementById('conn-yt-id').textContent = yt.channel?.id || ''
    const thumb = document.getElementById('conn-yt-thumb')
    if (yt.channel?.thumb) { thumb.src = yt.channel.thumb; thumb.hidden = false }
    else { thumb.removeAttribute('src'); thumb.hidden = true }
  }
  const quota = yt.quota || {}
  const qEl = document.getElementById('conn-yt-quota')
  if (qEl) {
    qEl.textContent = quota.dailyCap
      ? `Shared platform cap: about ${quota.dailyCap} uploads/day (YouTube API default). Your published uploads today: ${quota.yourUploadsToday || 0}. Live remaining quota for the whole platform is not readable here. Resets ${quota.resetsAt ? fmtTime(quota.resetsAt) : 'at midnight Pacific Time'}.`
      : 'Quota details load with YouTube status.'
  }

  const body = document.getElementById('conn-hist-body')
  if (!uploads.length) {
    body.innerHTML = '<tr><td colspan="6">No uploads yet.</td></tr>'
  } else {
    body.innerHTML = uploads.map((row) => {
      const retry = row.status === 'failed' || row.status === 'queued'
      const link = row.url
        ? `<a href="${esc(row.url)}" target="_blank" rel="noopener noreferrer">Open</a>`
        : '-'
      return `<tr>
        <td>${esc(row.project || row.title || '-')}</td>
        <td>${esc(row.channelTitle || '-')}</td>
        <td>${esc(row.status)}</td>
        <td>${link}</td>
        <td>${esc(fmtTime(row.updatedAt || row.createdAt))}</td>
        <td>${retry ? `<button type="button" class="btn btn-ghost btn-sm" data-retry="${esc(row.id)}">Retry</button>` : ''}</td>
      </tr>`
    }).join('')
  }
}

function bind() {
  document.getElementById('conn-mcp-copy-url')?.addEventListener('click', () => {
    copyText(document.getElementById('conn-mcp-url')?.value || '', 'conn-live')
  })
  document.getElementById('conn-mcp-copy-json')?.addEventListener('click', () => {
    copyText(document.getElementById('conn-mcp-json')?.textContent || '', 'conn-live')
  })
  document.getElementById('conn-mcp-issue')?.addEventListener('click', async () => {
    skipAutoIssue = false
    setMsg('Issuing connector…')
    try {
      const data = await mcpIssueToken()
      const jsonEl = document.getElementById('conn-mcp-json')
      jsonEl.dataset.token = data.token || ''
      jsonEl.hidden = false
      jsonEl.textContent = mcpConfigJson(data.mcpUrl, data.token)
      document.getElementById('conn-mcp-copy-json').hidden = false
      setMsg('Connector ready. Copy the URL and paste it in Claude.', 'ok')
      await refresh()
    } catch (e) {
      setMsg(e.message || 'Could not issue token', 'err')
    }
  })
  document.getElementById('conn-mcp-revoke')?.addEventListener('click', async () => {
    try {
      skipAutoIssue = true
      await mcpRevokeToken()
      const jsonEl = document.getElementById('conn-mcp-json')
      jsonEl.hidden = true
      jsonEl.dataset.token = ''
      jsonEl.textContent = ''
      document.getElementById('conn-mcp-copy-json').hidden = true
      setMsg('Claude connector revoked. Reissue when you want it back.', 'ok')
      await refresh()
    } catch (e) {
      setMsg(e.message || 'Could not revoke', 'err')
    }
  })
  document.getElementById('conn-yt-connect')?.addEventListener('click', () => {
    youtubeConnect('/connections').catch((e) => setMsg(e.message || 'Could not connect', 'err'))
  })
  document.getElementById('conn-yt-disconnect')?.addEventListener('click', async () => {
    try {
      await youtubeDisconnect()
      setMsg('YouTube disconnected. The Google token was revoked.', 'ok')
      await refresh()
    } catch (e) {
      setMsg(e.message || 'Could not disconnect', 'err')
    }
  })
  document.getElementById('conn-hist-body')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-retry]')
    if (!btn) return
    btn.disabled = true
    try {
      await youtubeRetryUpload(btn.getAttribute('data-retry'))
      setMsg('Retry sent.', 'ok')
      await refresh()
    } catch (e2) {
      setMsg(e2.message || 'Retry failed', 'err')
    } finally {
      btn.disabled = false
    }
  })
}

let bound = false
export function initConnectionsPanel() {
  const root = document.getElementById('panel-connections')
  if (!root) return
  if (!root.dataset.ready) {
    root.innerHTML = connectionsPageHtml()
    root.dataset.ready = '1'
  }
  if (!bound) {
    bind()
    bound = true
  }
  refresh()
}

export function openConnections() {
  window.switchPanel?.('connections', null, { allowLocked: true })
}
