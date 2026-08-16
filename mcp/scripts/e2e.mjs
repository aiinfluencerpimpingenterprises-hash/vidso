#!/usr/bin/env node
/**
 * End-to-end MCP tool test against a running Vidso MCP server + live Railway API.
 *
 * Usage:
 *   VIDSO_EMAIL=... VIDSO_PASSWORD=... MCP_URL=http://127.0.0.1:8787/mcp node scripts/e2e.mjs
 *   # or
 *   VIDSO_TOKEN=... MCP_URL=http://127.0.0.1:8787/mcp node scripts/e2e.mjs
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const MCP_URL = process.env.MCP_URL || 'http://127.0.0.1:8787/mcp';
const API = process.env.VIDSO_API_BASE || 'https://vibrant-patience-production-a7f0.up.railway.app';

async function getToken() {
  if (process.env.VIDSO_TOKEN) return process.env.VIDSO_TOKEN.trim();
  const email = process.env.VIDSO_EMAIL;
  const password = process.env.VIDSO_PASSWORD;
  if (!email || !password) {
    throw new Error('Set VIDSO_TOKEN or VIDSO_EMAIL + VIDSO_PASSWORD');
  }
  const res = await fetch(API + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || 'login failed');
  return data.session.access_token;
}

function parseTool(result) {
  const text = result.content?.map((c) => c.text).join('\n') || '';
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* plain text */
  }
  return { text, json, isError: Boolean(result.isError) };
}

async function main() {
  const token = await getToken();
  console.log('token ok, connecting MCP', MCP_URL);

  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL), {
    requestInit: {
      headers: { Authorization: `Bearer ${token}` },
    },
  });
  const client = new Client({ name: 'vidso-e2e', version: '1.0.0' });
  await client.connect(transport);

  const tools = await client.listTools();
  console.log(
    'tools:',
    tools.tools.map((t) => t.name).join(', '),
  );

  const who = parseTool(await client.callTool({ name: 'whoami', arguments: {} }));
  console.log('whoami:', who.json?.email, 'credits=', who.json?.credits, 'plan=', who.json?.plan);
  if (who.isError) throw new Error('whoami failed: ' + who.text);

  const voices = parseTool(await client.callTool({ name: 'list_voices', arguments: {} }));
  console.log('voices:', voices.json?.count);
  if (!voices.json?.count) throw new Error('list_voices empty');

  const script = parseTool(
    await client.callTool({
      name: 'create_script',
      arguments: { topic: 'how airports make money', duration_id: '1min', aspect: '16:9' },
    }),
  );
  console.log('script:', script.json?.title, 'sections=', script.json?.sections?.length);
  if (!script.json?.title) throw new Error('create_script failed: ' + script.text);

  const broll = parseTool(
    await client.callTool({
      name: 'search_broll',
      arguments: { query: 'airport terminal', aspect: '16:9', per_page: 5 },
    }),
  );
  const clips = broll.json?.clips || [];
  console.log('broll clips:', clips.length);
  if (broll.isError) throw new Error('search_broll failed: ' + broll.text);

  const voiceId = voices.json.voices[0].id;
  console.log('generate_video (full pipeline, may take a few minutes)...');
  const gen = parseTool(
    await client.callTool({
      name: 'generate_video',
      arguments: {
        topic: 'coffee brewing basics in 60 seconds',
        duration_id: '1min',
        aspect: '16:9',
        voice_id: voiceId,
        wait: true,
      },
    }),
  );
  console.log('generate_video:', JSON.stringify(gen.json || gen.text).slice(0, 500));
  if (gen.isError || !gen.json?.download_url) {
    throw new Error('generate_video failed: ' + gen.text);
  }

  const head = await fetch(gen.json.download_url, { method: 'HEAD' });
  console.log('download HEAD', head.status, head.headers.get('content-type'), head.headers.get('content-length'));
  if (!head.ok) throw new Error('download url not reachable');

  console.log('E2E PASS');
  await client.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('E2E FAIL', err);
  process.exit(1);
});
