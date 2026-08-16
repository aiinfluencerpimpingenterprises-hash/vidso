import { NextResponse } from 'next/server';
import { registerClient } from '../../lib/oauth.js';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const meta = await req.json();
    // Claude currently registers with token_endpoint_auth_method=client_secret_post.
    // Accept that and also public clients (none).
    const client = registerClient({
      ...meta,
      token_endpoint_auth_method: meta.token_endpoint_auth_method || 'none',
      scope: meta.scope || 'mcp:tools offline_access',
    });
    return NextResponse.json(client, {
      status: 201,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'invalid_client_metadata', error_description: err.message },
      {
        status: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
      },
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
