# Supabase schema (current application contract)

This document records the schema used by the current frontend. Migrations in
`migrations/` are the source of truth; apply them to an empty staging project in
numeric order, including the RLS foundation migration before the assignment
policies.

## Tenant model

`churches` is the tenant. `church_users` maps an Auth user to one church
(`uq_church_users_user_id`) and carries `admin`, `pastor`, or `viewer` role.
All tenant data has `church_id` and must be filtered by it in service-role code.

## Tables

| Table | Purpose | Tenant key |
| --- | --- | --- |
| `churches` | Church/workspace profile and Planning Center org ID | primary tenant |
| `church_users` | Auth membership and role | `church_id` |
| `church_invitations` | Invite token, email, role, status, inviter/claim timestamps | `church_id` |
| `members` | Planning Center people and lifecycle fields | `church_id` |
| `attendance` | Planning Center check-ins | `church_id` |
| `risk_scores` | Churn/risk result by member PCO ID | `church_id` |
| `church_settings` | Church-specific scoring/follow-up configuration | `church_id` |
| `integration_tokens` | OAuth credentials, connection and sync state | `church_id` |
| `integration_status` | Token-free, security-invoker view of integration state | `church_id` |
| `sync_history` | Completed sync-run audit log | `church_id` |
| `outreach_status` | Queue suppression, workflow and draft state | `church_id` |
| `outreach_history` | Generated/manual outreach record | `church_id` |
| `assignments` | Staff-owned member work item | `church_id` |
| `assignment_notes` | Assignment note, hidden from viewers | `church_id` |
| `access_requests` | Public marketing lead capture | intentionally public insert-only |

Important tenant-scoped uniqueness: `members(church_id, pco_id)`,
`attendance(church_id, pco_checkin_id)`, `risk_scores(church_id, member_pco_id)`,
and `integration_tokens(church_id, provider)`. Assignments permit one open item
per `(church_id, member_id)`.

## RLS contract

Authenticated users may only read rows in their membership church. Assignment
and note writes require `admin` or `pastor`; viewer note access is denied.
Only `access_requests` has an anonymous policy, and it is `INSERT` only. Server
routes using the service-role key bypass RLS, so they must resolve the caller and
scope every query to that caller's `church_id`.

Run `supabase/rls-audit.sql` after migrations on staging. The audit is required
before any NFC/public-route work; it checks that RLS is enabled, required policy
names exist, and no unexpected public policy exists. Then complete the manual
two-user isolation check described in that file.
