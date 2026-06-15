-- 012_visitor_followup_drafts.sql
-- First-time visitor follow-up flow (item 4): track the Gmail draft prepared for
-- a member's follow-up directly on the existing outreach_status row.
--
-- We extend outreach_status (one row per church_id + member_pco_id) rather than
-- adding a table:
--   draft_created_at — when a Gmail draft was created for this member. The
--                      member is considered "Draft Created" when this is NOT NULL.
--   gmail_draft_id   — the Gmail draft id, so the UI can link to it.
--
-- ACCEPTED MVP LIMITATION: because there is one outreach_status row per member,
-- these two columns track only the MOST RECENT draft. A later follow-up cycle
-- (e.g. an at-risk draft months after the visitor draft) overwrites them. This
-- only drops our in-app pointer to the older draft — we never call Gmail
-- drafts.delete, so the older Gmail draft itself is untouched, just unlinked.
--
-- RLS: no policy change. outreach_status already has church-scoped
-- select/insert/update policies (migration 004). Reads use the authed client;
-- the draft-state write is done server-side with the service-role key in
-- app/api/gmail/create-draft, scoped to church_id + member_pco_id.
--
-- Idempotent — safe to re-run.

ALTER TABLE public.outreach_status
  ADD COLUMN IF NOT EXISTS draft_created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS gmail_draft_id   TEXT;
