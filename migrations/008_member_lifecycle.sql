-- Member lifecycle classification for Planning Center people.
-- Uses Planning Center person creation date plus attendance history to avoid scoring visitors as at risk.

BEGIN;

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS pco_created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS first_visit_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS visitor_status TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS member_lifecycle TEXT,
  ADD COLUMN IF NOT EXISTS last_followup_at TIMESTAMPTZ;

UPDATE public.members
SET visitor_status = 'none'
WHERE visitor_status IS NULL;

WITH attendance_rollup AS (
  SELECT
    m.id AS member_id,
    COUNT(a.id) AS attendance_count,
    MIN(a.attended_at) AS first_attended_at
  FROM public.members m
  LEFT JOIN public.attendance a
    ON a.church_id IS NOT DISTINCT FROM m.church_id
   AND a.member_pco_id = m.pco_id
  GROUP BY m.id
)
UPDATE public.members m
SET
  first_visit_date = CASE
    WHEN attendance_rollup.attendance_count > 0 THEN attendance_rollup.first_attended_at
    ELSE NULL
  END,
  visitor_status = CASE
    WHEN attendance_rollup.attendance_count = 1 THEN 'first_time'
    WHEN attendance_rollup.attendance_count = 2 THEN 'returned'
    WHEN attendance_rollup.attendance_count >= 3 THEN 'converted'
    ELSE 'none'
  END,
  member_lifecycle = CASE
    WHEN attendance_rollup.attendance_count = 0
      AND m.pco_created_at IS NOT NULL
      AND m.pco_created_at >= NOW() - INTERVAL '14 days'
      THEN 'new_no_attendance'
    WHEN attendance_rollup.attendance_count = 0 THEN 'needs_first_followup'
    WHEN attendance_rollup.attendance_count = 1 THEN 'first_time_visitor'
    WHEN attendance_rollup.attendance_count = 2 THEN 'returned_visitor'
    ELSE 'established_member'
  END
FROM attendance_rollup
WHERE m.id = attendance_rollup.member_id;

DELETE FROM public.risk_scores r
USING public.members m
WHERE r.church_id IS NOT DISTINCT FROM m.church_id
  AND r.member_pco_id = m.pco_id
  AND m.member_lifecycle <> 'established_member';

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

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'members_member_lifecycle_check'
      AND conrelid = 'public.members'::regclass
  ) THEN
    ALTER TABLE public.members
      ADD CONSTRAINT members_member_lifecycle_check
      CHECK (
        member_lifecycle IN (
          'new_no_attendance',
          'first_time_visitor',
          'returned_visitor',
          'established_member',
          'needs_first_followup'
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_members_church_pco_created_at
  ON public.members (church_id, pco_created_at);

CREATE INDEX IF NOT EXISTS idx_members_church_visitor_status
  ON public.members (church_id, visitor_status);

CREATE INDEX IF NOT EXISTS idx_members_church_member_lifecycle
  ON public.members (church_id, member_lifecycle);

CREATE INDEX IF NOT EXISTS idx_members_church_first_visit_date
  ON public.members (church_id, first_visit_date);

CREATE INDEX IF NOT EXISTS idx_members_church_last_followup_at
  ON public.members (church_id, last_followup_at);

COMMIT;
