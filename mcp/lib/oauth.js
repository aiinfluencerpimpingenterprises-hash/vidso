import { SignJWT, jwtVerify } from 'jose';
import { randomUUID } from 'node:crypto';
import { api } from './vidso-api.js';
import { SCOPES, signingSecret, absoluteUrl, mcpResourceUrl, PUBLIC_BASE_URL } from './config.js';

function key() {
  return new TextEncoder().encode(signingSecret());
}

export async function signPayload(payload, { expiresIn = '10m' } = {}) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(key());
}

export async function verifyPayload(token) {
  const { payload } = await jwtVerify(token, key());
  return payload;
}

export function isAllowedRedirect(uri) {
  try {
    const u = new URL(uri);
    const host = u.hostname;
    // Claude.ai / Anthropic MCP OAuth callbacks (path may change; host is the signal).
    if (host === 'claude.ai' || host.endsWith('.claude.ai')) return true;
    if (host === 'anthropic.com' || host.endsWith('.anthropic.com')) return true;
    if (host === 'localhost' || host === '127.0.0.1') {
      return u.pathname === '/callback' || u.pathname.endsWith('/callback');
    }
    if (host === 'cursor.com' || host.endsWith('.cursor.sh')) return true;
    return false;
  } catch {
    return false;
  }
}

/** In-memory DCR client store (best-effort on serverless; Claude may also use CIMD). */
const clients = globalThis.__vidsoMcpClients || (globalThis.__vidsoMcpClients = new Map());

export function getClient(clientId) {
  return clients.get(clientId);
}

export function registerClient(meta) {
  const isPublic = meta.token_endpoint_auth_method === 'none';
  const client = {
    ...meta,
    client_id: meta.client_id || randomUUID(),
    client_id_issued_at: Math.floor(Date.now() / 1000),
    scope: meta.scope || SCOPES.join(' '),
  };
  if (!isPublic && !client.client_secret) client.client_secret = randomUUID();
  clients.set(client.client_id, client);
  return client;
}

export function oauthAuthorizationServerMetadata() {
  return {
    issuer: PUBLIC_BASE_URL,
    authorization_endpoint: absoluteUrl('/authorize'),
    token_endpoint: absoluteUrl('/token'),
    registration_endpoint: absoluteUrl('/register'),
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
    scopes_supported: SCOPES,
    // Do NOT advertise CIMD unless we fully implement client_id metadata documents.
    // Advertising it made Claude skip DCR and fail with "Authentication service was unavailable".
    service_documentation: 'https://www.vidso.pro/docs/mcp',
  };
}

export function protectedResourceMetadata() {
  return {
    resource: mcpResourceUrl(),
    authorization_servers: [PUBLIC_BASE_URL],
    scopes_supported: SCOPES,
    bearer_methods_supported: ['header'],
    resource_name: 'Vidso',
  };
}

export async function createLoginSession({ clientId, redirectUri, state, codeChallenge, scopes, resource }) {
  return signPayload(
    {
      typ: 'login',
      clientId,
      redirectUri,
      state: state || null,
      codeChallenge,
      scopes: scopes || SCOPES,
      resource: resource || mcpResourceUrl(),
    },
    { expiresIn: '15m' },
  );
}

export async function completeLogin(sessionToken, email, password) {
  const session = await verifyPayload(sessionToken);
  if (session.typ !== 'login') throw new Error('Invalid login session');

  const data = await api.login(email, password);
  const access = data.session?.access_token || data.access_token;
  const refresh = data.session?.refresh_token || data.refresh_token;
  if (!access) throw new Error('Login succeeded but no access token was returned.');

  const code = await signPayload(
    {
      typ: 'code',
      clientId: session.clientId,
      redirectUri: session.redirectUri,
      codeChallenge: session.codeChallenge,
      scopes: session.scopes,
      resource: session.resource,
      vidsoAccess: access,
      vidsoRefresh: refresh || null,
      email: data.user?.email || email,
    },
    { expiresIn: '5m' },
  );

  const target = new URL(session.redirectUri);
  target.searchParams.set('code', code);
  if (session.state) target.searchParams.set('state', session.state);
  return target.toString();
}

function b64url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

export async function verifyPkce(codeChallenge, codeVerifier) {
  const { createHash } = await import('node:crypto');
  const challenge = b64url(createHash('sha256').update(codeVerifier).digest());
  return challenge === codeChallenge;
}

export async function exchangeAuthorizationCode({ code, clientId, redirectUri, codeVerifier }) {
  const payload = await verifyPayload(code);
  if (payload.typ !== 'code') throw new Error('invalid_grant');
  if (payload.clientId !== clientId) throw new Error('invalid_grant');
  if (payload.redirectUri !== redirectUri) throw new Error('invalid_grant');
  if (!(await verifyPkce(payload.codeChallenge, codeVerifier))) throw new Error('invalid_grant');

  return {
    access_token: payload.vidsoAccess,
    token_type: 'bearer',
    expires_in: 3300,
    refresh_token: payload.vidsoRefresh || undefined,
    scope: (payload.scopes || SCOPES).join(' '),
  };
}

export async function exchangeRefreshToken(refreshToken) {
  const data = await api.refresh(refreshToken);
  const access = data.session?.access_token || data.access_token;
  const nextRefresh = data.session?.refresh_token || data.refresh_token || refreshToken;
  if (!access) throw new Error('invalid_grant');
  return {
    access_token: access,
    token_type: 'bearer',
    expires_in: 3300,
    refresh_token: nextRefresh,
    scope: SCOPES.join(' '),
  };
}

export async function verifyAccessToken(token) {
  const me = await api.me(token);
  return {
    token,
    clientId: 'vidso',
    scopes: SCOPES,
    expiresAt: Math.floor(Date.now() / 1000) + 3300,
    extra: { email: me.email, userId: me.id },
  };
}
