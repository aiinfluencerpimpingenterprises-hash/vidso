import { NextResponse } from 'next/server';
import { exchangeAuthorizationCode, exchangeRefreshToken } from '../../lib/oauth.js';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  const contentType = req.headers.get('content-type') || '';
  let body = {};
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const form = await req.formData();
    body = Object.fromEntries(form.entries());
  } else if (contentType.includes('application/json')) {
    body = await req.json().catch(() => ({}));
  } else {
    // Some clients omit content-type; try form first.
    try {
      const form = await req.formData();
      body = Object.fromEntries(form.entries());
    } catch {
      body = {};
    }
  }

  try {
    if (body.grant_type === 'authorization_code') {
      const tokens = await exchangeAuthorizationCode({
        code: body.code,
        clientId: body.client_id,
        redirectUri: body.redirect_uri,
        codeVerifier: body.code_verifier,
      });
      return NextResponse.json(tokens, {
        headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' },
      });
    }
    if (body.grant_type === 'refresh_token') {
      const tokens = await exchangeRefreshToken(body.refresh_token);
      return NextResponse.json(tokens, {
        headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' },
      });
    }
    return NextResponse.json(
      { error: 'unsupported_grant_type' },
      { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } },
    );
  } catch (err) {
    return NextResponse.json(
      { error: 'invalid_grant', error_description: err.message || 'invalid_grant' },
      { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } },
    );
  }
}

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
