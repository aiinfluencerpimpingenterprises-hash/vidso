# Vidso MCP Server (Vercel)

Remote MCP connector for **Claude Desktop / claude.ai / Cursor**. Hosted on **Vercel**. Wraps the existing Vidso HTTP API (script → voiceover → B-roll → captions → MP4).

## Local

```bash
cd mcp
npm install
cp .env.example .env.local   # set OAUTH_SIGNING_SECRET
npm run dev                  # http://127.0.0.1:8787
```

- Health: `GET /health`
- MCP: `/mcp` (Streamable HTTP)
- Docs: https://www.vidso.pro/docs/mcp

## Auth

1. **OAuth (Claude Connectors)** — Add custom connector named **Vidso**, URL `https://<host>/mcp`, sign in with Vidso email/password.
2. **Bearer JWT** — `Authorization: Bearer <vidso_access_token>` (same token as the dashboard).

OAuth codes/sessions are **stateless signed JWTs** (safe on Vercel serverless). Set `OAUTH_SIGNING_SECRET` in the Vercel project env.

## Tools

`whoami`, `list_voices`, `list_presets`, `create_script`, `search_broll`, `start_media`, `render_video`, `get_job_status`, `generate_video`

## Env

| Var | Notes |
|-----|-------|
| `PUBLIC_BASE_URL` | Public HTTPS origin (e.g. `https://api.vidso.pro`). Required in production for OAuth metadata. |
| `OAUTH_SIGNING_SECRET` | Long random secret for signed OAuth codes |
| `VIDSO_API_BASE` | Vidso API origin (defaults to current production API) |
| `DASHBOARD_URL` | Deep link in tool results |

## Deploy (Vercel)

From `mcp/`:

```bash
npx vercel --prod
```

Set env vars in the Vercel project, then attach custom domain `api.vidso.pro` (or update the landing MCP URL).

`vercel.json` sets `maxDuration: 300` on `/mcp` so `generate_video` can finish within Claude's timeout.

## E2E

```bash
VIDSO_EMAIL=you@example.com VIDSO_PASSWORD='...' MCP_URL=http://127.0.0.1:8787/mcp npm run test:e2e
```
