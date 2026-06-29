-- Public "Request access" lead capture for the marketing landing page (/).
-- Anonymous visitors may INSERT a request; there is intentionally NO select/update/delete
-- policy, so the anon/authenticated keys cannot read leads back (only the service role,
-- used in the Supabase dashboard, can). This keeps captured emails private.

create table if not exists public.access_requests (
  id uuid primary key default gen_random_uuid(),
  church_name text not null,
  email text not null,
  created_at timestamptz not null default now()
);

alter table public.access_requests enable row level security;

-- Insert-only public policy. (No SELECT policy => reads are denied for anon/authenticated.)
drop policy if exists "access_requests_public_insert" on public.access_requests;
create policy "access_requests_public_insert"
  on public.access_requests
  for insert
  to anon, authenticated
  with check (true);
