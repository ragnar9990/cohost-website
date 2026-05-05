// GET /api/admin/stats  →  dashboard data. Auth-required (middleware checks).
//
// Returns:
//   {
//     waitlist: { total, today, recent: [{email, createdAt, country, source}] },
//     visits:   { total, today, last7Days: [{date, count}], topReferrers, topCountries, topPaths }
//   }

export const onRequestGet = async ({ env }) => {
  if (!env.DB) {
    return json({ ok: false, error: 'database not configured' }, 500);
  }

  try {
    const [waitlist, visits] = await Promise.all([
      buildWaitlistStats(env.DB),
      buildVisitStats(env.DB),
    ]);
    return json({ ok: true, waitlist, visits, generatedAt: new Date().toISOString() });
  } catch (err) {
    console.error('[stats] error:', err?.message || err);
    return json({ ok: false, error: err?.message || 'failed' }, 500);
  }
};

async function buildWaitlistStats(DB) {
  const totalRow = await DB.prepare('SELECT COUNT(*) AS c FROM waitlist').first();
  const todayRow = await DB.prepare(
    "SELECT COUNT(*) AS c FROM waitlist WHERE date(created_at) = date('now')"
  ).first();
  const recent = await DB.prepare(
    "SELECT email, created_at, country, source FROM waitlist ORDER BY id DESC LIMIT 30"
  ).all();
  return {
    total: totalRow?.c || 0,
    today: todayRow?.c || 0,
    recent: (recent?.results || []).map(r => ({
      email: r.email,
      createdAt: r.created_at,
      country: r.country || null,
      source: r.source || null,
    })),
  };
}

async function buildVisitStats(DB) {
  const totalRow = await DB.prepare('SELECT COUNT(*) AS c FROM visits').first();
  const todayRow = await DB.prepare(
    "SELECT COUNT(*) AS c FROM visits WHERE date(created_at) = date('now')"
  ).first();

  // Last 7 days, including today
  const last7 = await DB.prepare(`
    SELECT date(created_at) AS d, COUNT(*) AS c
    FROM visits
    WHERE created_at >= datetime('now', '-7 days')
    GROUP BY date(created_at)
    ORDER BY d ASC
  `).all();
  const dayCounts = Object.fromEntries((last7?.results || []).map(r => [r.d, r.c]));
  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    const iso = d.toISOString().slice(0, 10);
    last7Days.push({ date: iso, count: dayCounts[iso] || 0 });
  }

  // Top referrers (last 30 days, host only)
  const refRows = await DB.prepare(`
    SELECT referrer, COUNT(*) AS c
    FROM visits
    WHERE referrer IS NOT NULL AND referrer != ''
      AND created_at >= datetime('now', '-30 days')
    GROUP BY referrer
    ORDER BY c DESC
    LIMIT 50
  `).all();
  const referrerCounts = {};
  for (const r of refRows?.results || []) {
    const host = parseHost(r.referrer);
    referrerCounts[host] = (referrerCounts[host] || 0) + r.c;
  }
  const topReferrers = Object.entries(referrerCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([host, count]) => ({ host, count }));

  // Top countries
  const countryRows = await DB.prepare(`
    SELECT country, COUNT(*) AS c
    FROM visits
    WHERE country IS NOT NULL AND country != ''
      AND created_at >= datetime('now', '-30 days')
    GROUP BY country
    ORDER BY c DESC
    LIMIT 8
  `).all();
  const topCountries = (countryRows?.results || []).map(r => ({ country: r.country, count: r.c }));

  // Top paths
  const pathRows = await DB.prepare(`
    SELECT path, COUNT(*) AS c
    FROM visits
    WHERE created_at >= datetime('now', '-30 days')
    GROUP BY path
    ORDER BY c DESC
    LIMIT 8
  `).all();
  const topPaths = (pathRows?.results || []).map(r => ({ path: r.path, count: r.c }));

  return {
    total: totalRow?.c || 0,
    today: todayRow?.c || 0,
    last7Days,
    topReferrers,
    topCountries,
    topPaths,
  };
}

function parseHost(url) {
  try { return new URL(url).host; } catch (_) { return 'direct'; }
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
