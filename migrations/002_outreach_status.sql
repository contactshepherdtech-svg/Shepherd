-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- It is idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS public.outreach_status (
  id              BIGSERIAL PRIMARY KEY,
  church_id       INTEGER REFERENCES public.churches(id) ON DELETE SET NULL,
  member_pco_id   TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'contacted', 'snoozed')),
  contacted_at    TIMESTAMPTZ,
  snoozed_until   TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One status record per member per church
CREATE UNIQUE INDEX IF NOT EXISTS outreach_status_church_member_idx
  ON public.outreach_status (church_id, member_pco_id);

CREATE INDEX IF NOT EXISTS outreach_status_status_idx
  ON public.outreach_status (status);

-- Allow anon key reads and writes (adjust to your RLS policy preference)
ALTER TABLE public.outreach_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_outreach_status" ON public.outreach_status;
CREATE POLICY "allow_all_outreach_status"
  ON public.outreach_status
  FOR ALL
  USING (true)
  WITH CHECK (true);
