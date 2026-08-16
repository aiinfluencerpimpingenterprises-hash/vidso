import { NextResponse } from 'next/server';
import { registerClient } from '../../lib/oauth.js';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const meta = await req.json();
    const client = registerClient(meta);
    return NextResponse.json(client, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: 'invalid_client_metadata', error_description: err.message },
      { status: 400 },
    );
  }
}
