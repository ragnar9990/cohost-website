// POST /api/unsubscribe  { token }
// Public — no auth. Marks the matching subscriber as unsubscribed.
// Also accepts GET for the one-click List-Unsubscribe header (Gmail/Apple Mail).

export const onRequestPost = async ({ request, env }) => {
  let token = '';
  try {
    const body = await request.json();
    token = (body?.token || '').toString();
  } catch (_) { /* try form / query */ }

  if (!token) {
    try {
      const form = await request.formData();
      token = (form.get('token') || '').toString();
    } catch (_) {}
  }
  if (!token) {
    const url = new URL(request.url);
    token = url.searchParams.get('token') || '';
  }

  return doUnsubscribe(env, token);
};

// One-click unsubscribe (RFC 8058) — providers POST to the URL in the
// List-Unsubscribe header; some still GET. Accept both.
export const onRequestGet = async ({ request, env }) => {
  const url = new URL(request.url);
  const token = url.searchParams.get('token') || '';
  return doUnsubscribe(env, token);
};

async function doUnsubscribe(env, token) {
  if (!env.DB) return json({ ok: false, error: 'database not configured' }, 500);
  if (!token || token.length < 10) return json({ ok: false, error: 'missing token' }, 400);

  try {
    const row = await env.DB.prepare('SELECT email, unsubscribed_at FROM waitlist WHERE unsubscribe_token = ?')
      .bind(token).first();
    if (!row) return json({ ok: false, error: 'invalid token' }, 404);

    if (!row.unsubscribed_at) {
      await env.DB.prepare("UPDATE waitlist SET unsubscribed_at = datetime('now') WHERE unsubscribe_token = ?")
        .bind(token).run();
    }
    return json({ ok: true, email: row.email, alreadyUnsubscribed: !!row.unsubscribed_at });
  } catch (err) {
    console.error('[unsubscribe] error:', err?.message || err);
    return json({ ok: false, error: 'failed' }, 500);
  }
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}
