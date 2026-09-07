-- Phase 3: provider-neutral people model. Planning Center IDs remain a legacy
-- import adapter; all internal relationships move to person_id.

CREATE OR REPLACE FUNCTION public.normalize_e164_phone(value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN value IS NULL OR btrim(value) = '' THEN NULL
    WHEN regexp_replace(btrim(value), '[^0-9+]', '', 'g') ~ '^\+[1-9][0-9]{7,14}$'
      THEN regexp_replace(btrim(value), '[^0-9+]', '', 'g')
    ELSE NULL
  END;
$$;

CREATE TABLE public.people (
  person_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id INTEGER NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  normalized_email TEXT GENERATED ALWAYS AS (NULLIF(lower(btrim(email)), '')) STORED,
  normalized_phone TEXT GENERATED ALWAYS AS (public.normalize_e164_phone(phone)) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX people_church_email_unique
  ON public.people (church_id, normalized_email) WHERE normalized_email IS NOT NULL;
CREATE UNIQUE INDEX people_church_phone_unique
  ON public.people (church_id, normalized_phone) WHERE normalized_phone IS NOT NULL;
CREATE INDEX people_church_name_idx ON public.people (church_id, full_name);

CREATE TABLE public.external_identities (
  id BIGSERIAL PRIMARY KEY,
  church_id INTEGER NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES public.people(person_id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  external_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (church_id, provider, external_id)
);
CREATE INDEX external_identities_person_idx ON public.external_identities (person_id);

ALTER TABLE public.members ADD COLUMN person_id UUID REFERENCES public.people(person_id) ON DELETE RESTRICT;
ALTER TABLE public.attendance ADD COLUMN person_id UUID REFERENCES public.people(person_id) ON DELETE RESTRICT;
ALTER TABLE public.risk_scores ADD COLUMN person_id UUID REFERENCES public.people(person_id) ON DELETE RESTRICT;
ALTER TABLE public.outreach_history ADD COLUMN person_id UUID REFERENCES public.people(person_id) ON DELETE RESTRICT;
ALTER TABLE public.outreach_status ADD COLUMN person_id UUID REFERENCES public.people(person_id) ON DELETE RESTRICT;
ALTER TABLE public.assignments ADD COLUMN person_id UUID REFERENCES public.people(person_id) ON DELETE RESTRICT;

-- A temporary deterministic bridge lets the atomic backfill map every legacy
-- members row exactly once. It is removed before this migration completes.
ALTER TABLE public.people ADD COLUMN legacy_member_id BIGINT UNIQUE;
INSERT INTO public.people (church_id, full_name, email, legacy_member_id)
SELECT m.church_id, COALESCE(NULLIF(btrim(m.name), ''), 'Unnamed person'), m.email, m.id
FROM public.members m;

UPDATE public.members m SET person_id = p.person_id
FROM public.people p WHERE p.legacy_member_id = m.id;

INSERT INTO public.external_identities (church_id, person_id, provider, external_id)
SELECT m.church_id, m.person_id, 'planning_center', m.pco_id
FROM public.members m
WHERE m.pco_id IS NOT NULL
ON CONFLICT (church_id, provider, external_id) DO UPDATE
SET person_id = EXCLUDED.person_id, updated_at = now();

UPDATE public.attendance a SET person_id = m.person_id
FROM public.members m
WHERE a.church_id = m.church_id AND a.member_pco_id = m.pco_id;
UPDATE public.risk_scores r SET person_id = m.person_id
FROM public.members m
WHERE r.church_id = m.church_id AND r.member_pco_id = m.pco_id;
UPDATE public.outreach_history h SET person_id = m.person_id
FROM public.members m
WHERE h.church_id = m.church_id AND h.member_pco_id = m.pco_id;
UPDATE public.outreach_status s SET person_id = m.person_id
FROM public.members m
WHERE s.church_id = m.church_id AND s.member_pco_id = m.pco_id;
UPDATE public.assignments a SET person_id = m.person_id
FROM public.members m WHERE a.member_id = m.id AND a.church_id = m.church_id;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.members WHERE person_id IS NULL)
     OR EXISTS (SELECT 1 FROM public.attendance WHERE person_id IS NULL)
     OR EXISTS (SELECT 1 FROM public.risk_scores WHERE person_id IS NULL)
     OR EXISTS (SELECT 1 FROM public.outreach_history WHERE person_id IS NULL)
     OR EXISTS (SELECT 1 FROM public.outreach_status WHERE person_id IS NULL)
     OR EXISTS (SELECT 1 FROM public.assignments WHERE person_id IS NULL) THEN
    RAISE EXCEPTION 'person_id backfill incomplete; legacy records do not map to a person';
  END IF;
END $$;

ALTER TABLE public.members ALTER COLUMN person_id SET NOT NULL;
ALTER TABLE public.attendance ALTER COLUMN person_id SET NOT NULL;
ALTER TABLE public.risk_scores ALTER COLUMN person_id SET NOT NULL;
ALTER TABLE public.outreach_history ALTER COLUMN person_id SET NOT NULL;
ALTER TABLE public.outreach_status ALTER COLUMN person_id SET NOT NULL;
ALTER TABLE public.assignments ALTER COLUMN person_id SET NOT NULL;
ALTER TABLE public.assignments ALTER COLUMN member_id DROP NOT NULL;
ALTER TABLE public.outreach_history ALTER COLUMN member_pco_id DROP NOT NULL;
ALTER TABLE public.outreach_status ALTER COLUMN member_pco_id DROP NOT NULL;

DROP INDEX IF EXISTS public.assignments_one_open_per_member;
CREATE UNIQUE INDEX assignments_one_open_per_person
  ON public.assignments (church_id, person_id) WHERE done = false;
CREATE UNIQUE INDEX risk_scores_church_person_unique ON public.risk_scores (church_id, person_id);
CREATE UNIQUE INDEX outreach_status_church_person_unique ON public.outreach_status (church_id, person_id);
CREATE INDEX attendance_church_person_idx ON public.attendance (church_id, person_id);
CREATE INDEX outreach_history_church_person_idx ON public.outreach_history (church_id, person_id);

ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_identities ENABLE ROW LEVEL SECURITY;
CREATE POLICY people_select_own_church ON public.people FOR SELECT TO authenticated
  USING (church_id = public.current_user_church_id());
CREATE POLICY people_insert_staff ON public.people FOR INSERT TO authenticated
  WITH CHECK (church_id = public.current_user_church_id() AND public.current_user_role() = ANY(ARRAY['admin','pastor']));
CREATE POLICY people_update_staff ON public.people FOR UPDATE TO authenticated
  USING (church_id = public.current_user_church_id() AND public.current_user_role() = ANY(ARRAY['admin','pastor']))
  WITH CHECK (church_id = public.current_user_church_id() AND public.current_user_role() = ANY(ARRAY['admin','pastor']));
CREATE POLICY people_delete_admin ON public.people FOR DELETE TO authenticated
  USING (church_id = public.current_user_church_id() AND public.current_user_role() = 'admin');
CREATE POLICY external_identities_select_own_church ON public.external_identities FOR SELECT TO authenticated
  USING (church_id = public.current_user_church_id());
CREATE POLICY external_identities_write_staff ON public.external_identities FOR ALL TO authenticated
  USING (church_id = public.current_user_church_id() AND public.current_user_role() = ANY(ARRAY['admin','pastor']))
  WITH CHECK (church_id = public.current_user_church_id() AND public.current_user_role() = ANY(ARRAY['admin','pastor']));

ALTER TABLE public.people DROP COLUMN legacy_member_id;
