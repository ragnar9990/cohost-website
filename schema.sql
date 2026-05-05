-- Cohost website D1 schema (fresh install).
-- For an existing DB, run migrations/001_campaigns.sql instead.
--
--   npx wrangler d1 execute cohost-data --remote --file=schema.sql

CREATE TABLE IF NOT EXISTS waitlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  source TEXT,                  -- 'hero' | 'cta' (which form was used)
  referrer TEXT,                -- referer header at signup time
  country TEXT,                 -- cf-ipcountry header
  user_agent TEXT,
  unsubscribed_at TEXT,         -- non-null = opted out, won't receive campaigns
  unsubscribe_token TEXT        -- per-subscriber random token for /unsubscribe link
);

CREATE INDEX IF NOT EXISTS idx_waitlist_created_at ON waitlist(created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_waitlist_unsub_token ON waitlist(unsubscribe_token) WHERE unsubscribe_token IS NOT NULL;

CREATE TABLE IF NOT EXISTS visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT NOT NULL,
  referrer TEXT,
  country TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_visits_created_at ON visits(created_at);
CREATE INDEX IF NOT EXISTS idx_visits_path ON visits(path);

-- ─── Campaigns (marketing broadcasts) ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject TEXT NOT NULL,
  template TEXT NOT NULL DEFAULT 'announcement',  -- announcement | feature-drop | weekly-update | custom
  preheader TEXT,                                  -- inbox preview text (optional)
  headline TEXT,                                   -- big H1 (optional, falls back to subject)
  body_html TEXT NOT NULL,                         -- rich body (HTML allowed)
  cta_text TEXT,                                   -- optional button label
  cta_url TEXT,                                    -- optional button href
  status TEXT NOT NULL DEFAULT 'draft',            -- draft | sending | sent | failed
  recipient_count INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  sent_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON campaigns(created_at);

CREATE TABLE IF NOT EXISTS campaign_sends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL,
  email TEXT NOT NULL,
  status TEXT NOT NULL,                            -- sent | failed
  resend_message_id TEXT,
  error TEXT,
  sent_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(campaign_id, email)
);

CREATE INDEX IF NOT EXISTS idx_campaign_sends_campaign ON campaign_sends(campaign_id);
