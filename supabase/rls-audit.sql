-- Run on STAGING after all migrations. It raises an error on missing RLS or
-- expected policies. It is read-only and safe to run repeatedly.

DO $$
DECLARE
  table_name text;
  required_tables text[] := ARRAY[
    'churches', 'church_users', 'members', 'attendance', 'risk_scores',
    'church_settings', 'integration_tokens', 'people', 'external_identities', 'outreach_status',
    'outreach_history', 'sync_history', 'church_invitations', 'assignments',
    'assignment_notes', 'access_requests'
  ];
  required_policies text[] := ARRAY[
    'church_users_select_own', 'churches_select_own_church',
    'members_select_own_church', 'attendance_select_own_church',
    'risk_scores_select_own_church', 'church_settings_select_own_church',
    'people_select_own_church', 'people_insert_staff',
    'external_identities_select_own_church', 'external_identities_write_staff',
    'integration_tokens_select_own_church', 'outreach_status_select_own_church',
    'outreach_history_select_own_church', 'sync_history_select_own_church',
    'assignments_select_staff', 'assignment_notes_select_staff',
    'access_requests_public_insert'
  ];
  policy_name text;
BEGIN
  FOREACH table_name IN ARRAY required_tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = table_name AND c.relrowsecurity
    ) THEN
      RAISE EXCEPTION 'RLS is not enabled on public.%', table_name;
    END IF;
  END LOOP;

  FOREACH policy_name IN ARRAY required_policies LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND policyname = policy_name) THEN
      RAISE EXCEPTION 'Missing required RLS policy: %', policy_name;
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'access_requests'
      AND policyname = 'access_requests_public_insert' AND cmd = 'INSERT'
  ) THEN
    RAISE EXCEPTION 'access_requests_public_insert must be an INSERT policy';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_views
    WHERE schemaname = 'public' AND viewname = 'integration_status'
  ) THEN
    RAISE EXCEPTION 'Missing browser-safe integration_status view';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'current_user_church_id'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'current_user_role'
  ) THEN
    RAISE EXCEPTION 'Required assignment RLS helper function is missing';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND roles && ARRAY['anon']::name[]
      AND NOT (tablename = 'access_requests' AND policyname = 'access_requests_public_insert')
  ) THEN
    RAISE EXCEPTION 'Unexpected anonymous policy found outside access_requests';
  END IF;
END $$;

-- Manual isolation test (required before public NFC routes):
-- 1. Create two staging Auth users and attach them with the commented seed SQL.
-- 2. Sign in as Northside: members returns Alex Northside only; Riverbend data
--    cannot be selected/updated/deleted.
-- 3. Sign in as Riverbend viewer: members returns Alex Riverbend only; selecting
--    assignment_notes and writing assignments/outreach_status returns no rows or
--    an RLS error.
-- 4. Test `access_requests` with anon: INSERT succeeds; SELECT/UPDATE/DELETE fail.
