-- Fix multi-tenant unique constraints: replace global unique indexes
-- with church-scoped composite unique indexes so multiple churches
-- can have the same PCO IDs without collision.

-- Drop global unique indexes (created by SQLAlchemy unique=True + index=True)
DROP INDEX IF EXISTS ix_attendance_pco_checkin_id;
DROP INDEX IF EXISTS ix_members_pco_id;
DROP INDEX IF EXISTS ix_risk_scores_member_pco_id;
DROP INDEX IF EXISTS ix_integration_tokens_provider;

-- Drop any standalone unique constraints that may exist under generated names
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT conname, conrelid::regclass AS tbl
        FROM pg_constraint
        WHERE contype = 'u'
          AND conrelid IN ('attendance'::regclass, 'members'::regclass,
                           'risk_scores'::regclass, 'integration_tokens'::regclass)
          AND conname NOT IN (
              'uq_attendance_church_pco_checkin',
              'uq_members_church_pco_id',
              'uq_risk_scores_church_member_pco_id',
              'uq_integration_tokens_church_provider'
          )
    LOOP
        EXECUTE format('ALTER TABLE %s DROP CONSTRAINT IF EXISTS %I', r.tbl, r.conname);
    END LOOP;
END$$;

-- Create church-scoped composite unique indexes
CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_church_pco_checkin
    ON attendance(church_id, pco_checkin_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_members_church_pco_id
    ON members(church_id, pco_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_risk_scores_church_member_pco_id
    ON risk_scores(church_id, member_pco_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_integration_tokens_church_provider
    ON integration_tokens(church_id, provider);
