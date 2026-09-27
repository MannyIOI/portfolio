-- Pipeline Runner leaderboard (Supabase project "portfolio", eu-central-1).
-- Applied as migrations pipeline_runner_leaderboard, leaderboard_anon_only and
-- leaderboard_global_cap_and_cleanup, then leaderboard_one_row_per_name (see the bottom of this file). The table is private (RLS on, no policies);
-- the browser can only call get_top_scores() and submit_score() with the publishable key.

create extension if not exists pgcrypto with schema extensions;

create table public.pipeline_scores (
  id          bigint generated always as identity primary key,
  name        text        not null check (char_length(name) between 2 and 16),
  score       integer     not null check (score between 1 and 500000),
  distance    integer     not null check (distance >= 0),
  records     integer     not null check (records >= 0),
  duration_s  numeric(8,2) not null check (duration_s > 0),
  ip_hash     text,
  created_at  timestamptz not null default now()
);
create index pipeline_scores_top on public.pipeline_scores (score desc, created_at asc);
create index pipeline_scores_ip_time on public.pipeline_scores (ip_hash, created_at desc);
alter table public.pipeline_scores enable row level security;
revoke all on public.pipeline_scores from anon, authenticated;

create or replace function public.get_top_scores(max_rows integer default 10)
returns table (rank bigint, name text, score integer, distance integer, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select row_number() over (order by s.score desc, s.created_at asc) as rank,
         s.name, s.score, s.distance, s.created_at
  from public.pipeline_scores s
  order by s.score desc, s.created_at asc
  limit least(greatest(coalesce(max_rows, 10), 1), 50);
$$;

create or replace function public.submit_score(
  p_name text, p_score integer, p_distance integer, p_records integer, p_duration_s numeric
)
returns table (rank bigint, total bigint)
language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  v_name text; v_ip text; v_hash text; v_base integer; v_bonus integer; v_recent integer;
begin
  v_name := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
  if char_length(v_name) < 2 or char_length(v_name) > 16 or v_name !~ '^[[:alnum:] ._''-]+$' then
    raise exception 'invalid_name' using errcode = '22023';
  end if;
  if lower(v_name) ~ '(fuck|shit|cunt|nigg|fag|bitch|rape|nazi|porn|dick|cock|pussy|slut|whore)' then
    raise exception 'invalid_name' using errcode = '22023';
  end if;

  -- score = floor(distance / 2) + bonus, each record worth 25..125 (x1..x5 combo);
  -- speed runs 14 -> 40 units/s; runs are capped at an hour
  if p_score is null or p_distance is null or p_records is null or p_duration_s is null
     or p_score < 1 or p_distance < 0 or p_records < 0
     or p_duration_s <= 0 or p_duration_s > 3600 then
    raise exception 'implausible_run' using errcode = '22023';
  end if;
  v_base  := floor(p_distance / 2.0);
  v_bonus := p_score - v_base;
  if v_bonus < p_records * 25 or v_bonus > p_records * 125
     or p_distance > p_duration_s * 40 + 10
     or p_distance < p_duration_s * 13 - 30
     or p_records > p_distance / 2 + 5 then
    raise exception 'implausible_run' using errcode = '22023';
  end if;

  select count(*) into v_recent from public.pipeline_scores where created_at > now() - interval '1 minute';
  if v_recent >= 60 then raise exception 'rate_limited' using errcode = 'P0001'; end if;

  begin
    v_ip := split_part(coalesce(
      (current_setting('request.headers', true)::json ->> 'cf-connecting-ip'),
      (current_setting('request.headers', true)::json ->> 'x-forwarded-for'),
      'unknown'), ',', 1);
  exception when others then v_ip := 'unknown';
  end;
  v_hash := encode(digest('pipeline-runner:' || btrim(v_ip), 'sha256'), 'hex');
  select count(*) into v_recent from public.pipeline_scores
   where ip_hash = v_hash and created_at > now() - interval '10 minutes';
  if v_recent >= 5 then raise exception 'rate_limited' using errcode = 'P0001'; end if;

  insert into public.pipeline_scores (name, score, distance, records, duration_s, ip_hash)
  values (v_name, p_score, p_distance, p_records, round(p_duration_s, 2), v_hash);

  return query
    select (select count(*) from public.pipeline_scores s where s.score > p_score) + 1,
           (select count(*) from public.pipeline_scores);
end;
$$;

revoke all on function public.get_top_scores(integer) from public, authenticated;
revoke all on function public.submit_score(text, integer, integer, integer, numeric) from public, authenticated;
grant execute on function public.get_top_scores(integer) to anon;
grant execute on function public.submit_score(text, integer, integer, integer, numeric) to anon;

-- leaderboard_one_row_per_name: every run is kept, but the board shows one row per name
-- (case-insensitive), that name's best run, and submit_score ranks names by their best.
create index if not exists pipeline_scores_name_score on public.pipeline_scores (lower(name), score desc, created_at asc);

create or replace function public.get_top_scores(max_rows integer default 10)
returns table (rank bigint, name text, score integer, distance integer, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  with best as (
    select distinct on (lower(s.name)) s.name, s.score, s.distance, s.created_at
    from public.pipeline_scores s
    order by lower(s.name), s.score desc, s.created_at asc
  )
  select row_number() over (order by b.score desc, b.created_at asc) as rank,
         b.name, b.score, b.distance, b.created_at
  from best b
  order by b.score desc, b.created_at asc
  limit least(greatest(coalesce(max_rows, 10), 1), 50);
$$;
-- submit_score: same validation and limits as above; after the insert it now returns
--   rank  = 1 + number of other names whose best beats this name's best
--   total = number of distinct names

-- leaderboard_name_key_ignores_symbols: players are matched on name_key(name) = lowercase letters
-- and digits only, so "Happy", "happy!" and "Happy ❤️" are one player. A returning player's run is
-- stored under the name already on the board, so names edited by hand (e.g. adding an emoji) stick.
create or replace function public.name_key(n text) returns text
language sql immutable set search_path = public as $$
  select lower(regexp_replace(coalesce(n, ''), '[^[:alnum:]]', '', 'g'));
$$;
-- get_top_scores and submit_score group and rank by public.name_key(name).
