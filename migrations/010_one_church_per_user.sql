-- 010_one_church_per_user.sql
-- Enforce one church per user at the database level.
--
-- Background: church_users only had UNIQUE (user_id, church_id) (migration 003),
-- which blocks duplicate (user, church) pairs but NOT a single user being linked
-- to multiple DIFFERENT churches. Combined with the non-atomic check-then-insert
-- in the onboarding/create-workspace route, concurrent submissions could each
-- create a brand-new church for the same user. This migration makes that
-- physically impossible.
--
-- =====================================================================
-- ORDER OF OPERATIONS — READ BEFORE RUNNING
-- =====================================================================
-- The unique index in STEP 3 will FAIL if any user is still linked to more than
-- one church. You MUST dedupe first:
--
--   STEP 1  — Run the diagnostic SELECTs, review who is affected.
--   STEP 2  — Run the generator query, review the DELETE statements it prints,
--             then run those DELETEs MANUALLY (they are not executed here).
--   STEP 3  — Only after STEP 2, run the CREATE UNIQUE INDEX.
--
-- Do NOT run STEP 3 before STEP 2 completes, or it will error out.
-- =====================================================================


-- ---------------------------------------------------------------------
-- STEP 1 — Diagnostics (read-only). Review before touching anything.
-- ---------------------------------------------------------------------

-- 1a. Users linked to more than one church.
SELECT user_id,
       COUNT(*)                              AS church_count,
       array_agg(church_id ORDER BY id)      AS church_ids
FROM public.church_users
GROUP BY user_id
HAVING COUNT(*) > 1;

-- 1b. For each duplicated user, data volume per church (helps confirm the keeper).
SELECT cu.user_id,
       cu.church_id,
       (SELECT COUNT(*) FROM public.members m            WHERE m.church_id = cu.church_id) AS members,
       (SELECT COUNT(*) FROM public.integration_tokens t WHERE t.church_id = cu.church_id) AS tokens,
       cu.created_at
FROM public.church_users cu
WHERE cu.user_id IN (
  SELECT user_id FROM public.church_users GROUP BY user_id HAVING COUNT(*) > 1
)
ORDER BY cu.user_id, members DESC, tokens DESC, cu.created_at ASC;


-- ---------------------------------------------------------------------
-- STEP 2 — Generate (do NOT auto-run) the dedupe DELETE statements.
--
-- Keeper selection per user, in order:
--   1. highest member count
--   2. then token presence (more integration_tokens wins)
--   3. then earliest created_at
--   4. then lowest id  (final deterministic tie-breaker)
--
-- This prints one DELETE per losing church_users row. Copy the output,
-- REVIEW it line by line, then run the DELETEs MANUALLY. Nothing below
-- deletes anything on its own.
--
-- NOTE: this removes only the losing church_users links (enough to satisfy
-- the unique index). The now-orphaned churches rows are left in place; clean
-- those up separately if desired, after confirming nothing else references them.
-- ---------------------------------------------------------------------

WITH ranked AS (
  SELECT
    cu.id        AS church_user_id,
    cu.user_id,
    cu.church_id,
    ROW_NUMBER() OVER (
      PARTITION BY cu.user_id
      ORDER BY
        (SELECT COUNT(*) FROM public.members m            WHERE m.church_id = cu.church_id) DESC,
        (SELECT COUNT(*) FROM public.integration_tokens t WHERE t.church_id = cu.church_id) DESC,
        cu.created_at ASC,
        cu.id ASC
    ) AS rn
  FROM public.church_users cu
  WHERE cu.user_id IN (
    SELECT user_id FROM public.church_users GROUP BY user_id HAVING COUNT(*) > 1
  )
)
SELECT string_agg(
         format(
           'DELETE FROM public.church_users WHERE id = %s;  -- user %s, drop church %s',
           church_user_id, user_id, church_id
         ),
         E'\n'
         ORDER BY user_id, church_user_id
       ) AS review_then_run_these_deletes
FROM ranked
WHERE rn > 1;


-- ---------------------------------------------------------------------
-- STEP 3 — Enforce one church per user. Run ONLY after STEP 2 is done.
-- ---------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS uq_church_users_user_id
  ON public.church_users (user_id);
