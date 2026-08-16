import express from 'express';
import cors from 'cors';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import {
  getOAuthProtectedResourceMetadataUrl,
  mcpAuthMetadataRouter,
} from '@modelcontextprotocol/sdk/server/auth/router.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { PORT, PUBLIC_BASE_URL, MCP_PATH, SCOPES, mcpResourceUrl } from './config.js';
import { VidsoOAuthProvider, mountOAuth } from './oauth.js';
import { registerTools } from './tools.js';
import { authStore } from './vidso-api.js';

const app = express();
app.set('trust proxy', true);
app.use(
  cors({
    origin: true,
    credentials: true,
    exposedHeaders: ['Mcp-Session-Id', 'WWW-Authenticate'],
  }),
);
app.use(express.json({ limit: '4mb' }));

const issuerUrl = new URL(PUBLIC_BASE_URL);
const mcpServerUrl = mcpResourceUrl();
const provider = new VidsoOAuthProvider();

mountOAuth(app, { provider, issuerUrl });

app.use(
  mcpAuthMetadataRouter({
    oauthMetadata: {
      issuer: issuerUrl.href.replace(/\/$/, ''),
      authorization_endpoint: new URL('/authorize', issuerUrl).href,
      token_endpoint: new URL('/token', issuerUrl).href,
      registration_endpoint: new URL('/register', issuerUrl).href,
      revocation_endpoint: new URL('/revoke', issuerUrl).href,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic', 'none'],
      scopes_supported: SCOPES,
    },
    resourceServerUrl: mcpServerUrl,
    scopesSupported: SCOPES,
    resourceName: 'Vidso',
  }),
);

const authMiddleware = requireBearerAuth({
  verifier: provider,
  requiredScopes: [],
  resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(mcpServerUrl),
});

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'vidso-mcp',
    mcp: MCP_PATH,
    public_base_url: PUBLIC_BASE_URL,
  });
});

function createServer() {
  const server = new McpServer(
    {
      name: 'vidso',
      version: '1.0.0',
      websiteUrl: 'https://www.vidso.pro/home#claude-mcp',
    },
    { capabilities: { logging: {} } },
  );
  registerTools(server);
  return server;
}

/** @type {Record<string, StreamableHTTPServerTransport>} */
const transports = {};

function withAuthContext(req, handler) {
  const token = req.auth?.token;
  return authStore.run({ token, auth: req.auth }, handler);
}

async function mcpPostHandler(req, res) {
  const sessionId = req.headers['mcp-session-id'];
  try {
    await withAuthContext(req, async () => {
      let transport;
      if (sessionId && transports[sessionId]) {
        transport = transports[sessionId];
      } else if (!sessionId && isInitializeRequest(req.body)) {
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sid) => {
            transports[sid] = transport;
          },
        });
        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid && transports[sid]) delete transports[sid];
        };
        const server = createServer();
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
        return;
      } else {
        res.status(400).json({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Bad Request: No valid session ID provided' },
          id: null,
        });
        return;
      }
      await transport.handleRequest(req, res, req.body);
    });
  } catch (error) {
    console.error('MCP POST error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      });
    }
  }
}

async function mcpGetHandler(req, res) {
  const sessionId = req.headers['mcp-session-id'];
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send('Invalid or missing session ID');
    return;
  }
  await withAuthContext(req, async () => {
    await transports[sessionId].handleRequest(req, res);
  });
}

async function mcpDeleteHandler(req, res) {
  const sessionId = req.headers['mcp-session-id'];
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send('Invalid or missing session ID');
    return;
  }
  await withAuthContext(req, async () => {
    await transports[sessionId].handleRequest(req, res);
  });
}

app.post(MCP_PATH, authMiddleware, mcpPostHandler);
app.get(MCP_PATH, authMiddleware, mcpGetHandler);
app.delete(MCP_PATH, authMiddleware, mcpDeleteHandler);

app.listen(PORT, () => {
  console.log(`Vidso MCP listening on :${PORT}`);
  console.log(`MCP endpoint: ${PUBLIC_BASE_URL}${MCP_PATH}`);
  console.log(`OAuth issuer: ${PUBLIC_BASE_URL}`);
  console.log(`Health: ${PUBLIC_BASE_URL}/health`);
});

process.on('SIGINT', async () => {
  for (const sid of Object.keys(transports)) {
    try {
      await transports[sid].close();
    } catch {
      /* ignore */
    }
    delete transports[sid];
  }
  process.exit(0);
});
