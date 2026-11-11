-- create_jokes: the table that remembers every AI joke and counts laughs.
-- Only our Vercel functions use it, with the secret key (role service_role).
-- The public publishable key (roles anon, authenticated) gets nothing.

-- 1. The table
create table public.jokes (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  topic      text,
  text       text not null,
  laughs     integer not null default 0
);

-- 2. Lock the rows. No policies on purpose: nobody from the browser may read or write.
alter table public.jokes enable row level security;

-- 3. Table access: only service_role. Since 30.10.2026 Supabase no longer grants this automatically.
revoke all on public.jokes from anon, authenticated;
grant select, insert, update on public.jokes to service_role;

-- 4. +1 laugh in one step, so two clicks at the same moment are both counted
create or replace function public.add_laugh(joke_id uuid)
returns integer
language sql
security invoker
set search_path = ''
as $$
  update public.jokes
     set laughs = laughs + 1
   where id = joke_id
  returning laughs;
$$;

-- 5. Only our server may call it. Postgres lets everyone run new functions by default.
revoke execute on function public.add_laugh(uuid) from public, anon, authenticated;
grant execute on function public.add_laugh(uuid) to service_role;
