import { NextResponse } from 'next/server';
import { completeLogin } from '../../../lib/oauth.js';
import { VidsoApiError } from '../../../lib/vidso-api.js';

export const dynamic = 'force-dynamic';

function loginHtml({ session, error }) {
  const err = error
    ? `<p class="err">${String(error).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))}</p>`
    : '';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Connect Vidso</title>
  <style>
    :root{color-scheme:dark;--bg:#0B0B0C;--panel:#121214;--line:rgba(245,245,244,.12);--txt:#F5F5F4;--muted:rgba(245,245,244,.7);--grad:linear-gradient(135deg,#F0606C,#B31D2C)}
    *{box-sizing:border-box} body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);font-family:Inter,system-ui,sans-serif;color:var(--txt)}
    .card{width:min(420px,92vw);background:var(--panel);border:1px solid var(--line);border-radius:20px;padding:28px}
    h1{margin:0 0 8px;font-size:24px;letter-spacing:-.03em} p{margin:0 0 20px;color:var(--muted);font-size:14px;line-height:1.5}
    label{display:block;font-size:12px;color:var(--muted);margin:0 0 6px}
    input{width:100%;padding:12px 14px;border-radius:12px;border:1px solid var(--line);background:#0B0B0C;color:var(--txt);margin-bottom:14px;font:inherit}
    button{width:100%;border:0;border-radius:999px;padding:13px 16px;font:inherit;font-weight:700;color:#fff;background:var(--grad);cursor:pointer}
    .err{color:#F5A0A8;font-size:13px;margin:0 0 12px}
    .note{margin-top:14px;font-size:12px;color:var(--muted)} a{color:#F5A0A8}
  </style>
</head>
<body>
  <form class="card" method="POST" action="/oauth/login">
    <h1>Connect Vidso</h1>
    <p>Sign in with your Vidso account to let Claude generate long-form videos through Vidso.</p>
    ${err}
    <input type="hidden" name="session" value="${String(session || '').replace(/"/g, '')}"/>
    <label for="email">Email</label>
    <input id="email" name="email" type="email" autocomplete="username" required/>
    <label for="password">Password</label>
    <input id="password" name="password" type="password" autocomplete="current-password" required/>
    <button type="submit">Continue</button>
    <p class="note">No account? <a href="https://www.vidso.pro/signup" target="_blank" rel="noopener">Sign up at vidso.pro</a>. Requires an active plan or credits for video generation.</p>
  </form>
</body>
</html>`;
}

export async function GET(req) {
  const url = new URL(req.url);
  return new NextResponse(
    loginHtml({ session: url.searchParams.get('session') || '', error: url.searchParams.get('error') || '' }),
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

export async function POST(req) {
  const form = await req.formData();
  const session = String(form.get('session') || '');
  const email = String(form.get('email') || '');
  const password = String(form.get('password') || '');
  try {
    const redirectTo = await completeLogin(session, email, password);
    // 303 avoids POST method preservation on Claude's callback (claude-ai-mcp#109).
    return NextResponse.redirect(redirectTo, 303);
  } catch (err) {
    const msg = encodeURIComponent(err instanceof VidsoApiError ? err.message : err.message || 'Login failed');
    return NextResponse.redirect(new URL(`/oauth/login?session=${encodeURIComponent(session)}&error=${msg}`, req.url));
  }
}
