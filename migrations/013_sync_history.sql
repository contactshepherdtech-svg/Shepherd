-- 013_sync_history.sql
-- Append-only per-run sync log (item 3). Layers on top of item 2: the live
-- status + duplicate-sync lock stay on integration_tokens.sync_status; this
-- table is the historical record of COMPLETED runs only.
--
-- One row is inserted when a run finishes (success or failure) — see the finish
-- hook points in app/api/sync/route.ts. A run hard-killed at the function's 60s
-- timeout writes NO row (the completion code never executes); that case is
-- covered only by the lock's stale-recovery, not by this log. Failures that
-- throw ARE logged here with their error_message.
--
-- Counts are nullable on purpose: a run that dies partway logs NULL for the
-- counts it never reached, so "imported zero" (0) is distinguishable from
-- "never got there" (NULL).
--
-- RLS: church-scoped SELECT for authenticated readers (matches members /
-- outreach_history in migrations 004 / 007). There is intentionally NO
-- insert/update policy — the only writer is the sync route via the service-role
-- key, which bypasses RLS (same pattern as item 2's status writes).
--
-- Idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS public.sync_history (
  id                   BIGSERIAL PRIMARY KEY,
  church_id            INTEGER NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  status               TEXT NOT NULL CHECK (status IN ('success', 'failure')),
  members_imported     INTEGER,
  attendance_imported  INTEGER,
  risk_scores_updated  INTEGER,
  lifecycle_updated    INTEGER,
  error_message        TEXT,
  started_at           TIMESTAMPTZ,
  finished_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Latest-N-per-church lookups.
CREATE INDEX IF NOT EXISTS sync_history_church_finished_idx
  ON public.sync_history (church_id, finished_at DESC);

ALTER TABLE public.sync_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sync_history_select_own_church" ON public.sync_history;
CREATE POLICY "sync_history_select_own_church"
  ON public.sync_history
  FOR SELECT
  TO authenticated
  USING (
    church_id IN (
      SELECT church_id FROM public.church_users WHERE user_id = auth.uid()
    )
  );
