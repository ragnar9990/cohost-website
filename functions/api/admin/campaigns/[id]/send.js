// POST /api/admin/campaigns/:id/send  { confirm: true }
// Broadcasts to every active waitlist subscriber (unsubscribed_at IS NULL).
//
// Implementation notes:
// - Marks campaign 'sending' immediately, kicks off the loop in waitUntil so the
//   request returns fast. Admin UI polls the campaign for status updates.
// - Backfills unsubscribe_token for any old rows that don't have one yet.
// - Idempotent per (campaign_id, email): re-running won't double-send the same
//   address (UNIQUE index on campaign_sends).
// - Self-rate-limited at ~2/sec to stay under Resend's free-tier limit.

import { Resend } from 'resend';
import { renderCampaign, renderCampaignText } from '../../../../lib/email.js';
import { unsubscribeUrl, unsubscribeApiUrl, newToken } from '../../../../lib/token.js';

export const onRequestPost = async ({ request, env, params, waitUntil }) => {
  if (!env.DB) return json({ ok: false, error: 'database not configured' }, 500);
  if (!env.RESEND_API_KEY) return json({ ok: false, error: 'RESEND_API_KEY not set' }, 500);

  const id = parseInt(params.id, 10);
  if (!id) return json({ ok: false, error: 'invalid id' }, 400);

  let body;
  try { body = await request.json(); } catch (_) { body = {}; }
  if (!body?.confirm) return json({ ok: false, error: 'confirm:true required' }, 400);

  const campaign = await env.DB.prepare('SELECT * FROM campaigns WHERE id = ?').bind(id).first();
  if (!campaign) return json({ ok: false, error: 'campaign not found' }, 404);
  if (campaign.status !== 'draft') {
    return json({ ok: false, error: `campaign already ${campaign.status}` }, 400);
  }

  const subs = await env.DB.prepare(
    'SELECT id, email, unsubscribe_token FROM waitlist WHERE unsubscribed_at IS NULL ORDER BY id ASC'
  ).all();
  const recipients = subs?.results || [];
  if (!recipients.length) return json({ ok: false, error: 'no active subscribers' }, 400);

  // Mark sending
  await env.DB.prepare(
    "UPDATE campaigns SET status='sending', recipient_count=? WHERE id=?"
  ).bind(recipients.length, id).run();

  // Fire the actual loop without blocking the response
  const ctx = waitUntil || ((p) => p);
  ctx(runCampaign({ env, campaign, recipients }));

  return json({ ok: true, status: 'sending', recipientCount: recipients.length });
};

async function runCampaign({ env, campaign, recipients }) {
  const senderEmail = env.SENDER_EMAIL || 'Cohost <onboarding@resend.dev>';
  const websiteUrl  = (env.WEBSITE_URL || 'https://cohost-website.pages.dev').replace(/\/$/, '');
  const resend = new Resend(env.RESEND_API_KEY);

  let sent = 0;
  let failed = 0;

  for (const sub of recipients) {
    // Backfill missing token (older rows from before this migration)
    let token = sub.unsubscribe_token;
    if (!token) {
      token = newToken();
      try {
        await env.DB.prepare('UPDATE waitlist SET unsubscribe_token = ? WHERE id = ? AND unsubscribe_token IS NULL')
          .bind(token, sub.id).run();
      } catch (_) {}
    }
    const unsubUrl    = unsubscribeUrl(websiteUrl, token);
    const unsubApiUrl = unsubscribeApiUrl(websiteUrl, token);

    try {
      const result = await resend.emails.send({
        from: senderEmail,
        to: sub.email,
        subject: campaign.subject,
        html: renderCampaign({ campaign, websiteUrl, unsubscribeUrl: unsubUrl }),
        text: renderCampaignText({ campaign, unsubscribeUrl: unsubUrl }),
        headers: {
          'List-Unsubscribe': `<${unsubApiUrl}>, <${unsubUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      });
      const messageId = result?.data?.id || null;
      sent++;
      try {
        await env.DB.prepare(
          `INSERT OR IGNORE INTO campaign_sends (campaign_id, email, status, resend_message_id) VALUES (?, ?, 'sent', ?)`
        ).bind(campaign.id, sub.email, messageId).run();
      } catch (_) {}
    } catch (err) {
      failed++;
      const errMsg = (err?.message || String(err)).slice(0, 500);
      console.error(`[campaign ${campaign.id}] send to ${sub.email} failed:`, errMsg);
      try {
        await env.DB.prepare(
          `INSERT OR IGNORE INTO campaign_sends (campaign_id, email, status, error) VALUES (?, ?, 'failed', ?)`
        ).bind(campaign.id, sub.email, errMsg).run();
      } catch (_) {}
    }

    // Rate-limit: ~2/sec under Resend's free tier
    await sleep(550);

    // Periodically update the campaign counters so admin UI sees progress
    if ((sent + failed) % 10 === 0) {
      try {
        await env.DB.prepare('UPDATE campaigns SET sent_count=?, failed_count=? WHERE id=?')
          .bind(sent, failed, campaign.id).run();
      } catch (_) {}
    }
  }

  const finalStatus = failed > 0 && sent === 0 ? 'failed' : 'sent';
  try {
    await env.DB.prepare(
      `UPDATE campaigns SET status=?, sent_count=?, failed_count=?, sent_at=datetime('now') WHERE id=?`
    ).bind(finalStatus, sent, failed, campaign.id).run();
  } catch (err) {
    console.error('[campaign] final status update failed:', err?.message || err);
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}
