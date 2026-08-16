const PORT = Number(process.env.PORT || 8787);

/** Public base URL of THIS MCP server (no trailing slash). Used for OAuth metadata. */
export const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || `http://127.0.0.1:${PORT}`).replace(/\/$/, '');

/** Vidso Railway API (existing production backend). */
export const VIDSO_API_BASE = (
  process.env.VIDSO_API_BASE || 'https://vibrant-patience-production-a7f0.up.railway.app'
).replace(/\/$/, '');

/** Dashboard deep-link base for "open in Vidso" hints. */
export const DASHBOARD_URL = (process.env.DASHBOARD_URL || 'https://www.vidso.pro/dashboard').replace(/\/$/, '');

export const MCP_PATH = '/mcp';
export { PORT };

export const SCOPES = ['mcp:tools', 'offline_access'];

export function mcpResourceUrl() {
  return new URL(MCP_PATH, PUBLIC_BASE_URL.endsWith('/') ? PUBLIC_BASE_URL : PUBLIC_BASE_URL + '/');
}
