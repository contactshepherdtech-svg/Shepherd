-- Durable staff invitation record. All invitation access goes through scoped
-- server routes using the service-role client; no browser policy is granted.

CREATE TABLE IF NOT EXISTS public.church_invitations (
  id              BIGSERIAL PRIMARY KEY,
  church_id       INTEGER NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  role            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',
  invited_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  token           UUID NOT NULL DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ,
  accepted_at     TIMESTAMPTZ
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'church_invitations_role_check'
  ) THEN
    ALTER TABLE public.church_invitations
      ADD CONSTRAINT church_invitations_role_check CHECK (role IN ('admin', 'pastor', 'viewer'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'church_invitations_status_check'
  ) THEN
    ALTER TABLE public.church_invitations
      ADD CONSTRAINT church_invitations_status_check CHECK (status IN ('pending', 'accepted', 'declined', 'revoked'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS church_invitations_token_idx
  ON public.church_invitations (token);
CREATE UNIQUE INDEX IF NOT EXISTS church_invitations_one_pending_email_idx
  ON public.church_invitations (church_id, lower(email)) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS church_invitations_church_status_idx
  ON public.church_invitations (church_id, status);

ALTER TABLE public.church_invitations ENABLE ROW LEVEL SECURITY;
