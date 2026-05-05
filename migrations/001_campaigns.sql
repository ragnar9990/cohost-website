-- Migration: add unsubscribe support + campaigns tables.
-- Safe to run on an existing DB that already has waitlist + visits.
--
--   npx wrangler d1 execute cohost-data --remote --file=migrations/001_campaigns.sql

ALTER TABLE waitlist ADD COLUMN unsubscribed_at TEXT;
ALTER TABLE waitlist ADD COLUMN unsubscribe_token TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_waitlist_unsub_token
  ON waitlist(unsubscribe_token) WHERE unsubscribe_token IS NOT NULL;

CREATE TABLE IF NOT EXISTS campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject TEXT NOT NULL,
  template TEXT NOT NULL DEFAULT 'announcement',
  preheader TEXT,
  headline TEXT,
  body_html TEXT NOT NULL,
  cta_text TEXT,
  cta_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
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
  status TEXT NOT NULL,
  resend_message_id TEXT,
  error TEXT,
  sent_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(campaign_id, email)
);

CREATE INDEX IF NOT EXISTS idx_campaign_sends_campaign ON campaign_sends(campaign_id);
