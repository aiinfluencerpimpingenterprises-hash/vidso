import { NextResponse } from 'next/server';
import { oauthAuthorizationServerMetadata } from '../../../lib/oauth.js';

export const dynamic = 'force-dynamic';

/** OpenID Connect Discovery alias — Claude falls back here if RFC 8414 404s. */
export function GET() {
  return NextResponse.json(oauthAuthorizationServerMetadata(), {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    },
  });
}

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
