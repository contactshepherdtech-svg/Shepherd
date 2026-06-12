-- Add an updated_at timestamp for production TypeScript sync writes.
-- Idempotent and safe to re-run.

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE public.members
SET updated_at = COALESCE(updated_at, created_at, NOW())
WHERE updated_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_members_church_updated_at
  ON public.members (church_id, updated_at);
