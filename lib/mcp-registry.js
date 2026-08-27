/** Live MCP tool catalog. Marketing pages must read this, not a hardcoded list. */

import { mcpTools } from './youtube.js'

export function publicMcpTools() {
  return mcpTools().map((t) => ({
    name: t.name,
    description: t.description || '',
  }))
}

export function mcpServerInfo() {
  return {
    name: 'vidso-youtube',
    version: '1.0.0',
    protocolVersion: '2025-03-26',
  }
}

/** Clients we have completed a live session against. Empty until that happens. */
export const VERIFIED_MCP_CLIENTS = []
