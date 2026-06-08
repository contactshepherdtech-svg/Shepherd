-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- It is idempotent — safe to re-run.
--
-- Fixes a critical tenant-isolation gap: outreach_history was created in
-- 001 without RLS, so it was readable/writable by anyone holding the public
-- anon key. Enable RLS and scope all access to the caller's church, matching
-- the pattern used for members/attendance/outreach_status in 004.

ALTER TABLE public.outreach_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "outreach_history_select_own_church" ON public.outreach_history;
CREATE POLICY "outreach_history_select_own_church"
  ON public.outreach_history
  FOR SELECT
  TO authenticated
  USING (
    church_id IN (
      SELECT church_id FROM public.church_users WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "outreach_history_insert_own_church" ON public.outreach_history;
CREATE POLICY "outreach_history_insert_own_church"
  ON public.outreach_history
  FOR INSERT
  TO authenticated
  WITH CHECK (
    church_id IN (
      SELECT church_id FROM public.church_users WHERE user_id = auth.uid()
    )
  );
