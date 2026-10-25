-- Safe workshop scoring setup. Review the diagnostic result sets first.
-- This script never changes public.games, public.game_scores, or public.app_settings.
-- It preserves existing workshop_teams rows, and only creates missing workshop
-- tables or the save function. Existing workshop tables/functions are retained.

-- 1) Compare the live team IDs with the IDs used by the app and this script.
select
  expected.name,
  expected.id as expected_id,
  team.id as actual_id,
  expected.sort_order,
  team.sort_order as actual_sort_order,
  (team.id = expected.id and team.sort_order = expected.sort_order) as matches
from (values
  ('RYAN TEAM', '00000000-0000-4000-8000-000000000001'::uuid, 1::smallint),
  ('MUZI TEAM', '00000000-0000-4000-8000-000000000002'::uuid, 2::smallint),
  ('APEACH TEAM', '00000000-0000-4000-8000-000000000003'::uuid, 3::smallint)
) as expected(name, id, sort_order)
left join public.workshop_teams team on team.name = expected.name
order by expected.sort_order;

-- 2) Report current workshop table and required-column status before setup.
with required(table_name, column_name) as (
  values
    ('workshop_games', 'id'),
    ('workshop_games', 'name'),
    ('workshop_games', 'display_order'),
    ('workshop_games', 'created_at'),
    ('workshop_games', 'updated_at'),
    ('workshop_game_scores', 'game_id'),
    ('workshop_game_scores', 'team_id'),
    ('workshop_game_scores', 'score'),
    ('workshop_game_scores', 'updated_at')
)
select r.table_name, r.column_name, c.column_name is not null as exists
from required r
left join information_schema.columns c
  on c.table_schema = 'public'
 and c.table_name = r.table_name
 and c.column_name = r.column_name
order by r.table_name, r.column_name;

-- 3) Show whether the exact save-function signature already exists.
select
  p.oid::regprocedure as function_signature,
  pg_get_function_result(p.oid) as return_type,
  pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'mp2_save_workshop_game'
  and oidvectortypes(p.proargtypes) = 'uuid, text, jsonb';

-- Stop before DDL if the pre-existing team table does not contain exactly the
-- app's three fixed team IDs. No team rows are inserted, updated, or deleted.
do $$
begin
  if to_regclass('public.workshop_teams') is null then
    raise exception 'public.workshop_teams is missing; this script expects the existing team table';
  end if;
  if (select count(*) from public.workshop_teams) <> 3
     or exists (
       select 1
       from (values
         ('RYAN TEAM', '00000000-0000-4000-8000-000000000001'::uuid, 1::smallint),
         ('MUZI TEAM', '00000000-0000-4000-8000-000000000002'::uuid, 2::smallint),
         ('APEACH TEAM', '00000000-0000-4000-8000-000000000003'::uuid, 3::smallint)
       ) as expected(name, id, sort_order)
       left join public.workshop_teams actual
         on actual.name = expected.name
        and actual.id = expected.id
        and actual.sort_order = expected.sort_order
       where actual.id is null
     ) then
    raise exception 'workshop_teams does not exactly match the three app team IDs/names/order; no setup was applied';
  end if;
end;
$$;

-- If the exact function signature already exists, reject incompatible
-- security/return behavior before any table or policy setup is applied.
do $$
declare
  existing_function oid := to_regprocedure('public.mp2_save_workshop_game(uuid,text,jsonb)');
  function_body text;
begin
  if existing_function is not null then
    select lower(pg_get_functiondef(existing_function)) into function_body;
    if (select prorettype <> 'uuid'::regtype or prosecdef
        from pg_proc where oid = existing_function)
       or function_body not like '%security invoker%'
       or function_body not like '%workshop_games%'
       or function_body not like '%workshop_game_scores%'
       or function_body not like '%display_order%'
       or function_body not like '%00000000-0000-4000-8000-000000000001%'
       or function_body not like '%00000000-0000-4000-8000-000000000002%'
       or function_body not like '%00000000-0000-4000-8000-000000000003%'
       or function_body not like '%workshop_role%'
    then
      raise exception 'Existing mp2_save_workshop_game(uuid, text, jsonb) is incompatible with this setup; no table setup was applied';
    end if;
  end if;
end;
$$;

-- If either game table already exists, refuse to proceed when its required
-- columns are incomplete. Existing tables are never altered by this script.
do $$
declare
  missing_columns text;
begin
  if to_regclass('public.workshop_games') is not null then
    select string_agg(column_name, ', ' order by column_name) into missing_columns
    from (values ('id'), ('name'), ('display_order'), ('created_at'), ('updated_at')) as required(column_name)
    where not exists (
      select 1 from information_schema.columns c
      where c.table_schema = 'public' and c.table_name = 'workshop_games'
        and c.column_name = required.column_name
    );
    if missing_columns is not null then
      raise exception 'Existing public.workshop_games is missing columns: %; inspect and reconcile manually', missing_columns;
    end if;
  end if;
  if to_regclass('public.workshop_game_scores') is not null then
    select string_agg(column_name, ', ' order by column_name) into missing_columns
    from (values ('game_id'), ('team_id'), ('score'), ('updated_at')) as required(column_name)
    where not exists (
      select 1 from information_schema.columns c
      where c.table_schema = 'public' and c.table_name = 'workshop_game_scores'
        and c.column_name = required.column_name
    );
    if missing_columns is not null then
      raise exception 'Existing public.workshop_game_scores is missing columns: %; inspect and reconcile manually', missing_columns;
    end if;
  end if;
end;
$$;

create table if not exists public.workshop_games (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 80),
  display_order integer not null check (display_order > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workshop_game_scores (
  game_id uuid not null references public.workshop_games(id) on delete cascade,
  team_id uuid not null references public.workshop_teams(id),
  score integer not null default 0 check (score >= 0),
  updated_at timestamptz not null default now(),
  primary key (game_id, team_id)
);

alter table public.workshop_teams enable row level security;
alter table public.workshop_games enable row level security;
alter table public.workshop_game_scores enable row level security;

-- Add policies only when absent; preserve any existing workshop policies.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'workshop_teams' and policyname = 'workshop teams are readable') then
    create policy "workshop teams are readable" on public.workshop_teams for select to anon, authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'workshop_games' and policyname = 'workshop games are readable') then
    create policy "workshop games are readable" on public.workshop_games for select to anon, authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'workshop_game_scores' and policyname = 'workshop game scores are readable') then
    create policy "workshop game scores are readable" on public.workshop_game_scores for select to anon, authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'workshop_games' and policyname = 'workshop admins manage games') then
    create policy "workshop admins manage games" on public.workshop_games for all to authenticated
      using ((select auth.jwt() -> 'app_metadata' ->> 'workshop_role') = 'admin')
      with check ((select auth.jwt() -> 'app_metadata' ->> 'workshop_role') = 'admin');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'workshop_game_scores' and policyname = 'workshop admins manage game scores') then
    create policy "workshop admins manage game scores" on public.workshop_game_scores for all to authenticated
      using ((select auth.jwt() -> 'app_metadata' ->> 'workshop_role') = 'admin')
      with check ((select auth.jwt() -> 'app_metadata' ->> 'workshop_role') = 'admin');
  end if;
end;
$$;

-- Grants are limited to workshop_* objects; unrelated public tables are untouched.
grant select on public.workshop_teams, public.workshop_games, public.workshop_game_scores to anon, authenticated;
grant insert, update, delete on public.workshop_games, public.workshop_game_scores to authenticated;

-- Create the function only when this exact signature is absent; compatible
-- existing definitions were checked above and are preserved.
do $$
begin
  if to_regprocedure('public.mp2_save_workshop_game(uuid,text,jsonb)') is null then
    execute $function$
      create function public.mp2_save_workshop_game(p_game_id uuid, p_name text, p_scores jsonb)
      returns uuid
      language plpgsql
      security invoker
      set search_path = ''
      as $body$
      declare saved_game_id uuid;
      begin
        if (select auth.jwt() -> 'app_metadata' ->> 'workshop_role') is distinct from 'admin' then
          raise exception 'Only the workshop administrator can change scores' using errcode = '42501';
        end if;
        if p_name is null or char_length(trim(p_name)) not between 1 and 80 then
          raise exception 'Game name must contain between 1 and 80 characters';
        end if;
        if p_scores is null or jsonb_typeof(p_scores) is distinct from 'object' then
          raise exception 'Scores must be a JSON object';
        end if;
        if (select count(*) from jsonb_object_keys(p_scores)) <> 3 then
          raise exception 'A score is required for each of the three teams';
        end if;
        if exists (
          select 1 from jsonb_each_text(p_scores) as entry(team_id, score_value)
          where entry.team_id not in (
            '00000000-0000-4000-8000-000000000001',
            '00000000-0000-4000-8000-000000000002',
            '00000000-0000-4000-8000-000000000003'
          ) or entry.score_value !~ '^[0-9]+$'
        ) then raise exception 'Scores must use the fixed team IDs and non-negative integer values'; end if;
        if (select count(*) from public.workshop_teams) <> 3 then
          raise exception 'The three workshop teams are not configured';
        end if;
        if p_game_id is null then
          insert into public.workshop_games (name, display_order)
          values (trim(p_name), coalesce((select max(display_order) + 1 from public.workshop_games), 1))
          returning id into saved_game_id;
        else
          update public.workshop_games set name = trim(p_name), updated_at = now()
          where id = p_game_id returning id into saved_game_id;
          if not found then raise exception 'Game record not found'; end if;
        end if;
        insert into public.workshop_game_scores (game_id, team_id, score, updated_at)
        select saved_game_id, entry.team_id::uuid, entry.score_value::integer, now()
        from jsonb_each_text(p_scores) as entry(team_id, score_value)
        on conflict (game_id, team_id) do update set score = excluded.score, updated_at = excluded.updated_at;
        return saved_game_id;
      end;
      $body$;
    $function$;
    revoke all privileges on function public.mp2_save_workshop_game(uuid, text, jsonb) from public, anon, authenticated;
    grant execute on function public.mp2_save_workshop_game(uuid, text, jsonb) to authenticated;
  else
    raise notice 'Compatible existing mp2_save_workshop_game(uuid, text, jsonb) preserved.';
  end if;
end;
$$;

-- Register only these workshop tables with Realtime, and only if needed.
do $$
declare table_name text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach table_name in array array['workshop_games', 'workshop_game_scores'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name) then
        execute format('alter publication supabase_realtime add table public.%I', table_name);
      end if;
    end loop;
  else
    raise notice 'supabase_realtime is absent; enable workshop_games and workshop_game_scores in Realtime settings if needed.';
  end if;
end;
$$;
