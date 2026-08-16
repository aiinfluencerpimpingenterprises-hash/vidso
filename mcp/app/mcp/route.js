import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import { registerVidsoTools, withVidsoAuth } from '../../lib/tools.js';
import { verifyAccessToken } from '../../lib/oauth.js';
import { mcpResourceUrl } from '../../lib/config.js';

export const maxDuration = 300;
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

const authed = withMcpAuth(rawHandler, verifyToken, {
  required: true,
  resourceMetadataPath: '/.well-known/oauth-protected-resource/mcp',
});

async function handler(req) {
  // Ensure tool handlers can read the Bearer token via AsyncLocalStorage.
  const header = req.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1];
  if (!token) return authed(req);
  return withVidsoAuth(token, () => authed(req));
}

export { handler as GET, handler as POST, handler as DELETE };
