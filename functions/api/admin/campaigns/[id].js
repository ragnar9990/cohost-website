// /api/admin/campaigns/:id
//   GET    → full campaign record (incl. body)
//   PUT    → update draft
//   DELETE → delete (only if status='draft')

import { TEMPLATES } from '../../../lib/email.js';

export const onRequestGet = async ({ env, params }) => {
  if (!env.DB) return json({ ok: false, error: 'database not configured' }, 500);
  const id = parseInt(params.id, 10);
  if (!id) return json({ ok: false, error: 'invalid id' }, 400);
  const row = await env.DB.prepare('SELECT * FROM campaigns WHERE id = ?').bind(id).first();
  if (!row) return json({ ok: false, error: 'not found' }, 404);
  return json({ ok: true, campaign: rowToCampaign(row) });
};

export const onRequestPut = async ({ request, env, params }) => {
  if (!env.DB) return json({ ok: false, error: 'database not configured' }, 500);
  const id = parseInt(params.id, 10);
  if (!id) return json({ ok: false, error: 'invalid id' }, 400);

  const existing = await env.DB.prepare('SELECT status FROM campaigns WHERE id = ?').bind(id).first();
  if (!existing) return json({ ok: false, error: 'not found' }, 404);
  if (existing.status !== 'draft') {
    return json({ ok: false, error: 'cannot edit a sent or sending campaign' }, 400);
  }

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

  await env.DB.prepare(
    `UPDATE campaigns SET subject=?, template=?, preheader=?, headline=?, body_html=?, cta_text=?, cta_url=? WHERE id=?`
  ).bind(subject, template, preheader || null, headline || null, body_html, cta_text || null, cta_url || null, id).run();

  return json({ ok: true });
};

export const onRequestDelete = async ({ env, params }) => {
  if (!env.DB) return json({ ok: false, error: 'database not configured' }, 500);
  const id = parseInt(params.id, 10);
  if (!id) return json({ ok: false, error: 'invalid id' }, 400);
  const existing = await env.DB.prepare('SELECT status FROM campaigns WHERE id = ?').bind(id).first();
  if (!existing) return json({ ok: false, error: 'not found' }, 404);
  if (existing.status !== 'draft') {
    return json({ ok: false, error: 'cannot delete a sent campaign (would lose send history)' }, 400);
  }
  await env.DB.prepare('DELETE FROM campaigns WHERE id = ?').bind(id).run();
  return json({ ok: true });
};

function rowToCampaign(r) {
  return {
    id: r.id,
    subject: r.subject,
    template: r.template,
    preheader: r.preheader,
    headline: r.headline,
    bodyHtml: r.body_html,
    ctaText: r.cta_text,
    ctaUrl: r.cta_url,
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
