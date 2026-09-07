# Environment variables

Use `.env.example` as the complete local-development template. Keep production
and staging in separate secret stores; never copy a production service-role key
to staging or commit any `.env` file.

| Variable | Required by | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | frontend and API routes | Project URL. It is safe to expose to the browser. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | frontend and API routes | Browser public/anon key; RLS is the protection boundary. |
| `SUPABASE_SERVICE_ROLE_KEY` | server routes | Server-only. Bypasses RLS; do not prefix with `NEXT_PUBLIC_`. |
| `PLANNING_CENTER_CLIENT_ID`, `PLANNING_CENTER_CLIENT_SECRET`, `PLANNING_CENTER_REDIRECT_URI` | Planning Center OAuth | Redirect URI must match the provider registration exactly. |
| `PLANNING_CENTER_SYNC_MAX_PAGES` | sync route | Optional positive cap; defaults in code when absent. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` | Gmail OAuth | Redirect URI must match Google registration exactly. |
| `OAUTH_STATE_SECRET` | OAuth connect/callback routes | Required in production; use a random secret distinct from OAuth client secrets. |
| `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` | Ask and outreach generation | The model has a code default; the key is required only for those features. |
| `DATABASE_URL` | Python ingestion/scoring | Supabase Postgres connection string. |
| `SHEPHERD_ACTIVE_CHURCH_ID` | Python ingestion/scoring | Optional explicit tenant. Prevents legacy default-church backfill. |

For staging, configure every `NEXT_PUBLIC_SUPABASE_*`, server-only Supabase,
and OAuth redirect value for the staging project and staging hostname. Do not
point staging at production Supabase.
