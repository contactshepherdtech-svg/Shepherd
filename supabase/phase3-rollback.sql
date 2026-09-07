-- Staging-only Phase 3 rollback. This removes the person abstraction but leaves
-- the legacy PCO columns and Phase 2 data intact. Do not run in production.
BEGIN;
DROP VIEW IF EXISTS public.integration_status;
DROP INDEX IF EXISTS public.assignments_one_open_per_person;
DROP INDEX IF EXISTS public.risk_scores_church_person_unique;
DROP INDEX IF EXISTS public.outreach_status_church_person_unique;
DROP INDEX IF EXISTS public.attendance_church_person_idx;
DROP INDEX IF EXISTS public.outreach_history_church_person_idx;
ALTER TABLE public.assignments DROP COLUMN IF EXISTS person_id;
ALTER TABLE public.outreach_status DROP COLUMN IF EXISTS person_id;
ALTER TABLE public.outreach_history DROP COLUMN IF EXISTS person_id;
ALTER TABLE public.risk_scores DROP COLUMN IF EXISTS person_id;
ALTER TABLE public.attendance DROP COLUMN IF EXISTS person_id;
ALTER TABLE public.members DROP COLUMN IF EXISTS person_id;
ALTER TABLE public.assignments ALTER COLUMN member_id SET NOT NULL;
ALTER TABLE public.outreach_history ALTER COLUMN member_pco_id SET NOT NULL;
ALTER TABLE public.outreach_status ALTER COLUMN member_pco_id SET NOT NULL;
CREATE UNIQUE INDEX assignments_one_open_per_member ON public.assignments (church_id, member_id) WHERE done = false;
DROP TABLE IF EXISTS public.external_identities;
DROP TABLE IF EXISTS public.people;
DROP FUNCTION IF EXISTS public.normalize_e164_phone(TEXT);
COMMIT;
