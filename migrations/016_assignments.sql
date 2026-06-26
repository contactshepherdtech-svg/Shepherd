-- 016_assignments.sql
-- Assignment System (P1 feature 2): assign a member to a staff owner with due date + note.
-- Two tables: note isolated so the T2 visibility wall is enforced ROW-level by RLS.
-- Applied live via connector on 2026-06-25 (Supabase migration history is empty by convention;
-- this file is the repo record).

-- ============================================================
-- Tables
-- ============================================================
CREATE TABLE public.assignments (
  id            BIGSERIAL PRIMARY KEY,
  church_id     INTEGER NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  member_id     INTEGER NOT NULL REFERENCES public.members(id)  ON DELETE CASCADE,
  owner_user_id UUID    REFERENCES auth.users(id) ON DELETE SET NULL,
  due_date      DATE,
  done          BOOLEAN NOT NULL DEFAULT false,
  done_at       TIMESTAMPTZ,
  created_by    UUID    REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.assignment_notes (
  assignment_id BIGINT PRIMARY KEY REFERENCES public.assignments(id) ON DELETE CASCADE,
  church_id     INTEGER NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,  -- duplicated so RLS scopes without a join
  note          TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Indexes
-- ============================================================
-- One OPEN assignment per member; completed rows kept as history.
CREATE UNIQUE INDEX assignments_one_open_per_member
  ON public.assignments (church_id, member_id) WHERE done = false;

CREATE INDEX assignments_church_id_idx    ON public.assignments (church_id);
CREATE INDEX assignments_church_owner_idx ON public.assignments (church_id, owner_user_id);
CREATE INDEX assignments_member_id_idx    ON public.assignments (member_id);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.assignments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_notes ENABLE ROW LEVEL SECURITY;

-- ---- assignments ----
-- SELECT: any staff in church
CREATE POLICY assignments_select_staff ON public.assignments
  FOR SELECT USING (church_id = current_user_church_id());

-- INSERT: admin + pastor
CREATE POLICY assignments_insert_staff ON public.assignments
  FOR INSERT WITH CHECK (
    church_id = current_user_church_id()
    AND current_user_role() = ANY(ARRAY['admin','pastor'])
  );

-- UPDATE: admin -> any row; pastor -> only rows they own.
-- (Makes the team board read-only for pastors and reassignment admin-only at the DB level.)
CREATE POLICY assignments_update_owner_or_admin ON public.assignments
  FOR UPDATE
  USING (
    church_id = current_user_church_id()
    AND (current_user_role() = 'admin'
      OR (current_user_role() = 'pastor' AND owner_user_id = auth.uid()))
  )
  WITH CHECK (
    church_id = current_user_church_id()
    AND (current_user_role() = 'admin'
      OR (current_user_role() = 'pastor' AND owner_user_id = auth.uid()))
  );

-- DELETE: admin only
CREATE POLICY assignments_delete_admin ON public.assignments
  FOR DELETE USING (
    church_id = current_user_church_id()
    AND current_user_role() = 'admin'
  );

-- ---- assignment_notes (T2) ----
-- SELECT: admin + pastor only (viewers get zero rows -> never see a note)
CREATE POLICY assignment_notes_select_staff ON public.assignment_notes
  FOR SELECT USING (
    church_id = current_user_church_id()
    AND current_user_role() = ANY(ARRAY['admin','pastor'])
  );

-- INSERT/UPDATE/DELETE: admin + pastor, own church
CREATE POLICY assignment_notes_insert_staff ON public.assignment_notes
  FOR INSERT WITH CHECK (
    church_id = current_user_church_id()
    AND current_user_role() = ANY(ARRAY['admin','pastor'])
  );

CREATE POLICY assignment_notes_update_staff ON public.assignment_notes
  FOR UPDATE
  USING (
    church_id = current_user_church_id()
    AND current_user_role() = ANY(ARRAY['admin','pastor'])
  )
  WITH CHECK (
    church_id = current_user_church_id()
    AND current_user_role() = ANY(ARRAY['admin','pastor'])
  );

CREATE POLICY assignment_notes_delete_staff ON public.assignment_notes
  FOR DELETE USING (
    church_id = current_user_church_id()
    AND current_user_role() = ANY(ARRAY['admin','pastor'])
  );
