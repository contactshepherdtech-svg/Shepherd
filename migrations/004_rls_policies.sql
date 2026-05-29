-- Production Row Level Security policies for Shepherd multi-tenant data.
-- Run this in the Supabase SQL editor. It is idempotent and replaces older broad policies.

BEGIN;

ALTER TABLE public.churches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.church_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.church_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "churches_select_all" ON public.churches;
DROP POLICY IF EXISTS "churches_insert_authenticated" ON public.churches;
DROP POLICY IF EXISTS "churches_update_authenticated" ON public.churches;
DROP POLICY IF EXISTS "churches_select_own_church" ON public.churches;

DROP POLICY IF EXISTS "church_users_select_own" ON public.church_users;
DROP POLICY IF EXISTS "church_users_insert_own" ON public.church_users;
DROP POLICY IF EXISTS "church_users_delete_own" ON public.church_users;

DROP POLICY IF EXISTS "members_select_own_church" ON public.members;
DROP POLICY IF EXISTS "attendance_select_own_church" ON public.attendance;
DROP POLICY IF EXISTS "risk_scores_select_own_church" ON public.risk_scores;

DROP POLICY IF EXISTS "church_settings_select_own_church" ON public.church_settings;
DROP POLICY IF EXISTS "church_settings_insert_own_church" ON public.church_settings;
DROP POLICY IF EXISTS "church_settings_update_own_church" ON public.church_settings;

DROP POLICY IF EXISTS "integration_tokens_select_own_church" ON public.integration_tokens;

DROP POLICY IF EXISTS "allow_all_outreach_status" ON public.outreach_status;
DROP POLICY IF EXISTS "outreach_status_select_own_church" ON public.outreach_status;
DROP POLICY IF EXISTS "outreach_status_insert_own_church" ON public.outreach_status;
DROP POLICY IF EXISTS "outreach_status_update_own_church" ON public.outreach_status;

CREATE POLICY "church_users_select_own"
  ON public.church_users
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "churches_select_own_church"
  ON public.churches
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT church_id
      FROM public.church_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "members_select_own_church"
  ON public.members
  FOR SELECT
  TO authenticated
  USING (
    church_id IN (
      SELECT church_id
      FROM public.church_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "attendance_select_own_church"
  ON public.attendance
  FOR SELECT
  TO authenticated
  USING (
    church_id IN (
      SELECT church_id
      FROM public.church_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "risk_scores_select_own_church"
  ON public.risk_scores
  FOR SELECT
  TO authenticated
  USING (
    church_id IN (
      SELECT church_id
      FROM public.church_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "church_settings_select_own_church"
  ON public.church_settings
  FOR SELECT
  TO authenticated
  USING (
    church_id IN (
      SELECT church_id
      FROM public.church_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "church_settings_insert_own_church"
  ON public.church_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    church_id IN (
      SELECT church_id
      FROM public.church_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "church_settings_update_own_church"
  ON public.church_settings
  FOR UPDATE
  TO authenticated
  USING (
    church_id IN (
      SELECT church_id
      FROM public.church_users
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    church_id IN (
      SELECT church_id
      FROM public.church_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "integration_tokens_select_own_church"
  ON public.integration_tokens
  FOR SELECT
  TO authenticated
  USING (
    church_id IN (
      SELECT church_id
      FROM public.church_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "outreach_status_select_own_church"
  ON public.outreach_status
  FOR SELECT
  TO authenticated
  USING (
    church_id IN (
      SELECT church_id
      FROM public.church_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "outreach_status_insert_own_church"
  ON public.outreach_status
  FOR INSERT
  TO authenticated
  WITH CHECK (
    church_id IN (
      SELECT church_id
      FROM public.church_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "outreach_status_update_own_church"
  ON public.outreach_status
  FOR UPDATE
  TO authenticated
  USING (
    church_id IN (
      SELECT church_id
      FROM public.church_users
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    church_id IN (
      SELECT church_id
      FROM public.church_users
      WHERE user_id = auth.uid()
    )
  );

COMMIT;
