-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- It is idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS public.church_users (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  church_id   INTEGER NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'admin',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, church_id)
);

CREATE INDEX IF NOT EXISTS church_users_user_id_idx
  ON public.church_users (user_id);

CREATE INDEX IF NOT EXISTS church_users_church_id_idx
  ON public.church_users (church_id);

-- RLS: each user can only see and manage their own rows
ALTER TABLE public.church_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "church_users_select_own"
  ON public.church_users FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY IF NOT EXISTS "church_users_insert_own"
  ON public.church_users FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY IF NOT EXISTS "church_users_delete_own"
  ON public.church_users FOR DELETE
  USING (user_id = auth.uid());

-- churches: allow authenticated users to insert during signup
-- (no strict RLS on churches for Day 1 per requirements)
ALTER TABLE public.churches ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "churches_select_all"
  ON public.churches FOR SELECT
  USING (true);

CREATE POLICY IF NOT EXISTS "churches_insert_authenticated"
  ON public.churches FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY IF NOT EXISTS "churches_update_authenticated"
  ON public.churches FOR UPDATE
  USING (true);
