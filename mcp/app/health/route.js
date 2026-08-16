import { NextResponse } from 'next/server';
import { MCP_PATH, PUBLIC_BASE_URL } from '../../lib/config.js';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({
    ok: true,
    service: 'vidso-mcp',
    mcp: MCP_PATH,
    public_base_url: PUBLIC_BASE_URL,
    host: 'vercel',
  });
}
