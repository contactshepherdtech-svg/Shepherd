-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- It is idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS public.outreach_history (
  id          BIGSERIAL PRIMARY KEY,
  church_id   INTEGER REFERENCES public.churches(id) ON DELETE SET NULL,
  member_pco_id TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('email', 'sms')),
  subject     TEXT,
  content     TEXT NOT NULL,
  source      TEXT NOT NULL CHECK (source IN ('openrouter', 'manual')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS outreach_history_member_pco_id_idx
  ON public.outreach_history (member_pco_id);

CREATE INDEX IF NOT EXISTS outreach_history_created_at_idx
  ON public.outreach_history (created_at DESC);
