import { randomUUID, createHash } from 'node:crypto';
import express from 'express';
import { mcpAuthRouter } from '@modelcontextprotocol/sdk/server/auth/router.js';
import { InvalidRequestError } from '@modelcontextprotocol/sdk/server/auth/errors.js';
import { api, VidsoApiError } from './vidso-api.js';
import { SCOPES } from './config.js';

class MemoryClientsStore {
  constructor() {
    this.clients = new Map();
  }
  async getClient(clientId) {
    return this.clients.get(clientId);
  }
  async registerClient(clientMetadata) {
    const isPublic = clientMetadata.token_endpoint_auth_method === 'none';
    const client = {
      ...clientMetadata,
      client_id: clientMetadata.client_id || randomUUID(),
      client_id_issued_at: Math.floor(Date.now() / 1000),
      // Ensure Claude/Cursor can request our tool scopes even if DCR omits scope.
      scope: clientMetadata.scope || SCOPES.join(' '),
    };
    if (!isPublic && !client.client_secret) {
      client.client_secret = randomUUID();
    }
    this.clients.set(client.client_id, client);
    return client;
  }
}

function isAllowedRedirect(uri) {
  try {
    const u = new URL(uri);
    if (u.href === 'https://claude.ai/api/mcp/auth_callback') return true;
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
      // Claude Code loopback: port-agnostic path /callback
      return u.pathname === '/callback' || u.pathname.endsWith('/callback');
    }
    if (u.hostname === 'cursor.com' || u.hostname.endsWith('.cursor.sh')) return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * OAuth provider that authenticates users against the Vidso API and returns
 * Vidso JWTs as MCP access tokens (so tool calls can hit Railway directly).
 */
export class VidsoOAuthProvider {
  constructor() {
    this.clientsStore = new MemoryClientsStore();
    this.codes = new Map();
    this.sessions = new Map(); // pending authorize UI sessions
    this.tokens = new Map(); // access_token -> { refresh, clientId, scopes, expiresAt, email }
  }

  async authorize(client, params, res) {
    if (!client.redirect_uris?.includes(params.redirectUri) && !isAllowedRedirect(params.redirectUri)) {
      // Still allow Claude callback if registered loosely
      if (!isAllowedRedirect(params.redirectUri)) {
        throw new InvalidRequestError('Unregistered redirect_uri');
      }
    }

    const sessionId = randomUUID();
    this.sessions.set(sessionId, {
      client,
      params,
      createdAt: Date.now(),
    });

    const url = new URL('/oauth/login', `${res.req.protocol}://${res.req.get('host')}`);
    url.searchParams.set('session', sessionId);
    if (params.state) url.searchParams.set('state', params.state);
    res.redirect(url.toString());
  }

  async completeLogin(sessionId, email, password) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Login session expired. Start the connector again.');

    const data = await api.login(email, password);
    const access = data.session?.access_token || data.access_token;
    const refresh = data.session?.refresh_token || data.refresh_token;
    if (!access) throw new Error('Login succeeded but no access token was returned.');

    const code = randomUUID();
    this.codes.set(code, {
      client: session.client,
      params: session.params,
      vidsoAccess: access,
      vidsoRefresh: refresh,
      email: data.user?.email || email,
      createdAt: Date.now(),
    });
    this.sessions.delete(sessionId);

    const target = new URL(session.params.redirectUri);
    target.searchParams.set('code', code);
    if (session.params.state) target.searchParams.set('state', session.params.state);
    return target.toString();
  }

  async challengeForAuthorizationCode(_client, authorizationCode) {
    const codeData = this.codes.get(authorizationCode);
    if (!codeData) throw new Error('Invalid authorization code');
    return codeData.params.codeChallenge;
  }

  async exchangeAuthorizationCode(client, authorizationCode) {
    const codeData = this.codes.get(authorizationCode);
    if (!codeData) throw new Error('Invalid authorization code');
    if (codeData.client.client_id !== client.client_id) {
      throw new Error('Authorization code was not issued to this client');
    }
    this.codes.delete(authorizationCode);

    const accessToken = codeData.vidsoAccess;
    const refreshToken = codeData.vidsoRefresh || randomUUID();
    const expiresAt = Date.now() + 55 * 60 * 1000;

    this.tokens.set(accessToken, {
      clientId: client.client_id,
      scopes: codeData.params.scopes || SCOPES,
      expiresAt,
      refreshToken,
      email: codeData.email,
      type: 'access',
    });
    if (refreshToken) {
      this.tokens.set(refreshToken, {
        clientId: client.client_id,
        scopes: codeData.params.scopes || SCOPES,
        accessToken,
        email: codeData.email,
        type: 'refresh',
      });
    }

    return {
      access_token: accessToken,
      token_type: 'bearer',
      expires_in: 3300,
      refresh_token: refreshToken,
      scope: (codeData.params.scopes || SCOPES).join(' '),
    };
  }

  async exchangeRefreshToken(client, refreshToken, scopes) {
    const stored = this.tokens.get(refreshToken);
    // Prefer upstream Vidso refresh when we have one that looks like a JWT
    try {
      const data = await api.refresh(refreshToken);
      const access = data.session?.access_token || data.access_token;
      const nextRefresh = data.session?.refresh_token || data.refresh_token || refreshToken;
      if (!access) throw new Error('No access token from refresh');

      const expiresAt = Date.now() + 55 * 60 * 1000;
      const scopeList = scopes || stored?.scopes || SCOPES;
      this.tokens.set(access, {
        clientId: client.client_id,
        scopes: scopeList,
        expiresAt,
        refreshToken: nextRefresh,
        email: stored?.email,
        type: 'access',
      });
      this.tokens.set(nextRefresh, {
        clientId: client.client_id,
        scopes: scopeList,
        accessToken: access,
        email: stored?.email,
        type: 'refresh',
      });
      return {
        access_token: access,
        token_type: 'bearer',
        expires_in: 3300,
        refresh_token: nextRefresh,
        scope: scopeList.join(' '),
      };
    } catch (err) {
      const e = new Error(err.message || 'invalid_grant');
      e.errorCode = 'invalid_grant';
      throw e;
    }
  }

  async verifyAccessToken(token) {
    // Fast path: token we issued/cached
    const cached = this.tokens.get(token);
    if (cached?.type === 'access' && cached.expiresAt > Date.now()) {
      return {
        token,
        clientId: cached.clientId || 'vidso',
        scopes: cached.scopes || SCOPES,
        expiresAt: Math.floor(cached.expiresAt / 1000),
        extra: { email: cached.email },
      };
    }

    // Accept raw Vidso JWTs (Claude request-header auth / e2e tests)
    try {
      const me = await api.me(token);
      const expiresAt = Math.floor(Date.now() / 1000) + 3300;
      this.tokens.set(token, {
        clientId: 'vidso-jwt',
        scopes: SCOPES,
        expiresAt: Date.now() + 55 * 60 * 1000,
        email: me.email,
        type: 'access',
      });
      return {
        token,
        clientId: 'vidso-jwt',
        scopes: SCOPES,
        expiresAt,
        extra: { email: me.email, userId: me.id },
      };
    } catch {
      throw new Error('Invalid or expired token');
    }
  }
}

export function mountOAuth(app, { provider, issuerUrl }) {
  app.use(
    mcpAuthRouter({
      provider,
      issuerUrl,
      scopesSupported: SCOPES,
      resourceServerUrl: new URL('/mcp', issuerUrl),
      resourceName: 'Vidso',
    }),
  );

  // Claude prefers public-client auth (`none`) for DCR/CIMD. SDK metadata only
  // advertises client_secret_post; override the discovery document.
  app.get('/.well-known/oauth-authorization-server', (_req, res) => {
    res.json({
      issuer: issuerUrl.href,
      authorization_endpoint: new URL('/authorize', issuerUrl).href,
      token_endpoint: new URL('/token', issuerUrl).href,
      registration_endpoint: new URL('/register', issuerUrl).href,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
      scopes_supported: SCOPES,
      service_documentation: 'https://www.vidso.pro/home#claude-mcp',
    });
  });

  app.get('/oauth/login', (req, res) => {
    const session = req.query.session || '';
    const err = req.query.error || '';
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Connect Vidso</title>
  <style>
    :root{color-scheme:dark;--bg:#0B0B0C;--panel:#121214;--line:rgba(245,245,244,.12);--txt:#F5F5F4;--muted:rgba(245,245,244,.7);--grad:linear-gradient(135deg,#F0606C,#B31D2C)}
    *{box-sizing:border-box} body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);font-family:Inter,system-ui,sans-serif;color:var(--txt)}
    .card{width:min(420px,92vw);background:var(--panel);border:1px solid var(--line);border-radius:20px;padding:28px}
    h1{margin:0 0 8px;font-size:24px;letter-spacing:-.03em} p{margin:0 0 20px;color:var(--muted);font-size:14px;line-height:1.5}
    label{display:block;font-size:12px;color:var(--muted);margin:0 0 6px}
    input{width:100%;padding:12px 14px;border-radius:12px;border:1px solid var(--line);background:#0B0B0C;color:var(--txt);margin-bottom:14px;font:inherit}
    button{width:100%;border:0;border-radius:999px;padding:13px 16px;font:inherit;font-weight:700;color:#fff;background:var(--grad);cursor:pointer}
    .err{color:#F5A0A8;font-size:13px;margin:0 0 12px}
    .note{margin-top:14px;font-size:12px;color:var(--muted)} a{color:#F5A0A8}
  </style>
</head>
<body>
  <form class="card" method="POST" action="/oauth/login">
    <h1>Connect Vidso</h1>
    <p>Sign in with your Vidso account to let Claude generate long-form videos through Vidso.</p>
    ${err ? `<p class="err">${String(err).replace(/[<>&]/g, (c) => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]))}</p>` : ''}
    <input type="hidden" name="session" value="${String(session).replace(/"/g, '')}"/>
    <label for="email">Email</label>
    <input id="email" name="email" type="email" autocomplete="username" required/>
    <label for="password">Password</label>
    <input id="password" name="password" type="password" autocomplete="current-password" required/>
    <button type="submit">Continue</button>
    <p class="note">No account? <a href="https://www.vidso.pro/signup" target="_blank" rel="noopener">Sign up at vidso.pro</a>. Requires an active plan or credits for video generation.</p>
  </form>
</body>
</html>`);
  });

  app.post('/oauth/login', express.urlencoded({ extended: false }), async (req, res) => {
    try {
      const { session, email, password } = req.body || {};
      const redirectTo = await provider.completeLogin(session, email, password);
      res.redirect(redirectTo);
    } catch (err) {
      const msg = encodeURIComponent(err instanceof VidsoApiError ? err.message : err.message || 'Login failed');
      const session = encodeURIComponent(req.body?.session || '');
      res.redirect(`/oauth/login?session=${session}&error=${msg}`);
    }
  });
}

export function fingerprint(token) {
  return createHash('sha256').update(token).digest('hex').slice(0, 12);
}
