-- Browser-safe projection of integration state. Credentials remain available
-- only to server-side service-role code through integration_tokens.

CREATE OR REPLACE VIEW public.integration_status
WITH (security_invoker = true)
AS
SELECT
  id,
  church_id,
  provider,
  connection_status,
  connected_email,
  expires_at,
  scope,
  last_sync_at,
  members_imported,
  attendance_imported,
  sync_status,
  sync_started_at,
  sync_error,
  created_at,
  updated_at,
  (access_token IS NOT NULL) AS has_access_token,
  (refresh_token IS NOT NULL) AS has_refresh_token
FROM public.integration_tokens;

REVOKE ALL ON public.integration_status FROM PUBLIC;
GRANT SELECT ON public.integration_status TO authenticated;
