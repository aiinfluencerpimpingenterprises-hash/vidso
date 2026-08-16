import { NextResponse } from 'next/server';
import { oauthAuthorizationServerMetadata } from '../../../lib/oauth.js';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json(oauthAuthorizationServerMetadata());
}
