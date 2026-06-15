-- 011_sync_status.sql
-- Add per-church sync state to integration_tokens (item 2: auto-sync).
--
-- These three columns hold the LIVE sync state and double as the atomic
-- duplicate-sync lock anchor (see app/api/sync/route.ts compare-and-set):
--   sync_status     — 'idle' | 'syncing' | 'success' | 'error'
--   sync_started_at — when the current/last run acquired the lock (stale-lock recovery)
--   sync_error      — last failure message (null on success)
--
-- IMPORTANT: sync state is kept SEPARATE from connection_status. A failed sync
-- must set sync_status='error' and leave connection_status='connected', so a
-- sync failure never makes the app treat Planning Center as disconnected.
--
-- RLS: no policy change. integration_tokens already has a church-scoped SELECT
-- policy and the client reads via select("*"), so these columns surface
-- automatically. All writes go through the service-role client in the sync route.
--
-- Idempotent — safe to re-run.

ALTER TABLE public.integration_tokens
  ADD COLUMN IF NOT EXISTS sync_status     TEXT DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS sync_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sync_error      TEXT;

-- Backfill existing rows to a known idle state.
UPDATE public.integration_tokens
SET sync_status = 'idle'
WHERE sync_status IS NULL;
