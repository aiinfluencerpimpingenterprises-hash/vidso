import { NextResponse } from 'next/server';
import {
  createLoginSession,
  getClient,
  isAllowedRedirect,
  oauthAuthorizationServerMetadata,
} from '../../lib/oauth.js';
import { SCOPES, absoluteUrl } from '../../lib/config.js';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const url = new URL(req.url);
  const clientId = url.searchParams.get('client_id');
  const redirectUri = url.searchParams.get('redirect_uri');
  const responseType = url.searchParams.get('response_type');
  const state = url.searchParams.get('state') || undefined;
  const scope = url.searchParams.get('scope') || SCOPES.join(' ');
  const codeChallenge = url.searchParams.get('code_challenge');
  const codeChallengeMethod = url.searchParams.get('code_challenge_method');
  const resource = url.searchParams.get('resource') || undefined;

  const fail = (error, description) => {
    if (redirectUri && isAllowedRedirect(redirectUri)) {
      const target = new URL(redirectUri);
      target.searchParams.set('error', error);
      if (description) target.searchParams.set('error_description', description);
      if (state) target.searchParams.set('state', state);
      return NextResponse.redirect(target.toString());
    }
    return NextResponse.json({ error, error_description: description }, { status: 400 });
  };

  if (responseType !== 'code') return fail('unsupported_response_type', 'Only response_type=code is supported');
  if (!clientId || !redirectUri || !codeChallenge) return fail('invalid_request', 'Missing required parameters');
  if (codeChallengeMethod && codeChallengeMethod !== 'S256') {
    return fail('invalid_request', 'Only S256 PKCE is supported');
  }

  // Soft client check: DCR clients may live on another instance; allow known redirect URIs.
  const client = getClient(clientId);
  if (client?.redirect_uris?.length && !client.redirect_uris.includes(redirectUri) && !isAllowedRedirect(redirectUri)) {
    return fail('invalid_request', 'Unregistered redirect_uri');
  }
  if (!client && !isAllowedRedirect(redirectUri)) {
    return fail('invalid_request', 'Unregistered redirect_uri');
  }

  const requestedScopes = scope.split(/\s+/).filter(Boolean);
  const allowed = new Set((client?.scope || SCOPES.join(' ')).split(/\s+/));
  for (const s of requestedScopes) {
    if (!allowed.has(s)) return fail('invalid_scope', `Client was not registered with scope ${s}`);
  }

  const session = await createLoginSession({
    clientId,
    redirectUri,
    state,
    codeChallenge,
    scopes: requestedScopes,
    resource,
  });

  return NextResponse.redirect(absoluteUrl(`/oauth/login?session=${encodeURIComponent(session)}`));
}
