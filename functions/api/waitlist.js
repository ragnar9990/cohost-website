// Cloudflare Pages Function — handles waitlist signups.
// Stores in D1, sends a branded confirmation via Resend, notifies the owner.
//
// Required env vars (Cloudflare → Pages → Settings → Environment variables):
//   RESEND_API_KEY   — from https://resend.com/api-keys (free, 3000 emails/mo)
//   OWNER_EMAIL      — your inbox; gets a "new signup" notification
//   SENDER_EMAIL     — (optional) defaults to "Cohost <onboarding@resend.dev>"
//   WEBSITE_URL      — (optional) absolute URL for asset hosting (logo) + unsubscribe link

import { Resend } from 'resend';
import { buildConfirmationHtml, buildConfirmationText } from '../lib/email.js';
import { newToken, unsubscribeUrl, unsubscribeApiUrl } from '../lib/token.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const onRequestOptions = async () =>
  new Response(null, { status: 204, headers: corsHeaders() });

export const onRequestPost = async ({ request, env }) => {
  let email = '';
  let source = 'unknown';
  try {
    const ct = request.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const body = await request.json();
      email = (body?.email || '').toString().trim();
      source = (body?.source || 'unknown').toString().slice(0, 32);
    } else {
      const form = await request.formData();
      email = (form.get('email') || '').toString().trim();
      source = (form.get('source') || 'unknown').toString().slice(0, 32);
    }
  } catch (_) { /* fall through to validation */ }

  if (!email || !EMAIL_RE.test(email)) {
    return json({ ok: false, error: 'invalid email' }, 400);
  }

  const unsubToken = newToken();

  if (env.DB) {
    try {
      await env.DB
        .prepare(`INSERT INTO waitlist (email, source, referrer, country, user_agent, unsubscribe_token)
                  VALUES (?, ?, ?, ?, ?, ?)
                  ON CONFLICT(email) DO UPDATE SET
                    unsubscribe_token = COALESCE(waitlist.unsubscribe_token, excluded.unsubscribe_token)`)
        .bind(
          email,
          source,
          request.headers.get('referer') || '',
          request.headers.get('cf-ipcountry') || '',
          (request.headers.get('user-agent') || '').slice(0, 400),
          unsubToken,
        )
        .run();
    } catch (err) {
      console.error('[waitlist] DB insert failed:', err?.message || err);
    }
  }

  const {
    RESEND_API_KEY: resendKey,
    OWNER_EMAIL: ownerEmail,
    SENDER_EMAIL,
    WEBSITE_URL,
  } = env;

  const senderEmail = SENDER_EMAIL || 'Cohost <onboarding@resend.dev>';
  const websiteUrl = (WEBSITE_URL || 'https://cohost-website.pages.dev').replace(/\/$/, '');

  // Resolve the actual unsub token (if the email was a duplicate the existing token wins)
  let actualToken = unsubToken;
  if (env.DB) {
    try {
      const row = await env.DB
        .prepare('SELECT unsubscribe_token FROM waitlist WHERE email = ?')
        .bind(email).first();
      if (row?.unsubscribe_token) actualToken = row.unsubscribe_token;
    } catch (_) {}
  }
  const unsubUrl    = unsubscribeUrl(websiteUrl, actualToken);
  const unsubApiUrl = unsubscribeApiUrl(websiteUrl, actualToken);

  if (!resendKey) {
    console.log(`[waitlist] signup (no Resend configured): ${email}`);
    return json({ ok: true, mode: 'logged' });
  }

  const resend = new Resend(resendKey);

  try {
    await resend.emails.send({
      from: senderEmail,
      to: email,
      subject: "You're on the Cohost waitlist",
      html: buildConfirmationHtml({ email, websiteUrl, unsubscribeUrl: unsubUrl }),
      text: buildConfirmationText({ email }),
      headers: {
        'List-Unsubscribe': `<${unsubApiUrl}>, <${unsubUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    });

    if (ownerEmail) {
      await resend.emails.send({
        from: senderEmail,
        to: ownerEmail,
        replyTo: email,
        subject: `New Cohost waitlist signup: ${email}`,
        text: `${email} just signed up.\n\nReply to this email to reply to them directly.\n\nTimestamp: ${new Date().toISOString()}`,
      });
    }

    return json({ ok: true });
  } catch (err) {
    console.error('[waitlist] resend error:', err?.message || err);
    console.log(`[waitlist] signup (send failed): ${email}`);
    return json({ ok: true, mode: 'logged-after-error' });
  }
};

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
  };
}
