-- Staging-only deterministic two-tenant fixture. Do not run against production.
-- It deliberately does not create auth.users; attach staging test users to the
-- returned church IDs using the commented church_users inserts below.

BEGIN;

INSERT INTO public.churches (name, planning_center_org_id)
SELECT v.name, v.planning_center_org_id
FROM (VALUES
  ('Northside Community Church (staging)', 'staging-northside'),
  ('Riverbend Fellowship (staging)', 'staging-riverbend')
) AS v(name, planning_center_org_id)
WHERE NOT EXISTS (
  SELECT 1 FROM public.churches c WHERE c.planning_center_org_id = v.planning_center_org_id
);

WITH northside AS (
  SELECT id FROM public.churches WHERE planning_center_org_id = 'staging-northside'
), riverbend AS (
  SELECT id FROM public.churches WHERE planning_center_org_id = 'staging-riverbend'
)
INSERT INTO public.members (church_id, pco_id, name, email, status, source, visitor_status, member_lifecycle)
SELECT id, 'shared-person-001', 'Alex Northside', 'alex@northside.example', 'active', 'seed', 'none', 'established_member' FROM northside
UNION ALL
SELECT id, 'shared-person-001', 'Alex Riverbend', 'alex@riverbend.example', 'active', 'seed', 'first_time', 'first_time_visitor' FROM riverbend
ON CONFLICT (church_id, pco_id) DO UPDATE
SET name = EXCLUDED.name, email = EXCLUDED.email, visitor_status = EXCLUDED.visitor_status,
    member_lifecycle = EXCLUDED.member_lifecycle;

COMMIT;

-- After creating two staging Auth users, bind one to each church:
-- INSERT INTO public.church_users (user_id, church_id, role)
-- SELECT '<northside-auth-user-uuid>', id, 'admin'
-- FROM public.churches WHERE planning_center_org_id = 'staging-northside';
-- INSERT INTO public.church_users (user_id, church_id, role)
-- SELECT '<riverbend-auth-user-uuid>', id, 'viewer'
-- FROM public.churches WHERE planning_center_org_id = 'staging-riverbend';
