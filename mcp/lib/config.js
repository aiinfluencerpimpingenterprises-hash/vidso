const PORT = Number(process.env.PORT || 8787);

function vercelUrl() {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://127.0.0.1:${PORT}`;
}

/** Public HTTPS origin of THIS MCP deployment (no trailing slash). */
export const PUBLIC_BASE_URL = vercelUrl().replace(/\/$/, '');

/** Existing Vidso HTTP API (video pipeline). Override if you migrate the API host. */
export const VIDSO_API_BASE = (
  process.env.VIDSO_API_BASE || 'https://vibrant-patience-production-a7f0.up.railway.app'
).replace(/\/$/, '');

export const DASHBOARD_URL = (process.env.DASHBOARD_URL || 'https://www.vidso.pro/dashboard').replace(/\/$/, '');

export const MCP_PATH = '/mcp';
export const SCOPES = ['mcp:tools', 'offline_access'];

/** HMAC secret for signed OAuth codes / login sessions (stateless, Vercel-safe). */
export function signingSecret() {
  const s = process.env.OAUTH_SIGNING_SECRET || process.env.MCP_SIGNING_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === 'production' && process.env.VERCEL) {
    return process.env.VERCEL_DEPLOYMENT_ID || 'vidso-mcp-dev-secret-change-me';
  }
  return 'vidso-mcp-dev-secret-change-me';
}

export function mcpResourceUrl() {
  return `${PUBLIC_BASE_URL}${MCP_PATH}`;
}

export function absoluteUrl(path) {
  return new URL(path, PUBLIC_BASE_URL + '/').href;
}
