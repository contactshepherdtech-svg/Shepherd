-- 017_outreach_workflow_status.sql
-- Outreach workflow statuses (P1 feature 4): a 5-value pipeline state on each
-- outreach follow-up, distinct from:
--   * outreach_status.status  — the queue-suppression flag (active/contacted/snoozed)
--     that drives isVisibleInQueue. UNTOUCHED here (no coupling in V1, by decision).
--   * assignments.done        — assignment completion (separate table / feature).
--
-- No RLS changes: RLS is row-level, so the new column is automatically governed by
-- the existing outreach_status policies (verified byte-for-byte unchanged after apply):
--   SELECT outreach_status_select_own_church — any member of the caller's church (incl viewer)
--   INSERT outreach_status_insert_staff      — admin + pastor, own church
--   UPDATE outreach_status_update_staff      — admin + pastor, own church (USING + WITH CHECK)
-- => writers (admin/pastor) can set workflow_status; viewers can read it, not change it.
--
-- Applied live via connector on 2026-06-26. Table is empty, so the NOT NULL DEFAULT
-- backfills nothing; 'new' is also the implicit state for members with no row yet.
ALTER TABLE public.outreach_status
  ADD COLUMN workflow_status TEXT NOT NULL DEFAULT 'new'
  CHECK (workflow_status IN ('new','assigned','in_progress','contacted','resolved'));
