import { NextResponse } from 'next/server';
import { protectedResourceMetadata } from '../../../../lib/oauth.js';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json(protectedResourceMetadata(), {
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
