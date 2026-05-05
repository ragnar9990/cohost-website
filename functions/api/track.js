// POST /api/track  → log a page visit. Public. Best-effort, never errors loudly.
// Body: { path }

export const onRequestOptions = async () =>
  new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });

export const onRequestPost = async ({ request, env }) => {
  let path = '/';
  try {
    const body = await request.json();
    path = (body?.path || '/').toString().slice(0, 200);
  } catch (_) { /* ignore — default to "/" */ }

  const referrer  = request.headers.get('referer') || '';
  const country   = request.headers.get('cf-ipcountry') || '';
  const userAgent = (request.headers.get('user-agent') || '').slice(0, 400);

  // Skip bot traffic noise (rough — full bot detection is its own project)
  if (/bot|crawler|spider|preview|monitor|pingdom/i.test(userAgent)) {
    return json({ ok: true, ignored: 'bot' });
  }

  if (!env.DB) {
    // No DB bound yet — silently succeed so the site isn't broken
    return json({ ok: true, mode: 'no-db' });
  }

  try {
    await env.DB
      .prepare('INSERT INTO visits (path, referrer, country, user_agent) VALUES (?, ?, ?, ?)')
      .bind(path, referrer, country, userAgent)
      .run();
  } catch (err) {
    console.error('[track] insert failed:', err?.message || err);
  }
  return json({ ok: true });
};

function json(p, status = 200) {
  return new Response(JSON.stringify(p), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
