-- Run this in the Supabase SQL Editor.
--
-- IMPORTANT: also disable email confirmation in your Supabase project:
--   Auth → Providers → Email → toggle OFF "Confirm email"
-- The app uses synthesized emails (username@lordle.local), so confirmation
-- can never succeed and would block login.

-- ─── Tables ──────────────────────────────────────────────────────────────────

create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  email text unique,
  created_at timestamptz default now()
);

-- Case-insensitive email uniqueness (covers existing rows that differ only in case).
create unique index if not exists profiles_email_lower_idx
  on public.profiles (lower(email));

create table if not exists public.game_stats (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  score integer not null,
  attempts_used integer not null,
  word text not null,
  won boolean not null,
  time_remaining integer not null,
  played_at timestamptz default now()
);

create index if not exists game_stats_user_idx on public.game_stats (user_id, played_at desc);

create table if not exists public.player_summary (
  user_id uuid references auth.users on delete cascade primary key,
  total_games integer default 0 not null,
  total_wins integer default 0 not null,
  total_points integer default 0 not null,
  best_score integer default 0 not null,
  current_streak integer default 0 not null,
  max_streak integer default 0 not null
);

-- ─── Row Level Security ──────────────────────────────────────────────────────

alter table public.profiles       enable row level security;
alter table public.game_stats     enable row level security;
alter table public.player_summary enable row level security;

-- profiles: anyone can read (needed for leaderboards / username display);
-- users may only insert/update their own row.
drop policy if exists profiles_read_all   on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_read_all   on public.profiles for select using (true);
create policy profiles_insert_own on public.profiles for insert with check (auth.uid() = id);
create policy profiles_update_own on public.profiles for update using (auth.uid() = id);

-- game_stats: users may only see/insert their own rows.
drop policy if exists stats_select_own on public.game_stats;
drop policy if exists stats_insert_own on public.game_stats;
create policy stats_select_own on public.game_stats for select using (auth.uid() = user_id);
create policy stats_insert_own on public.game_stats for insert with check (auth.uid() = user_id);

-- player_summary: users may only see/insert/update their own row.
drop policy if exists summary_select_own on public.player_summary;
drop policy if exists summary_insert_own on public.player_summary;
drop policy if exists summary_update_own on public.player_summary;
create policy summary_select_own on public.player_summary for select using (auth.uid() = user_id);
create policy summary_insert_own on public.player_summary for insert with check (auth.uid() = user_id);
create policy summary_update_own on public.player_summary for update using (auth.uid() = user_id);

-- ─── Matches ─────────────────────────────────────────────────────────────────

alter table public.player_summary
  add column if not exists match_wins integer not null default 0;

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  challenger_id uuid not null references public.profiles(id) on delete cascade,
  opponent_id   uuid not null references public.profiles(id) on delete cascade,
  word text not null check (length(word) = 5),
  status text not null default 'pending'
    check (status in ('pending','accepted','completed','expired','rejected')),
  challenger_score   integer,
  opponent_score     integer,
  challenger_solved  boolean,
  opponent_solved    boolean,
  winner_id  uuid references public.profiles(id),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint matches_distinct_players check (challenger_id <> opponent_id)
);

create index if not exists matches_opponent_status_idx   on public.matches (opponent_id, status);
create index if not exists matches_challenger_status_idx on public.matches (challenger_id, status);

-- Prevent duplicate active matches between the same pair of players in either direction.
create unique index if not exists matches_active_pair_idx on public.matches (
  least(challenger_id, opponent_id),
  greatest(challenger_id, opponent_id)
) where status in ('pending', 'accepted');

alter table public.matches enable row level security;

drop policy if exists matches_select_involved   on public.matches;
drop policy if exists matches_insert_challenger on public.matches;
drop policy if exists matches_update_involved   on public.matches;
create policy matches_select_involved   on public.matches for select
  using (auth.uid() = challenger_id or auth.uid() = opponent_id);
create policy matches_insert_challenger on public.matches for insert
  with check (auth.uid() = challenger_id);
create policy matches_update_involved   on public.matches for update
  using (auth.uid() = challenger_id or auth.uid() = opponent_id)
  with check (auth.uid() = challenger_id or auth.uid() = opponent_id);

-- Allow either player to credit the winner's match_wins (cross-user write
-- bypasses RLS via SECURITY DEFINER). Caller passes the winner uuid.
create or replace function public.award_match_win(winner uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.player_summary (user_id, match_wins)
  values (winner, 1)
  on conflict (user_id) do update
    set match_wins = public.player_summary.match_wins + 1;
end;
$$;

revoke all on function public.award_match_win(uuid) from public;
grant execute on function public.award_match_win(uuid) to authenticated;
