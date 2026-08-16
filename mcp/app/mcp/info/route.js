import { NextResponse } from 'next/server';
import { MCP_PATH, PUBLIC_BASE_URL, SCOPES } from '../../../lib/config.js';
import { STATIC_CLAUDE_CLIENT } from '../../../lib/oauth.js';

export const dynamic = 'force-dynamic';

/**
 * Handoff-style discovery for clients / docs (Eromify pattern: GET /mcp/info).
 */
export function GET() {
  return NextResponse.json(
    {
      server: { name: 'vidso', title: 'Vidso', version: '1.1.0' },
      transport: 'streamable-http',
      mcp_url: `${PUBLIC_BASE_URL}${MCP_PATH}`,
      auth: {
        type: 'bearer',
        description: 'Authorization: Bearer <vidso_access_token>',
        oauth_client_id_optional: STATIC_CLAUDE_CLIENT.client_id,
        scopes: SCOPES,
      },
      docs: 'https://www.vidso.pro/docs/mcp',
      dashboard: 'https://www.vidso.pro/dashboard',
    },
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      },
    },
  );
}

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers':
        'Authorization, Content-Type, MCP-Protocol-Version, Mcp-Session-Id, Last-Event-ID',
      'Access-Control-Expose-Headers': 'Mcp-Session-Id',
    },
  });
}
