-- First-time visitor tracking for Shepherd.
-- Adds visitor lifecycle fields to members without deleting or rewriting existing data.

BEGIN;

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS first_visit_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS visitor_status TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS last_followup_at TIMESTAMPTZ;

UPDATE public.members
SET visitor_status = 'none'
WHERE visitor_status IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'members_visitor_status_check'
      AND conrelid = 'public.members'::regclass
  ) THEN
    ALTER TABLE public.members
      ADD CONSTRAINT members_visitor_status_check
      CHECK (visitor_status IN ('first_time', 'returned', 'converted', 'none'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_members_church_visitor_status
  ON public.members (church_id, visitor_status);

CREATE INDEX IF NOT EXISTS idx_members_church_first_visit_date
  ON public.members (church_id, first_visit_date);

CREATE INDEX IF NOT EXISTS idx_members_church_last_followup_at
  ON public.members (church_id, last_followup_at);

COMMIT;
