# Cohost — Landing page + waitlist + admin dashboard

Static landing page on **Cloudflare Pages** with:
- Waitlist signups (sends branded confirmation emails via **Resend**)
- Visit tracking (every page load logged to **Cloudflare D1** SQLite database)
- Password-protected **admin dashboard** at `/admin` showing signups + traffic stats
- **Marketing campaigns** — compose + broadcast emails to all waitlist subscribers from `/admin#campaigns`, with built-in unsubscribe

---

## What's in this folder

```
cohost-website/
├── index.html              — landing page
├── login.html              — admin sign-in page
├── admin.html              — admin dashboard
├── styles.css              — landing-page styles
├── admin.css               — dashboard styles
├── script.js               — landing-page interactivity (incl. visit tracking)
├── admin.js                — dashboard data fetch + render
├── functions/
│   ├── _middleware.js      — protects /admin and /api/admin/*
│   ├── lib/auth.js         — HMAC session cookies
│   └── api/
│       ├── waitlist.js     — POST signup → store in D1, email via Resend
│       ├── track.js        — POST visit → store in D1
│       ├── login.js        — POST { password } → set session cookie
│       ├── logout.js       — clear session cookie
│       └── admin/
│           └── stats.js    — GET aggregated stats (auth required)
├── schema.sql              — D1 schema
├── package.json            — wrangler + resend deps
├── wrangler.toml           — Cloudflare config (D1 binding lives here)
├── .env.example            — env var template
├── .gitignore
├── README.md               — this file
└── assets/                 — logo, promo videos, og image
```

---

## Full setup (10 minutes total)

### 1. Get a Resend API key (1 min)

1. https://resend.com/signup (free, no card)
2. API Keys → Create → name "Cohost website" → copy `re_…`

### 2. Create a Cloudflare D1 database (1 min)

```bash
cd C:\Users\c3645\cohost-website
npm install
npx wrangler login
npx wrangler d1 create cohost-data
```

It prints a `database_id`. **Open `wrangler.toml`** and replace `REPLACE_WITH_DATABASE_ID_FROM_WRANGLER_D1_CREATE` with that ID.

### 3. Apply the schema (30s)

Fresh install:
```bash
npx wrangler d1 execute cohost-data --remote --file=schema.sql
```

Existing DB (already had `waitlist` + `visits`)? Run the campaigns migration instead:
```bash
npx wrangler d1 execute cohost-data --remote --file=migrations/001_campaigns.sql
```

### 4. Generate an admin secret (10s)

A random string used to sign session cookies. Generate one:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output. (Or use any other long random string. 32+ chars.)

### 5. Set all env vars (1 min)

```bash
npx wrangler pages secret put RESEND_API_KEY --project-name=cohost-website
# paste re_...

npx wrangler pages secret put OWNER_EMAIL --project-name=cohost-website
# enter your inbox

npx wrangler pages secret put ADMIN_PASSWORD --project-name=cohost-website
# enter the password you'll use to sign in to /admin

npx wrangler pages secret put ADMIN_SECRET --project-name=cohost-website
# paste the 64-char hex string you generated above
```

### 6. Deploy (30s)

```bash
npm run deploy
```

### 7. Test (2 min)

- Visit `https://cohost-website.pages.dev` — submit your email → should get a confirmation email.
- Visit `https://cohost-website.pages.dev/login` — enter your `ADMIN_PASSWORD` → redirected to `/admin`
- Dashboard shows: total signups, total visits, today's counts, last-7-days bar chart, recent signups table, top referrers/countries/pages

**Done.** Every visit to the site now logs to D1. Every signup persists + emails. Admin dashboard updates in real time (auto-refreshes every 60s).

---

## How auth works

- `ADMIN_PASSWORD` env var is the login password
- On successful login, the server creates an HMAC-signed session token using `ADMIN_SECRET` and sets it as an HTTP-only cookie (14-day expiry)
- The `_middleware.js` Pages Function intercepts requests to `/admin*` and `/api/admin/*` — verifies the cookie, redirects to `/login` if missing/invalid

To change the admin password, just set a new `ADMIN_PASSWORD` env var and redeploy. Anyone with active sessions gets locked out instantly if you also rotate `ADMIN_SECRET`.

---

## Local dev

```bash
cp .env.example .dev.vars
# edit .dev.vars with real values
npm run dev
```

Then visit `http://localhost:8788`. The local dev server uses your D1 database in remote mode by default — careful, real production data.

For a separate local D1, see https://developers.cloudflare.com/d1/configuration/local-development/

---

## Inspecting D1 directly

```bash
npx wrangler d1 execute cohost-data --remote --command="SELECT COUNT(*) FROM waitlist"
npx wrangler d1 execute cohost-data --remote --command="SELECT email, created_at FROM waitlist ORDER BY id DESC LIMIT 20"
npx wrangler d1 execute cohost-data --remote --command="SELECT COUNT(*) FROM visits WHERE date(created_at) >= date('now', '-7 days')"
```

Or open the Cloudflare dashboard → Workers & Pages → D1 → `cohost-data` → Console.

---

## Switch to your own domain

Until then, emails come from `Cohost <onboarding@resend.dev>`. Once you own `cohost.live`:

1. **Website domain:** Cloudflare Pages → cohost-website → Custom domains → add `cohost.live`
2. **Email domain:** Resend → Domains → add `cohost.live` → add the DKIM/SPF records to Cloudflare DNS (one click since Cloudflare hosts both)
3. Update `SENDER_EMAIL` env var to `Cohost <hello@cohost.live>` and redeploy

---

## Sending marketing campaigns

1. Sign in at `/login` → click the **Campaigns** tab.
2. Click **New campaign**:
   - **Subject** — inbox subject line.
   - **Template** — picks the badge color/label at the top of the email. All four wrap their content in the same Cohost shell:
     - `Announcement` (red ★) — launches, milestones.
     - `Feature drop` (purple ⚡) — new features.
     - `Weekly update` (green ◷) — digests, changelogs.
     - `Custom (raw HTML)` — no badge, you write everything.
   - **Preheader** — optional inbox preview text (the line shown next to the subject in mail apps).
   - **Headline** — the big H1 inside the email (defaults to subject).
   - **Body** — basic HTML allowed: `<p>`, `<strong>`, `<em>`, `<a href>`, `<ul><li>`, `<br>`. Scripts/styles/inline event handlers are stripped.
   - **CTA** — optional white button at the bottom (text + URL).
3. Save draft → live preview renders on the right.
4. **Send test…** → preview email arrives in your inbox with `[TEST]` in the subject.
5. **Send to all** → confirm by typing `SEND`. Broadcast runs in the background, paced at ~2/sec to stay under Resend's free-tier limits. The campaign row updates with sent/failed counts as it progresses.

Every email automatically includes a working unsubscribe link in the footer + `List-Unsubscribe` headers (Gmail/Apple Mail one-click). Unsubscribed addresses are skipped on future broadcasts.

### Inspecting campaigns directly

```bash
npx wrangler d1 execute cohost-data --remote --command="SELECT id, subject, status, sent_count, recipient_count FROM campaigns ORDER BY id DESC"
npx wrangler d1 execute cohost-data --remote --command="SELECT email, status, error FROM campaign_sends WHERE campaign_id = 1"
npx wrangler d1 execute cohost-data --remote --command="SELECT COUNT(*) FROM waitlist WHERE unsubscribed_at IS NOT NULL"
```

### Caveats

- Free Resend tier: 3,000 emails/month, ~100/day, 2/sec. The send loop self-rate-limits.
- Until `cohost.live` is verified in Resend, broadcasts go from `Cohost <onboarding@resend.dev>` and may land in spam at scale. Verify the domain + set `SENDER_EMAIL` to `Cohost <hello@cohost.live>` before any large send.
- The admin UI is the only sender — there is no public API for triggering sends.

---

## Editing tips

- All colors live as CSS custom properties at the top of `styles.css` and `admin.css`
- Email shell + named templates: `functions/lib/email.js`
- Confirmation email content: `functions/lib/email.js` → `buildConfirmationHtml`
- Add a new template: append an entry to `TEMPLATES` in `functions/lib/email.js` (id, label, description, badge color)
- Admin dashboard layout: `admin.html`. To add a new stat card, append a `<article class="stat">` block and update `admin.js` `renderStats()`
