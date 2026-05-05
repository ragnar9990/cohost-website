// GET /api/admin/stats  →  full dashboard data. Auth-required (middleware checks).

export const onRequestGet = async ({ env }) => {
  if (!env.DB) return json({ ok: false, error: 'database not configured' }, 500);

  try {
    const [waitlist, visits, campaigns] = await Promise.all([
      buildWaitlistStats(env.DB),
      buildVisitStats(env.DB),
      buildCampaignStats(env.DB),
    ]);

    const conversion = {
      allTime: pct(waitlist.total, visits.total),
      last7:   pct(waitlist.last7, visits.last7),
      last30:  pct(waitlist.last30, visits.last30),
    };

    return json({ ok: true, waitlist, visits, campaigns, conversion, generatedAt: new Date().toISOString() });
  } catch (err) {
    console.error('[stats] error:', err?.message || err);
    return json({ ok: false, error: err?.message || 'failed' }, 500);
  }
};

// ─── Waitlist ──────────────────────────────────────────────────────────────

async function buildWaitlistStats(DB) {
  const [
    totalRow, activeRow, unsubRow,
    todayRow, yesterdayRow,
    last7Row, prev7Row, last30Row, prev30Row,
    firstRow,
    byDayRows, bySourceRows, byCountryRows, byHourRows, byWeekdayRows,
    recentRows,
  ] = await Promise.all([
    DB.prepare('SELECT COUNT(*) AS c FROM waitlist').first(),
    DB.prepare('SELECT COUNT(*) AS c FROM waitlist WHERE unsubscribed_at IS NULL').first(),
    DB.prepare('SELECT COUNT(*) AS c FROM waitlist WHERE unsubscribed_at IS NOT NULL').first(),
    DB.prepare("SELECT COUNT(*) AS c FROM waitlist WHERE date(created_at) = date('now')").first(),
    DB.prepare("SELECT COUNT(*) AS c FROM waitlist WHERE date(created_at) = date('now', '-1 day')").first(),
    DB.prepare("SELECT COUNT(*) AS c FROM waitlist WHERE created_at >= datetime('now', '-7 days')").first(),
    DB.prepare("SELECT COUNT(*) AS c FROM waitlist WHERE created_at >= datetime('now', '-14 days') AND created_at < datetime('now', '-7 days')").first(),
    DB.prepare("SELECT COUNT(*) AS c FROM waitlist WHERE created_at >= datetime('now', '-30 days')").first(),
    DB.prepare("SELECT COUNT(*) AS c FROM waitlist WHERE created_at >= datetime('now', '-60 days') AND created_at < datetime('now', '-30 days')").first(),
    DB.prepare('SELECT MIN(created_at) AS d FROM waitlist').first(),

    // By day, last 30
    DB.prepare(`SELECT date(created_at) AS d, COUNT(*) AS c
                FROM waitlist WHERE created_at >= datetime('now', '-30 days')
                GROUP BY date(created_at) ORDER BY d ASC`).all(),

    // By source
    DB.prepare(`SELECT COALESCE(source, 'unknown') AS s, COUNT(*) AS c
                FROM waitlist GROUP BY s ORDER BY c DESC LIMIT 10`).all(),

    // By country
    DB.prepare(`SELECT country, COUNT(*) AS c
                FROM waitlist WHERE country IS NOT NULL AND country != ''
                GROUP BY country ORDER BY c DESC LIMIT 10`).all(),

    // By hour of day (UTC)
    DB.prepare(`SELECT CAST(strftime('%H', created_at) AS INTEGER) AS h, COUNT(*) AS c
                FROM waitlist GROUP BY h ORDER BY h ASC`).all(),

    // By weekday (0 = Sunday)
    DB.prepare(`SELECT CAST(strftime('%w', created_at) AS INTEGER) AS w, COUNT(*) AS c
                FROM waitlist GROUP BY w ORDER BY w ASC`).all(),

    // Recent
    DB.prepare(`SELECT email, created_at, country, source, unsubscribed_at
                FROM waitlist ORDER BY id DESC LIMIT 30`).all(),
  ]);

  const total = totalRow?.c || 0;
  const firstDate = firstRow?.d ? new Date(firstRow.d.replace(' ', 'T') + 'Z') : null;
  const daysSinceFirst = firstDate ? Math.max(1, Math.ceil((Date.now() - firstDate.getTime()) / 86400000)) : 1;

  return {
    total,
    active: activeRow?.c || 0,
    unsubscribed: unsubRow?.c || 0,
    today: todayRow?.c || 0,
    yesterday: yesterdayRow?.c || 0,
    last7: last7Row?.c || 0,
    prev7: prev7Row?.c || 0,
    last30: last30Row?.c || 0,
    prev30: prev30Row?.c || 0,
    avgPerDay: +(total / daysSinceFirst).toFixed(2),
    firstSignupAt: firstRow?.d || null,
    byDay30: fillDays(byDayRows?.results || [], 30),
    bySource: (bySourceRows?.results || []).map(r => ({ source: r.s, count: r.c })),
    byCountry: (byCountryRows?.results || []).map(r => ({ country: r.country, count: r.c })),
    byHour: fillBuckets(byHourRows?.results || [], 24, 'h'),
    byWeekday: fillBuckets(byWeekdayRows?.results || [], 7, 'w'),
    recent: (recentRows?.results || []).map(r => ({
      email: r.email,
      createdAt: r.created_at,
      country: r.country || null,
      source: r.source || null,
      unsubscribed: !!r.unsubscribed_at,
    })),
  };
}

// ─── Visits ────────────────────────────────────────────────────────────────

async function buildVisitStats(DB) {
  const [
    totalRow, todayRow, yesterdayRow,
    last7Row, prev7Row, last30Row, prev30Row,
    firstRow,
    last7DaysRows, last30DaysRows,
    refRows, countryRows, pathRows, browserRows, byHourRows, byWeekdayRows,
    recentRows,
  ] = await Promise.all([
    DB.prepare('SELECT COUNT(*) AS c FROM visits').first(),
    DB.prepare("SELECT COUNT(*) AS c FROM visits WHERE date(created_at) = date('now')").first(),
    DB.prepare("SELECT COUNT(*) AS c FROM visits WHERE date(created_at) = date('now', '-1 day')").first(),
    DB.prepare("SELECT COUNT(*) AS c FROM visits WHERE created_at >= datetime('now', '-7 days')").first(),
    DB.prepare("SELECT COUNT(*) AS c FROM visits WHERE created_at >= datetime('now', '-14 days') AND created_at < datetime('now', '-7 days')").first(),
    DB.prepare("SELECT COUNT(*) AS c FROM visits WHERE created_at >= datetime('now', '-30 days')").first(),
    DB.prepare("SELECT COUNT(*) AS c FROM visits WHERE created_at >= datetime('now', '-60 days') AND created_at < datetime('now', '-30 days')").first(),
    DB.prepare('SELECT MIN(created_at) AS d FROM visits').first(),

    DB.prepare(`SELECT date(created_at) AS d, COUNT(*) AS c FROM visits
                WHERE created_at >= datetime('now', '-7 days')
                GROUP BY d ORDER BY d ASC`).all(),
    DB.prepare(`SELECT date(created_at) AS d, COUNT(*) AS c FROM visits
                WHERE created_at >= datetime('now', '-30 days')
                GROUP BY d ORDER BY d ASC`).all(),

    DB.prepare(`SELECT referrer, COUNT(*) AS c FROM visits
                WHERE referrer IS NOT NULL AND referrer != ''
                  AND created_at >= datetime('now', '-30 days')
                GROUP BY referrer ORDER BY c DESC LIMIT 100`).all(),

    DB.prepare(`SELECT country, COUNT(*) AS c FROM visits
                WHERE country IS NOT NULL AND country != ''
                  AND created_at >= datetime('now', '-30 days')
                GROUP BY country ORDER BY c DESC LIMIT 10`).all(),

    DB.prepare(`SELECT path, COUNT(*) AS c FROM visits
                WHERE created_at >= datetime('now', '-30 days')
                GROUP BY path ORDER BY c DESC LIMIT 10`).all(),

    // Sample of UAs to bucket client-side (LIMIT to keep query cheap)
    DB.prepare(`SELECT user_agent FROM visits
                WHERE user_agent IS NOT NULL AND user_agent != ''
                  AND created_at >= datetime('now', '-30 days')
                LIMIT 5000`).all(),

    DB.prepare(`SELECT CAST(strftime('%H', created_at) AS INTEGER) AS h, COUNT(*) AS c
                FROM visits WHERE created_at >= datetime('now', '-30 days')
                GROUP BY h ORDER BY h ASC`).all(),

    DB.prepare(`SELECT CAST(strftime('%w', created_at) AS INTEGER) AS w, COUNT(*) AS c
                FROM visits WHERE created_at >= datetime('now', '-30 days')
                GROUP BY w ORDER BY w ASC`).all(),

    DB.prepare(`SELECT path, referrer, country, created_at FROM visits
                ORDER BY id DESC LIMIT 30`).all(),
  ]);

  const total = totalRow?.c || 0;
  const firstDate = firstRow?.d ? new Date(firstRow.d.replace(' ', 'T') + 'Z') : null;
  const daysSinceFirst = firstDate ? Math.max(1, Math.ceil((Date.now() - firstDate.getTime()) / 86400000)) : 1;

  // Bucket referrers by host
  const refCounts = {};
  for (const r of refRows?.results || []) {
    const host = parseHost(r.referrer);
    refCounts[host] = (refCounts[host] || 0) + r.c;
  }
  const topReferrers = Object.entries(refCounts).sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([host, count]) => ({ host, count }));

  // Bucket browsers
  const browserCounts = {};
  for (const r of browserRows?.results || []) {
    const b = detectBrowser(r.user_agent);
    browserCounts[b] = (browserCounts[b] || 0) + 1;
  }
  const topBrowsers = Object.entries(browserCounts).sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));

  return {
    total,
    today: todayRow?.c || 0,
    yesterday: yesterdayRow?.c || 0,
    last7: last7Row?.c || 0,
    prev7: prev7Row?.c || 0,
    last30: last30Row?.c || 0,
    prev30: prev30Row?.c || 0,
    avgPerDay: +(total / daysSinceFirst).toFixed(2),
    firstVisitAt: firstRow?.d || null,
    last7Days: fillDays(last7DaysRows?.results || [], 7),
    last30Days: fillDays(last30DaysRows?.results || [], 30),
    topReferrers,
    topCountries: (countryRows?.results || []).map(r => ({ country: r.country, count: r.c })),
    topPaths: (pathRows?.results || []).map(r => ({ path: r.path, count: r.c })),
    topBrowsers,
    byHour: fillBuckets(byHourRows?.results || [], 24, 'h'),
    byWeekday: fillBuckets(byWeekdayRows?.results || [], 7, 'w'),
    recent: (recentRows?.results || []).map(r => ({
      path: r.path,
      referrer: r.referrer || null,
      country: r.country || null,
      createdAt: r.created_at,
    })),
  };
}

// ─── Campaigns ─────────────────────────────────────────────────────────────

async function buildCampaignStats(DB) {
  const [totalRow, sentStatusRow, draftRow, sumRow, recentRows] = await Promise.all([
    DB.prepare('SELECT COUNT(*) AS c FROM campaigns').first(),
    DB.prepare("SELECT COUNT(*) AS c FROM campaigns WHERE status = 'sent'").first(),
    DB.prepare("SELECT COUNT(*) AS c FROM campaigns WHERE status = 'draft'").first(),
    DB.prepare(`SELECT
                  COALESCE(SUM(sent_count), 0) AS s,
                  COALESCE(SUM(failed_count), 0) AS f,
                  COALESCE(SUM(recipient_count), 0) AS r
                FROM campaigns WHERE status IN ('sent', 'sending')`).first(),
    DB.prepare(`SELECT id, subject, status, sent_count, recipient_count, failed_count, created_at, sent_at
                FROM campaigns ORDER BY id DESC LIMIT 5`).all(),
  ]);

  return {
    total: totalRow?.c || 0,
    sent: sentStatusRow?.c || 0,
    drafts: draftRow?.c || 0,
    totalEmailsSent: sumRow?.s || 0,
    totalEmailsFailed: sumRow?.f || 0,
    totalRecipients: sumRow?.r || 0,
    recent: (recentRows?.results || []).map(r => ({
      id: r.id,
      subject: r.subject,
      status: r.status,
      sentCount: r.sent_count,
      recipientCount: r.recipient_count,
      failedCount: r.failed_count,
      createdAt: r.created_at,
      sentAt: r.sent_at,
    })),
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function fillDays(rows, n) {
  const map = Object.fromEntries(rows.map(r => [r.d, r.c]));
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    const iso = d.toISOString().slice(0, 10);
    out.push({ date: iso, count: map[iso] || 0 });
  }
  return out;
}

function fillBuckets(rows, n, key) {
  const arr = new Array(n).fill(0);
  for (const r of rows) {
    const i = r[key];
    if (typeof i === 'number' && i >= 0 && i < n) arr[i] = r.c;
  }
  return arr;
}

function parseHost(url) {
  try { return new URL(url).host; } catch (_) { return 'direct'; }
}

function detectBrowser(ua) {
  if (!ua) return 'Other';
  const s = ua.toLowerCase();
  if (s.includes('edg/'))                           return 'Edge';
  if (s.includes('opr/') || s.includes('opera'))    return 'Opera';
  if (s.includes('chrome/') && !s.includes('edg/')) return s.includes('mobile') ? 'Chrome Mobile' : 'Chrome';
  if (s.includes('firefox/'))                       return 'Firefox';
  if (s.includes('safari/') && !s.includes('chrome/')) return s.includes('mobile') ? 'Safari Mobile' : 'Safari';
  if (s.includes('bot') || s.includes('crawler') || s.includes('spider')) return 'Bot';
  return 'Other';
}

function pct(num, denom) {
  if (!denom) return 0;
  return +((num / denom) * 100).toFixed(2);
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}
