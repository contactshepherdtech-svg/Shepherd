-- Core tables that predate the checked-in feature migrations.
-- This baseline makes a fresh Supabase project reproducible without running
-- the legacy Python ORM initializer against a production database.

CREATE TABLE IF NOT EXISTS public.churches (
  id BIGSERIAL PRIMARY KEY,
  name TEXT,
  planning_center_org_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.members (
  id BIGSERIAL PRIMARY KEY,
  church_id INTEGER REFERENCES public.churches(id) ON DELETE CASCADE,
  pco_id TEXT,
  name TEXT,
  email TEXT,
  status TEXT,
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.attendance (
  id BIGSERIAL PRIMARY KEY,
  church_id INTEGER REFERENCES public.churches(id) ON DELETE CASCADE,
  pco_checkin_id TEXT,
  member_pco_id TEXT,
  attended_at TIMESTAMPTZ,
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.risk_scores (
  id BIGSERIAL PRIMARY KEY,
  church_id INTEGER REFERENCES public.churches(id) ON DELETE CASCADE,
  member_pco_id TEXT,
  score INTEGER,
  tier TEXT,
  reasons TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.church_settings (
  id BIGSERIAL PRIMARY KEY,
  church_id INTEGER REFERENCES public.churches(id) ON DELETE CASCADE,
  church_name TEXT,
  main_service_frequency TEXT,
  watch_missed_services INTEGER,
  at_risk_missed_services INTEGER,
  critical_missed_services INTEGER,
  small_groups_enabled BOOLEAN,
  small_group_frequency TEXT,
  volunteer_tracking_enabled BOOLEAN,
  volunteer_importance TEXT,
  giving_enabled BOOLEAN,
  email_engagement_enabled BOOLEAN,
  preferred_followup_style TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.integration_tokens (
  id BIGSERIAL PRIMARY KEY,
  church_id INTEGER REFERENCES public.churches(id) ON DELETE CASCADE,
  provider TEXT,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  scope TEXT,
  connection_status TEXT DEFAULT 'connected',
  last_sync_at TIMESTAMPTZ,
  members_imported INTEGER DEFAULT 0,
  attendance_imported INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
