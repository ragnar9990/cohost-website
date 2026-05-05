// Shared Cohost email shell + named marketing templates.
// All templates wrap their content in the same brand shell (logo, footer, unsubscribe link).
// To add a template, add an entry to TEMPLATES below.

export const TEMPLATES = {
  'announcement': {
    label: 'Announcement',
    description: 'Big news / launch / milestone. Headline + paragraph(s) + CTA.',
    badge: { text: '★ Announcement', color: '#ef4444' },
  },
  'feature-drop': {
    label: 'Feature drop',
    description: 'A new feature shipped. Headline emphasizes the feature, body explains it.',
    badge: { text: '⚡ New feature', color: '#a78bfa' },
  },
  'weekly-update': {
    label: 'Weekly update',
    description: 'Changelog / digest. Headline = "This week in Cohost", body = bullet list.',
    badge: { text: '◷ This week', color: '#4ade80' },
  },
  'custom': {
    label: 'Custom (raw HTML)',
    description: 'You write the HTML. Wrapped in the brand shell, no badge.',
    badge: null,
  },
};

export function listTemplates() {
  return Object.entries(TEMPLATES).map(([id, t]) => ({
    id, label: t.label, description: t.description,
  }));
}

// ─── Confirmation email (waitlist signup) ──────────────────────────────────
// Kept separate because its layout is different from marketing broadcasts.

export function buildConfirmationHtml({ email, websiteUrl, unsubscribeUrl }) {
  const logoUrl = `${websiteUrl}/assets/cohost-app-icon.png`;
  return shell({
    websiteUrl,
    unsubscribeUrl,
    preheader: "You're in. We'll email you when your spot opens. Free during alpha · Founder pricing locked in.",
    inner: `
      <tr>
        <td align="center" style="padding:0;background:#120808;background-image:linear-gradient(180deg,#1a0d0d 0%,#0a0606 60%,#0a0a0a 100%);">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td align="center" style="padding:60px 36px 24px;">
                <img src="${escapeHtml(logoUrl)}" width="80" height="80" alt="Cohost" style="display:block;width:80px;height:80px;border:0;outline:none;text-decoration:none;filter:drop-shadow(0 0 36px rgba(239,68,68,0.5));" />
                <div style="margin-top:22px;font-size:20px;font-weight:600;letter-spacing:-0.02em;color:#fafafa;line-height:1;">Cohost</div>
                <div style="margin-top:7px;font-family:'SF Mono',Menlo,Consolas,monospace;font-size:10.5px;color:#7a3a3a;letter-spacing:0.30em;text-transform:uppercase;">Live AI cohost</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr><td style="padding:0;line-height:0;font-size:0;height:1px;background:linear-gradient(90deg,transparent 0%,rgba(239,68,68,0.6) 50%,transparent 100%);">&nbsp;</td></tr>
      <tr>
        <td style="padding:48px 48px 8px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="background:rgba(74,222,128,0.10);border:1px solid rgba(74,222,128,0.30);border-radius:999px;">
            <tr><td style="padding:5px 12px 5px 10px;font-size:11px;font-weight:600;color:#4ade80;letter-spacing:0.14em;text-transform:uppercase;">✓&nbsp;&nbsp;You're in</td></tr>
          </table>
          <h1 style="margin:18px 0 0;font-size:36px;font-weight:600;letter-spacing:-0.032em;line-height:1.05;color:#fafafa;">Welcome to<br />Cohost.</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:22px 48px 8px;">
          <p style="margin:0 0 16px;font-size:16px;line-height:1.65;color:#b5b5b5;">
            Thanks for signing up — you've reserved a spot for early access. We'll email <strong style="color:#fafafa;font-weight:600;">${escapeHtml(email)}</strong> the moment your invite is ready.
          </p>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding:30px 48px 12px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr><td style="border-radius:999px;background:#fafafa;">
              <a href="https://x.com/CohostLive" target="_blank" style="display:inline-block;padding:14px 28px;background:#fafafa;color:#0a0a0a;border-radius:999px;font-size:14.5px;font-weight:600;letter-spacing:-0.005em;text-decoration:none;">Follow @CohostLive&nbsp;&nbsp;→</a>
            </td></tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:22px 48px 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:linear-gradient(135deg,rgba(239,68,68,0.10) 0%,rgba(239,68,68,0.04) 100%);border:1px solid rgba(239,68,68,0.25);border-radius:14px;">
            <tr><td style="padding:22px 24px;">
              <div style="display:inline-block;font-size:10.5px;font-weight:700;color:#ef4444;letter-spacing:0.16em;text-transform:uppercase;background:rgba(239,68,68,0.10);border:1px solid rgba(239,68,68,0.30);border-radius:999px;padding:4px 11px;margin-bottom:12px;">★ Founder access</div>
              <div style="font-size:15.5px;font-weight:600;color:#fafafa;letter-spacing:-0.012em;line-height:1.35;margin-bottom:6px;">Free during alpha.<br />Founder pricing locked in for life.</div>
              <div style="font-size:13px;color:#a1a1a1;line-height:1.55;">When paid plans launch, your spot is locked at our lowest tier — forever. No expiring trials, no rug-pulls.</div>
            </td></tr>
          </table>
        </td>
      </tr>
    `,
  });
}

export function buildConfirmationText({ email }) {
  return `You're on the Cohost waitlist.

Thanks for signing up. We'll email ${email} the moment your spot opens up — usually within a couple of weeks.

Cohost is the live AI cohost for streamers. It reads chat aloud, flags trolls, replies in your voice, and pushes one stream to Twitch, YouTube, and Kick at the same time.

Follow along: https://x.com/CohostLive

Founder access:
Cohost is free during the alpha. When paid plans launch, waitlist signups lock in our lowest tier — for life.

— Built in alpha, 2026.
`;
}

// ─── Marketing broadcast renderer ──────────────────────────────────────────

export function renderCampaign({ campaign, websiteUrl, unsubscribeUrl }) {
  const { template = 'announcement', subject, headline, body_html, cta_text, cta_url, preheader } = campaign;
  const tmpl = TEMPLATES[template] || TEMPLATES['announcement'];
  const logoUrl = `${websiteUrl}/assets/cohost-app-icon.png`;
  const finalHeadline = headline || subject;

  const badgeRow = tmpl.badge
    ? `<tr><td style="padding:0 0 18px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" style="background:${hexAlpha(tmpl.badge.color, 0.10)};border:1px solid ${hexAlpha(tmpl.badge.color, 0.30)};border-radius:999px;"><tr><td style="padding:5px 12px;font-size:11px;font-weight:600;color:${tmpl.badge.color};letter-spacing:0.14em;text-transform:uppercase;">${escapeHtml(tmpl.badge.text)}</td></tr></table></td></tr>`
    : '';

  const ctaBlock = (cta_text && cta_url)
    ? `<tr><td align="center" style="padding:32px 48px 12px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="border-radius:999px;background:#fafafa;">
            <a href="${escapeHtml(cta_url)}" target="_blank" style="display:inline-block;padding:14px 28px;background:#fafafa;color:#0a0a0a;border-radius:999px;font-size:14.5px;font-weight:600;letter-spacing:-0.005em;text-decoration:none;">${escapeHtml(cta_text)}&nbsp;&nbsp;→</a>
          </td></tr>
        </table>
      </td></tr>`
    : '';

  const inner = `
    <tr>
      <td align="center" style="padding:0;background:#120808;background-image:linear-gradient(180deg,#1a0d0d 0%,#0a0606 60%,#0a0a0a 100%);">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr><td align="center" style="padding:48px 36px 28px;">
            <img src="${escapeHtml(logoUrl)}" width="56" height="56" alt="Cohost" style="display:block;width:56px;height:56px;border:0;filter:drop-shadow(0 0 28px rgba(239,68,68,0.4));" />
            <div style="margin-top:14px;font-size:16px;font-weight:600;letter-spacing:-0.018em;color:#fafafa;line-height:1;">Cohost</div>
          </td></tr>
        </table>
      </td>
    </tr>
    <tr><td style="padding:0;line-height:0;font-size:0;height:1px;background:linear-gradient(90deg,transparent 0%,rgba(239,68,68,0.6) 50%,transparent 100%);">&nbsp;</td></tr>
    <tr>
      <td style="padding:42px 48px 8px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">${badgeRow}</table>
        <h1 style="margin:0;font-size:30px;font-weight:600;letter-spacing:-0.028em;line-height:1.12;color:#fafafa;">${escapeHtml(finalHeadline)}</h1>
      </td>
    </tr>
    <tr>
      <td style="padding:18px 48px 0;font-size:15.5px;line-height:1.7;color:#c5c5c5;">
        ${sanitizeBodyHtml(body_html)}
      </td>
    </tr>
    ${ctaBlock}
  `;

  return shell({
    websiteUrl,
    unsubscribeUrl,
    preheader: preheader || stripTags(body_html).slice(0, 140),
    inner,
  });
}

export function renderCampaignText({ campaign, unsubscribeUrl }) {
  const { subject, headline, body_html, cta_text, cta_url } = campaign;
  const lines = [];
  lines.push(headline || subject);
  lines.push('');
  lines.push(stripTags(body_html));
  if (cta_text && cta_url) {
    lines.push('');
    lines.push(`${cta_text}: ${cta_url}`);
  }
  lines.push('');
  lines.push('—');
  lines.push(`Unsubscribe: ${unsubscribeUrl}`);
  return lines.join('\n');
}

// ─── Shell (shared by confirmation + campaigns) ────────────────────────────

function shell({ websiteUrl, unsubscribeUrl, preheader, inner }) {
  const siteUrl = (websiteUrl || '').replace(/\/$/, '');
  const unsubUrl = unsubscribeUrl || siteUrl;
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="dark" />
<meta name="supported-color-schemes" content="dark" />
<title>Cohost</title>
<style>
  body, table, td { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; }
  a { text-decoration: none; }
  @media (prefers-color-scheme: light) { .auto-dark { background: #050505 !important; } }
</style>
</head>
<body class="body" style="margin:0;padding:0;background:#050505;color:#fafafa;-webkit-font-smoothing:antialiased;">
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeHtml(preheader || '')}</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="auto-dark" style="background:#050505;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:#0a0a0a;border:1px solid rgba(255,255,255,0.07);border-radius:20px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,0.6);">
          ${inner}
          <tr>
            <td style="padding:36px 48px 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-top:1px solid rgba(255,255,255,0.06);">
                <tr>
                  <td style="padding-top:24px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td valign="middle" style="font-size:13.5px;font-weight:600;color:#fafafa;letter-spacing:-0.01em;">Cohost</td>
                        <td valign="middle" align="right" style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:10.5px;color:#5a5a5a;letter-spacing:0.14em;text-transform:uppercase;">v0.1 · Alpha</td>
                      </tr>
                    </table>
                    <p style="margin:18px 0 0;font-size:11.5px;color:#5a5a5a;line-height:1.7;">
                      You're getting this because you signed up at <a href="${escapeHtml(siteUrl)}" style="color:#8a8a8a;text-decoration:underline;">cohost.live</a>. Don't want these?
                      <a href="${escapeHtml(unsubUrl)}" style="color:#8a8a8a;text-decoration:underline;">Unsubscribe</a>.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;">
          <tr><td align="center" style="padding:24px 16px 8px;font-size:11px;color:#444;letter-spacing:0.05em;">© 2026 Cohost · Built in alpha</td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[m]));
}

// Strip all tags except a small allowlist for body HTML in campaigns.
// Admin is the only author so we trust input, but we still drop <script>/<style>.
function sanitizeBodyHtml(html) {
  return String(html ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/ on\w+="[^"]*"/gi, '')
    .replace(/ on\w+='[^']*'/gi, '');
}

function stripTags(html) {
  return String(html ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function hexAlpha(hex, alpha) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
