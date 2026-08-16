import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import { registerVidsoTools, withVidsoAuth } from '../../lib/tools.js';
import { verifyAccessToken } from '../../lib/oauth.js';
import { SCOPES, PUBLIC_BASE_URL } from '../../lib/config.js';

export const dynamic = 'force-dynamic';

const rawHandler = createMcpHandler(
  (server) => {
    registerVidsoTools(server);
  },
  {
    serverInfo: {
      name: 'vidso',
      version: '1.1.0',
    },
  },
);

async function verifyToken(_req, bearerToken) {
  if (!bearerToken) return undefined;
  try {
    return await verifyAccessToken(bearerToken);
  } catch {
    return undefined;
  }
}

/**
 * Lazy auth: allow initialize + tools/list without a token so Claude can *Add*
 * the connector even when its OAuth broker is flaky. Protected tools/call get 401
 * with WWW-Authenticate so Claude shows the Connect card.
 */
const optionalAuth = withMcpAuth(rawHandler, verifyToken, {
  required: false,
  resourceMetadataPath: '/.well-known/oauth-protected-resource/mcp',
});

function wwwAuthenticate() {
  const meta = `${PUBLIC_BASE_URL}/.well-known/oauth-protected-resource/mcp`;
  return `Bearer error="invalid_token", error_description="Authentication required for this tool", resource_metadata="${meta}", scope="${SCOPES.join(' ')}"`;
}

function callsProtectedTool(body) {
  const messages = Array.isArray(body) ? body : [body];
  for (const msg of messages) {
    if (msg && typeof msg === 'object' && msg.method === 'tools/call') return true;
  }
  return false;
}

async function handler(req) {
  const header = req.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1];

  // Clone body for the protected-tool gate (request body can only be read once).
  let body;
  if (req.method === 'POST') {
    try {
      body = await req.clone().json();
    } catch {
      body = null;
    }
  }

  if (!token && body && callsProtectedTool(body)) {
    return new Response(
      JSON.stringify({
        error: 'invalid_token',
        error_description: 'Authentication required for this tool',
      }),
      {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'WWW-Authenticate': wwwAuthenticate(),
        },
      },
    );
  }

  if (!token) return optionalAuth(req);
  return withVidsoAuth(token, () => optionalAuth(req));
}

export { handler as GET, handler as POST, handler as DELETE };
