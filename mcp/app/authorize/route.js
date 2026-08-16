import { NextResponse } from 'next/server';
import { createLoginSession, resolveClient, isAllowedRedirect } from '../../lib/oauth.js';
import { SCOPES, absoluteUrl } from '../../lib/config.js';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const url = new URL(req.url);
  const clientId = url.searchParams.get('client_id');
  const redirectUri = url.searchParams.get('redirect_uri');
  const responseType = url.searchParams.get('response_type');
  const state = url.searchParams.get('state') || undefined;
  // Claude has been observed to send a leading space on offline_access.
  const scope = (url.searchParams.get('scope') || SCOPES.join(' ')).replace(/^\s+/, '').trim();
  const codeChallenge = url.searchParams.get('code_challenge');
  const codeChallengeMethod = url.searchParams.get('code_challenge_method');
  const resource = url.searchParams.get('resource') || undefined;

  const fail = (error, description) => {
    if (redirectUri && isAllowedRedirect(redirectUri)) {
      const target = new URL(redirectUri);
      target.searchParams.set('error', error);
      if (description) target.searchParams.set('error_description', description);
      if (state) target.searchParams.set('state', state);
      // 303 so POST→GET does not get preserved on the callback (#109).
      return NextResponse.redirect(target.toString(), 303);
    }
    return NextResponse.json({ error, error_description: description }, { status: 400 });
  };

  if (responseType !== 'code') return fail('unsupported_response_type', 'Only response_type=code is supported');
  if (!clientId || !redirectUri || !codeChallenge) return fail('invalid_request', 'Missing required parameters');
  if (codeChallengeMethod && codeChallengeMethod !== 'S256') {
    return fail('invalid_request', 'Only S256 PKCE is supported');
  }

  let client;
  try {
    client = await resolveClient(clientId, redirectUri);
  } catch (err) {
    return fail('invalid_client', err.message || 'Unable to resolve client');
  }
  if (!client) return fail('invalid_client', 'Unknown client');

  const requestedScopes = scope.split(/\s+/).filter(Boolean);
  const allowed = new Set((client.scope || SCOPES.join(' ')).split(/\s+/).filter(Boolean));
  // Be permissive: accept any requested scope that is in our SCOPES list.
  for (const s of requestedScopes) {
    if (!SCOPES.includes(s) && !allowed.has(s)) {
      return fail('invalid_scope', `Unsupported scope ${s}`);
    }
  }

  const session = await createLoginSession({
    clientId,
    redirectUri,
    state,
    codeChallenge,
    scopes: requestedScopes.length ? requestedScopes : SCOPES,
    resource,
  });

  return NextResponse.redirect(absoluteUrl(`/oauth/login?session=${encodeURIComponent(session)}`), 303);
}
