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

/** Port-agnostic match for native-app loopback callbacks (RFC 8252). */
function redirectUriMatches(allowed, requested) {
  if (allowed === requested) return true;
  try {
    const a = new URL(allowed);
    const r = new URL(requested);
    const loopback = (h) => h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '::1';
    if (loopback(a.hostname) && loopback(r.hostname) && a.protocol === r.protocol && a.pathname === r.pathname) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function isAllowedRedirect(uri) {
  try {
    const u = new URL(uri);
    const host = u.hostname;
    if (host === 'claude.ai' || host.endsWith('.claude.ai')) return true;
    if (host === 'anthropic.com' || host.endsWith('.anthropic.com')) return true;
    if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]') {
      return u.pathname === '/callback' || u.pathname.endsWith('/callback');
    }
    if (host === 'cursor.com' || host.endsWith('.cursor.sh')) return true;
    return false;
  } catch {
    return false;
  }
}

/** In-memory DCR client store (best-effort on serverless). */
const clients = globalThis.__vidsoMcpClients || (globalThis.__vidsoMcpClients = new Map());
const cimdCache = globalThis.__vidsoCimdCache || (globalThis.__vidsoCimdCache = new Map());

/** Stable public client for Claude Advanced settings (skips DCR/CIMD). */
export const STATIC_CLAUDE_CLIENT = {
  client_id: 'vidso-claude-public',
  client_name: 'Claude',
  redirect_uris: [
    'https://claude.ai/api/mcp/auth_callback',
    'https://claude.ai/api/mcp/auth_callback/',
  ],
  token_endpoint_auth_method: 'none',
  grant_types: ['authorization_code', 'refresh_token'],
  response_types: ['code'],
  scope: SCOPES.join(' '),
};

clients.set(STATIC_CLAUDE_CLIENT.client_id, STATIC_CLAUDE_CLIENT);

export function getClient(clientId) {
  return clients.get(clientId);
}

export function registerClient(meta) {
  const method = meta.token_endpoint_auth_method || 'none';
  const isPublic = method === 'none';
  const client = {
    ...meta,
    token_endpoint_auth_method: method,
    client_id: meta.client_id || randomUUID(),
    client_id_issued_at: Math.floor(Date.now() / 1000),
    // Accept Claude's grant_types subset rather than rejecting extras.
    grant_types: meta.grant_types || ['authorization_code', 'refresh_token'],
    response_types: meta.response_types || ['code'],
    scope: (meta.scope || SCOPES.join(' ')).replace(/^\s+/, '').trim(),
  };
  if (!isPublic && !client.client_secret) client.client_secret = randomUUID();
  if (isPublic) delete client.client_secret;
  clients.set(client.client_id, client);
  return client;
}

function looksLikeHttpsUrl(value) {
  return typeof value === 'string' && /^https:\/\//i.test(value);
}

/**
 * Resolve OAuth client via DCR store, static client, or CIMD (client_id is an HTTPS URL).
 * Spec: https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization#client-id-metadata-documents
 */
export async function resolveClient(clientId, redirectUri) {
  if (!clientId) return null;

  if (clientId === STATIC_CLAUDE_CLIENT.client_id) return STATIC_CLAUDE_CLIENT;

  const local = getClient(clientId);
  if (local) {
    if (redirectUri && local.redirect_uris?.length) {
      const ok =
        local.redirect_uris.some((u) => redirectUriMatches(u, redirectUri)) ||
        isAllowedRedirect(redirectUri);
      if (!ok) throw new Error('invalid_redirect_uri');
    }
    return local;
  }

  if (!looksLikeHttpsUrl(clientId)) {
    // Unknown UUID client (DCR on another isolate) — allow Claude/Anthropic redirects.
    if (redirectUri && isAllowedRedirect(redirectUri)) {
      return {
        client_id: clientId,
        token_endpoint_auth_method: 'none',
        redirect_uris: [redirectUri],
        scope: SCOPES.join(' '),
      };
    }
    return null;
  }

  const cached = cimdCache.get(clientId);
  if (cached && cached.expires > Date.now()) {
    if (redirectUri && !cached.redirect_uris.some((u) => redirectUriMatches(u, redirectUri))) {
      if (!isAllowedRedirect(redirectUri)) throw new Error('invalid_redirect_uri');
    }
    return cached;
  }

  const ctrl = AbortSignal.timeout(8000);
  const res = await fetch(clientId, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    redirect: 'error',
    signal: ctrl,
  });
  if (!res.ok) throw new Error(`cimd_fetch_failed_${res.status}`);
  const doc = await res.json();
  if (doc.client_id !== clientId) throw new Error('cimd_client_id_mismatch');
  if (!Array.isArray(doc.redirect_uris) || !doc.redirect_uris.length) {
    throw new Error('cimd_missing_redirect_uris');
  }
  if (redirectUri && !doc.redirect_uris.some((u) => redirectUriMatches(u, redirectUri))) {
    // Claude may still use auth_callback variants; allow known hosts as soft fallback.
    if (!isAllowedRedirect(redirectUri)) throw new Error('invalid_redirect_uri');
  }

  const client = {
    ...doc,
    token_endpoint_auth_method: doc.token_endpoint_auth_method || 'none',
    scope: (doc.scope || SCOPES.join(' ')).replace(/^\s+/, '').trim(),
    _cimd: true,
  };
  cimdCache.set(clientId, { ...client, expires: Date.now() + 5 * 60 * 1000 });
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
    // "none" is required for Claude CIMD public clients.
    token_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
    scopes_supported: SCOPES,
    client_id_metadata_document_supported: true,
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
