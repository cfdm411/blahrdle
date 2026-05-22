-- Run once in Supabase SQL editor (after supabase_schema.sql).
-- Enables match leaderboard reads + PostgREST embed player_summary → profiles.

drop policy if exists summary_select_ranking on public.player_summary;
create policy summary_select_ranking on public.player_summary
  for select to authenticated
  using (true);

-- Point user_id at profiles so .select('..., profiles(username)') resolves.
alter table public.player_summary
  drop constraint if exists player_summary_user_id_fkey;

alter table public.player_summary
  add constraint player_summary_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;
