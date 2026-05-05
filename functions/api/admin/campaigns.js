// /api/admin/campaigns
//   GET  → list all campaigns (newest first)
//   POST → create draft (body: { subject, template, headline, body_html, cta_text, cta_url, preheader })

import { TEMPLATES } from '../../lib/email.js';

export const onRequestGet = async ({ env }) => {
  if (!env.DB) return json({ ok: false, error: 'database not configured' }, 500);
  try {
    const subscriberCount = await activeSubscriberCount(env.DB);
    const rows = await env.DB.prepare(
      `SELECT id, subject, template, status, recipient_count, sent_count, failed_count, created_at, sent_at
       FROM campaigns ORDER BY id DESC LIMIT 100`
    ).all();
    return json({
      ok: true,
      subscriberCount,
      campaigns: (rows?.results || []).map(rowToCampaign),
    });
  } catch (err) {
    console.error('[campaigns] list error:', err?.message || err);
    return json({ ok: false, error: err?.message || 'failed' }, 500);
  }
};

export const onRequestPost = async ({ request, env }) => {
  if (!env.DB) return json({ ok: false, error: 'database not configured' }, 500);
  let body;
  try { body = await request.json(); }
  catch (_) { return json({ ok: false, error: 'invalid JSON' }, 400); }

  const subject     = (body?.subject || '').toString().trim();
  const template    = (body?.template || 'announcement').toString();
  const preheader   = (body?.preheader || '').toString().trim().slice(0, 200);
  const headline    = (body?.headline || '').toString().trim().slice(0, 200);
  const body_html   = (body?.body_html || '').toString();
  const cta_text    = (body?.cta_text || '').toString().trim().slice(0, 60);
  const cta_url     = (body?.cta_url || '').toString().trim().slice(0, 500);

  if (!subject) return json({ ok: false, error: 'subject required' }, 400);
  if (!body_html.trim()) return json({ ok: false, error: 'body required' }, 400);
  if (!TEMPLATES[template]) return json({ ok: false, error: 'unknown template' }, 400);
  if (cta_url && !/^https?:\/\//i.test(cta_url)) {
    return json({ ok: false, error: 'cta_url must be a full https:// URL' }, 400);
  }

  try {
    const res = await env.DB.prepare(
      `INSERT INTO campaigns (subject, template, preheader, headline, body_html, cta_text, cta_url, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'draft')`
    ).bind(subject, template, preheader || null, headline || null, body_html, cta_text || null, cta_url || null).run();
    const id = res?.meta?.last_row_id;
    return json({ ok: true, id });
  } catch (err) {
    console.error('[campaigns] create error:', err?.message || err);
    return json({ ok: false, error: err?.message || 'failed' }, 500);
  }
};

async function activeSubscriberCount(DB) {
  const row = await DB.prepare(
    'SELECT COUNT(*) AS c FROM waitlist WHERE unsubscribed_at IS NULL'
  ).first();
  return row?.c || 0;
}

function rowToCampaign(r) {
  return {
    id: r.id,
    subject: r.subject,
    template: r.template,
    status: r.status,
    recipientCount: r.recipient_count,
    sentCount: r.sent_count,
    failedCount: r.failed_count,
    createdAt: r.created_at,
    sentAt: r.sent_at,
  };
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}
