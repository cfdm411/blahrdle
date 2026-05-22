-- ═══════════════════════════════════════════════════════════════════════════
-- Security migration — run AFTER supabase_schema.sql
-- Fixes C1: award_match_win had no auth check (any user could inflate wins)
-- Fixes C2: matches update policy allowed either player to write any column
--
-- After running this SQL, also deploy the updated src/lib/matches.js which
-- replaces the client-side finalizeMatch + saveMatchResult chain with calls
-- to save_match_result RPC, and finalizeExpiredMatches with process_expired_matches.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── 1. Remove the insecure award_match_win RPC ──────────────────────────────
-- Previously granted to 'authenticated' with no caller verification.
-- Win crediting is now done inside save_match_result / process_expired_matches.

revoke execute on function public.award_match_win(uuid) from authenticated;
drop function if exists public.award_match_win(uuid);


-- ─── 2. save_match_result ─────────────────────────────────────────────────────
-- Atomically writes the calling player's score, and finalises the match
-- (updating status + winner_id + crediting match_wins) when both have played.
-- Replaces the JS saveMatchResult + finalizeMatch + award_match_win chain.
--
-- Security guarantees:
--   • Caller must be a participant of the match (RLS + explicit check).
--   • Only the calling player's score columns are written.
--   • Finalization and winner-crediting happen inside the same transaction.
--   • Idempotent: returns null if the caller already saved.

create or replace function public.save_match_result(
  p_match_id uuid,
  p_score    integer,
  p_solved   boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match       public.matches%rowtype;
  v_is_challenger boolean;
  v_winner_id   uuid;
begin
  -- Signal the update trigger that this call is internal / trusted.
  perform set_config('lordle.internal_call', 'true', true);

  -- Lock the match row; verify caller is a participant of an accepted match.
  select * into v_match
  from   public.matches
  where  id     = p_match_id
    and  status = 'accepted'
    and  (challenger_id = auth.uid() or opponent_id = auth.uid())
  for update;

  if not found then
    return null;
  end if;

  v_is_challenger := v_match.challenger_id = auth.uid();

  -- Idempotency: if this player already submitted a score, no-op.
  if  v_is_challenger and v_match.challenger_score is not null then return null; end if;
  if not v_is_challenger and v_match.opponent_score   is not null then return null; end if;

  -- Write only the calling player's columns and reload the row.
  if v_is_challenger then
    update public.matches
       set challenger_score  = p_score,
           challenger_solved = p_solved
     where id = p_match_id
    returning * into v_match;
  else
    update public.matches
       set opponent_score  = p_score,
           opponent_solved = p_solved
     where id = p_match_id
    returning * into v_match;
  end if;

  -- Finalise when both players have now submitted.
  if v_match.challenger_score is not null
 and v_match.opponent_score   is not null
  then
    -- Winner logic mirrors pickWinner in the original JS.
    if      v_match.challenger_solved and not coalesce(v_match.opponent_solved, false) then
      v_winner_id := v_match.challenger_id;
    elsif   coalesce(v_match.opponent_solved, false) and not v_match.challenger_solved then
      v_winner_id := v_match.opponent_id;
    elsif   v_match.challenger_score > v_match.opponent_score then
      v_winner_id := v_match.challenger_id;
    elsif   v_match.opponent_score   > v_match.challenger_score then
      v_winner_id := v_match.opponent_id;
    else
      v_winner_id := null;   -- draw
    end if;

    update public.matches
       set status    = 'completed',
           winner_id = v_winner_id
     where id     = p_match_id
       and status = 'accepted';   -- guard against concurrent finalise

    if v_winner_id is not null then
      insert into public.player_summary (user_id, match_wins)
      values (v_winner_id, 1)
      on conflict (user_id) do update
        set match_wins = public.player_summary.match_wins + 1;
    end if;
  end if;

  return (select to_jsonb(m) from public.matches m where m.id = p_match_id);
end;
$$;

revoke all    on function public.save_match_result(uuid, integer, boolean) from public;
grant  execute on function public.save_match_result(uuid, integer, boolean) to   authenticated;


-- ─── 3. process_expired_matches ───────────────────────────────────────────────
-- Replaces the JS finalizeExpiredMatches client-side update chain.
-- Expires pending matches and finalises accepted ones that have run past
-- expires_at, including partial-result winner logic.

create or replace function public.process_expired_matches(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match     public.matches%rowtype;
  v_winner_id uuid;
begin
  perform set_config('lordle.internal_call', 'true', true);

  for v_match in
    select *
    from   public.matches
    where  (challenger_id = p_user_id or opponent_id = p_user_id)
      and  status in ('pending', 'accepted')
      and  expires_at < now()
    for update skip locked
  loop
    if v_match.status = 'pending' then
      update public.matches set status = 'expired' where id = v_match.id;

    else
      -- Accepted but expired: award the win to whoever has played (or by score).
      if    v_match.challenger_score is not null and v_match.opponent_score is null then
        v_winner_id := v_match.challenger_id;
      elsif v_match.opponent_score   is not null and v_match.challenger_score is null then
        v_winner_id := v_match.opponent_id;
      else
        if      coalesce(v_match.challenger_solved, false) and not coalesce(v_match.opponent_solved, false) then
          v_winner_id := v_match.challenger_id;
        elsif   coalesce(v_match.opponent_solved, false) and not coalesce(v_match.challenger_solved, false) then
          v_winner_id := v_match.opponent_id;
        elsif   coalesce(v_match.challenger_score, 0) > coalesce(v_match.opponent_score, 0) then
          v_winner_id := v_match.challenger_id;
        elsif   coalesce(v_match.opponent_score, 0) > coalesce(v_match.challenger_score, 0) then
          v_winner_id := v_match.opponent_id;
        else
          v_winner_id := null;
        end if;
      end if;

      update public.matches
         set status    = 'completed',
             winner_id = v_winner_id
       where id = v_match.id;

      if v_winner_id is not null then
        insert into public.player_summary (user_id, match_wins)
        values (v_winner_id, 1)
        on conflict (user_id) do update
          set match_wins = public.player_summary.match_wins + 1;
      end if;
    end if;
  end loop;
end;
$$;

revoke all    on function public.process_expired_matches(uuid) from public;
grant  execute on function public.process_expired_matches(uuid) to   authenticated;


-- ─── 4. Trigger: block unsafe direct writes to matches ───────────────────────
-- Prevents a client from bypassing the RPCs above to:
--   • write the opponent's score columns
--   • set status='completed' or winner_id directly
-- The only direct client update still allowed is an opponent accepting/rejecting
-- a pending match (status pending→accepted/rejected, no other columns changed).
-- SECURITY DEFINER RPCs bypass this trigger by setting lordle.internal_call.

create or replace function public.guard_match_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Trusted internal call (from save_match_result or process_expired_matches).
  if current_setting('lordle.internal_call', true) = 'true' then
    return new;
  end if;

  -- Permitted: opponent changes status pending → accepted / rejected.
  if old.status = 'pending' and new.status in ('accepted', 'rejected') then
    if auth.uid() != old.opponent_id then
      raise exception 'Only the opponent can accept or reject a match';
    end if;
    -- No other columns may change in this transition.
    if (new.challenger_score  is distinct from old.challenger_score  or
        new.opponent_score    is distinct from old.opponent_score    or
        new.challenger_solved is distinct from old.challenger_solved or
        new.opponent_solved   is distinct from old.opponent_solved   or
        new.winner_id         is distinct from old.winner_id) then
      raise exception 'Only status may change when accepting or rejecting a match';
    end if;
    return new;
  end if;

  raise exception 'Match score writes must use the save_match_result RPC';
end;
$$;

drop trigger if exists match_update_guard on public.matches;
create trigger match_update_guard
  before update on public.matches
  for each row execute function public.guard_match_update();
