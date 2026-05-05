// POST /api/admin/campaigns/:id/send-test  { to: "you@example.com" }
// Sends a single preview email so you can review in your inbox before broadcasting.

import { Resend } from 'resend';
import { renderCampaign, renderCampaignText } from '../../../../lib/email.js';
import { unsubscribeUrl, unsubscribeApiUrl, newToken } from '../../../../lib/token.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const onRequestPost = async ({ request, env, params }) => {
  if (!env.DB) return json({ ok: false, error: 'database not configured' }, 500);
  if (!env.RESEND_API_KEY) return json({ ok: false, error: 'RESEND_API_KEY not set' }, 500);

  const id = parseInt(params.id, 10);
  if (!id) return json({ ok: false, error: 'invalid id' }, 400);

  let to = '';
  try { to = ((await request.json())?.to || '').toString().trim(); }
  catch (_) { return json({ ok: false, error: 'invalid JSON' }, 400); }
  if (!EMAIL_RE.test(to)) return json({ ok: false, error: 'invalid recipient email' }, 400);

  const campaign = await env.DB.prepare('SELECT * FROM campaigns WHERE id = ?').bind(id).first();
  if (!campaign) return json({ ok: false, error: 'campaign not found' }, 404);

  const senderEmail = env.SENDER_EMAIL || 'Cohost <onboarding@resend.dev>';
  const websiteUrl  = (env.WEBSITE_URL || 'https://cohost-website.pages.dev').replace(/\/$/, '');
  const previewToken = newToken(); // throwaway token for preview (won't match any subscriber)
  const unsubUrl    = unsubscribeUrl(websiteUrl, previewToken);
  const unsubApiUrl = unsubscribeApiUrl(websiteUrl, previewToken);

  const resend = new Resend(env.RESEND_API_KEY);
  try {
    const result = await resend.emails.send({
      from: senderEmail,
      to,
      subject: `[TEST] ${campaign.subject}`,
      html: renderCampaign({ campaign, websiteUrl, unsubscribeUrl: unsubUrl }),
      text: renderCampaignText({ campaign, unsubscribeUrl: unsubUrl }),
      headers: {
        'List-Unsubscribe': `<${unsubApiUrl}>, <${unsubUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    });
    return json({ ok: true, messageId: result?.data?.id || null });
  } catch (err) {
    console.error('[send-test] error:', err?.message || err);
    return json({ ok: false, error: err?.message || 'send failed' }, 500);
  }
};

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}
