-- add_joke_authors (Milestone 5): who wrote each joke, when a signed-in user asked for it.
-- Both columns are optional, because a guest is not signed in.
-- The lock on public.jokes does not change: RLS on, no policy, access only for service_role.
-- Existing columns and rows are not touched.

-- 1. Two new columns
alter table public.jokes
  add column user_id     uuid references auth.users (id) on delete set null,
  add column author_name text;

-- 2. The name is empty (null), or 1 to 30 characters after trimming spaces
alter table public.jokes
  add constraint jokes_author_name_length
  check (author_name is null or char_length(btrim(author_name)) between 1 and 30);

-- 3. Fast lookup of a user's jokes (used when deleting an account)
create index jokes_user_id_idx on public.jokes (user_id);
