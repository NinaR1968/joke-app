-- create_votes (Milestone 6): "like" and "dislike", one vote per user per joke.
-- Only our Vercel functions use it, with the secret key (role service_role).
-- The public publishable key (roles anon, authenticated) gets nothing.
-- public.jokes, the laughs column and add_laugh are not touched. The app just stops using them.

-- 1. The table. The primary key (user_id, joke_id) is what allows only one vote per user per joke.
create table public.votes (
  user_id  uuid        not null references auth.users (id) on delete cascade,
  joke_id  uuid        not null references public.jokes (id) on delete cascade,
  value    smallint    not null check (value in (-1, 1)),
  voted_at timestamptz not null default now(),
  primary key (user_id, joke_id)
);

-- 2. Fast counting of the votes of one joke
create index votes_joke_id_idx on public.votes (joke_id);

-- 3. Lock the rows. No policies on purpose: nobody from the browser may read or write.
alter table public.votes enable row level security;

-- 4. Table access: only service_role. Since 30.10.2026 Supabase no longer grants this automatically.
revoke all on public.votes from anon, authenticated;
grant select, insert, update, delete on public.votes to service_role;

-- 5. Cast a vote: 1 = like, -1 = dislike, 0 = take my vote back.
--    Returns the joke's new counts and my vote, in one row.
--    Errors: P0002 = no such joke (the API answers 404), 22023 = bad value or no voter (400).
create or replace function public.cast_vote(voter uuid, target uuid, new_value smallint)
returns table (likes integer, dislikes integer, my_vote smallint)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if voter is null then
    raise exception 'voter is required' using errcode = '22023';
  end if;
  if new_value is null or new_value not in (-1, 0, 1) then
    raise exception 'value must be -1, 0 or 1' using errcode = '22023';
  end if;
  if not exists (select 1 from public.jokes j where j.id = target) then
    raise exception 'joke not found' using errcode = 'P0002';
  end if;

  if new_value = 0 then
    delete from public.votes v
     where v.user_id = voter and v.joke_id = target;
  else
    insert into public.votes as v (user_id, joke_id, value)
    values (voter, target, new_value)
    on conflict (user_id, joke_id)
    do update set value = excluded.value, voted_at = now();
  end if;

  return query
    select count(*) filter (where v.value = 1)::integer,
           count(*) filter (where v.value = -1)::integer,
           (select m.value from public.votes m where m.user_id = voter and m.joke_id = target)
      from public.votes v
     where v.joke_id = target;
end;
$$;

-- 6. The lists: 'new' (newest first), 'top' (at least one like, by likes minus dislikes, then likes),
--    'liked' (only what the viewer liked, by when they liked it). viewer is null for a guest.
--    Never returns user_id. max_rows is kept between 1 and 50.
create or replace function public.joke_feed(viewer uuid, mode text, max_rows integer default 20)
returns table (
  id          uuid,
  created_at  timestamptz,
  topic       text,
  text        text,
  author_name text,
  likes       integer,
  dislikes    integer,
  my_vote     smallint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select j.id, j.created_at, j.topic, j.text, j.author_name,
         c.likes, c.dislikes, mine.value
    from public.jokes j
    cross join lateral (
      select count(*) filter (where v.value = 1)::integer  as likes,
             count(*) filter (where v.value = -1)::integer as dislikes
        from public.votes v
       where v.joke_id = j.id
    ) c
    left join public.votes mine
           on mine.joke_id = j.id and mine.user_id = joke_feed.viewer
   where case joke_feed.mode
           when 'new'   then true
           when 'top'   then c.likes >= 1
           when 'liked' then mine.value = 1
           else false
         end
   order by
     case when joke_feed.mode = 'top'   then c.likes - c.dislikes end desc nulls last,
     case when joke_feed.mode = 'top'   then c.likes end desc nulls last,
     case when joke_feed.mode = 'liked' then mine.voted_at end desc nulls last,
     j.created_at desc
   limit greatest(1, least(coalesce(joke_feed.max_rows, 20), 50));
$$;

-- 7. Only our server may call them. Postgres lets everyone run new functions by default.
revoke execute on function public.cast_vote(uuid, uuid, smallint) from public, anon, authenticated;
grant execute on function public.cast_vote(uuid, uuid, smallint) to service_role;

revoke execute on function public.joke_feed(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.joke_feed(uuid, text, integer) to service_role;
