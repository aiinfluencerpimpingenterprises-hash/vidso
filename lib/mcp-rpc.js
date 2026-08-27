import { isYoutubeQuotaError, recordYoutubeUpload, youtubeQuotaResetAt } from './youtube-uploads.js'
import { touchMcpUse } from './mcp-auth.js'
import { mcpServerInfo } from './mcp-registry.js'
import {
  downloadRenderVideo,
  ensureAccessToken,
  loadYoutubeRecord,
  mcpTools,
  publicYoutubeStatus,
  requestOrigin,
  saveYoutubeRecord,
  youtubeConfigured,
  youtubeResumableUpload,
} from './youtube.js'

function send(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

export function rpc(res, id, result) {
  return send(res, 200, { jsonrpc: '2.0', id: id ?? null, result })
}

export function rpcErr(res, id, code, message) {
  return send(res, 200, { jsonrpc: '2.0', id: id ?? null, error: { code, message } })
}

export async function runYoutubeMcpUpload(token, rec, args) {
  const next = await ensureAccessToken(rec)
  if (next.access_token !== rec.access_token) await saveYoutubeRecord(token, next)
  const file = await downloadRenderVideo(token, {
    renderJobId: args.render_job_id || args.renderJobId,
    videoUrl: args.video_url || args.videoUrl,
  })
  return youtubeResumableUpload({
    accessToken: next.access_token,
    buffer: file.buffer,
    mime: file.mime,
    title: args.title,
    description: args.description,
    tags: args.tags,
    privacy: args.privacy || next.privacy,
  })
}

export async function handleMcpBody(req, res, token, body) {
  const id = body?.id ?? null
  const method = String(body?.method || '')
  const info = mcpServerInfo()
  if (method === 'initialize') {
    return rpc(res, id, {
      protocolVersion: info.protocolVersion,
      capabilities: { tools: {} },
      serverInfo: { name: info.name, version: info.version },
    })
  }
  if (method === 'notifications/initialized' || method === 'initialized') {
    res.statusCode = 202
    return res.end()
  }
  if (method === 'ping') return rpc(res, id, {})
  if (method === 'tools/list') return rpc(res, id, { tools: mcpTools() })
  if (method !== 'tools/call') return rpcErr(res, id, -32601, 'Unknown method')

  try { await touchMcpUse(token) } catch (_) {}

  const name = String(body.params?.name || '')
  const args = body.params?.arguments || {}
  try {
    if (name === 'youtube_status') {
      const rec = await loadYoutubeRecord(token).catch(() => null)
      return rpc(res, id, {
        content: [{ type: 'text', text: JSON.stringify(publicYoutubeStatus(rec, req, { configured: youtubeConfigured() }), null, 2) }],
      })
    }
    if (name === 'youtube_connect_url') {
      const origin = requestOrigin(req)
      return rpc(res, id, {
        content: [{
          type: 'text',
          text: 'Open Vidso while logged in and connect YouTube from Connections:\n' + origin + '/connections',
        }],
      })
    }
    if (name === 'youtube_upload') {
      const rec = await loadYoutubeRecord(token).catch(() => null)
      if (!rec?.refresh_token) {
        return rpc(res, id, {
          content: [{ type: 'text', text: 'Connect a YouTube channel in Vidso Connections first.' }],
          isError: true,
        })
      }
      try {
        const result = await runYoutubeMcpUpload(token, rec, args)
        await recordYoutubeUpload(token, {
          project: args.project || args.title || '',
          channel_id: rec.channel_id,
          channel_title: rec.channel_title,
          title: args.title,
          status: 'published',
          url: result.url || '',
          video_url: args.video_url || args.videoUrl,
          description: args.description,
          privacy: args.privacy || rec.privacy,
          tags: args.tags,
        }).catch(() => {})
        return rpc(res, id, {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        })
      } catch (e) {
        const queued = isYoutubeQuotaError(e)
        await recordYoutubeUpload(token, {
          project: args.project || args.title || '',
          channel_id: rec.channel_id,
          channel_title: rec.channel_title,
          title: args.title,
          status: queued ? 'queued' : 'failed',
          error: e.message || 'Upload failed',
          video_url: args.video_url || args.videoUrl,
          description: args.description,
          privacy: args.privacy || rec.privacy,
          tags: args.tags,
          retry_after: queued ? youtubeQuotaResetAt() : null,
        }).catch(() => {})
        return rpc(res, id, {
          content: [{
            type: 'text',
            text: queued
              ? 'YouTube daily quota is full. This upload is queued until the next reset (midnight Pacific Time) and will not be dropped. Retry from Connections after the window opens.'
              : (e.message || 'Upload failed'),
          }],
          isError: true,
        })
      }
    }
    return rpcErr(res, id, -32601, 'Unknown tool')
  } catch (e) {
    return rpc(res, id, {
      content: [{ type: 'text', text: e.message || 'Tool failed' }],
      isError: true,
    })
  }
}
