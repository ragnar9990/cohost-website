// POST /api/login   { password }   →   sets HTTP-only session cookie
// Required env vars: ADMIN_PASSWORD, ADMIN_SECRET (used to sign session cookies)

import { createSession, setCookieHeader } from '../lib/auth.js';

export const onRequestPost = async ({ request, env }) => {
  let body = {};
  try { body = await request.json(); } catch (_) {
    try {
      const f = await request.formData();
      body = { password: f.get('password') || '' };
    } catch (__) {}
  }
  const submitted = (body.password || '').toString();
  const expected = (env.ADMIN_PASSWORD || '').toString();

  if (!expected) {
    return json({ ok: false, error: 'admin not configured' }, 500);
  }
  // constant-time compare on the byte level (similar lengths matter)
  if (submitted.length !== expected.length || submitted !== expected) {
    // Small delay reduces brute-force throughput slightly
    await new Promise(r => setTimeout(r, 250));
    return json({ ok: false, error: 'invalid password' }, 401);
  }

  const session = await createSession(env.ADMIN_SECRET || expected);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': setCookieHeader(session),
    },
  });
};

export const onRequestGet = async () =>
  new Response('Method Not Allowed', { status: 405 });

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
