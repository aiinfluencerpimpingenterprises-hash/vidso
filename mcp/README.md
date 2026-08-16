# Vidso MCP Server

Remote MCP connector for **Claude Desktop / claude.ai / Cursor**. Wraps the existing Vidso Railway API (script → voiceover → B-roll → captions → MP4).

## Quick start (local)

```bash
cd mcp
npm install
PUBLIC_BASE_URL=http://127.0.0.1:8787 npm start
```

Health: `GET /health`  
MCP: `POST/GET/DELETE /mcp` (Bearer Vidso JWT or OAuth)

## Auth

1. **OAuth (Claude Connectors)** — Add custom connector URL `https://<host>/mcp`. Claude runs OAuth; users sign in with their Vidso email/password on `/oauth/login`.
2. **Bearer JWT** — Send `Authorization: Bearer <vidso_access_token>` (same token the dashboard stores). Useful for Cursor request headers / e2e.

## Tools

| Tool | Maps to |
|------|---------|
| `whoami` | `GET /api/user/me` |
| `list_voices` | `GET /api/tts/voices` |
| `list_presets` | `GET /api/faceless/presets` |
| `create_script` | `POST /api/faceless/script` |
| `search_broll` | `POST /api/faceless/broll/search` |
| `start_media` | `POST /api/faceless/media` |
| `render_video` | `POST /api/faceless/render` |
| `get_job_status` | media/render poll |
| `generate_video` | full pipeline orchestrator |

## Env

| Var | Default | Notes |
|-----|---------|-------|
| `PORT` | `8787` | Listen port |
| `PUBLIC_BASE_URL` | `http://127.0.0.1:$PORT` | **Must** be the public HTTPS origin in production (OAuth metadata) |
| `VIDSO_API_BASE` | Railway production URL | Existing Vidso API |
| `DASHBOARD_URL` | `https://www.vidso.pro/dashboard` | Deep link in tool results |

## Railway deploy

From the `mcp/` directory (or set Railway root to `mcp`):

1. Create a new Railway service from this repo, root directory `mcp`.
2. Set `PUBLIC_BASE_URL=https://<your-railway-domain>` (or custom `https://api.vidso.pro`).
3. Deploy. Point DNS / landing page MCP URL at `https://<host>/mcp`.

## E2E test

```bash
# server running locally
VIDSO_EMAIL=you@example.com VIDSO_PASSWORD='...' npm run test:e2e
# or
VIDSO_TOKEN='eyJ...' npm run test:e2e
```
