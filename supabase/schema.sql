create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  role text not null default 'player' check (role in ('player', 'admin', 'super_admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.game_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  score integer not null default 0 check (score >= 0),
  mission_step integer not null default 0,
  current_aed_id text,
  verified_ids text[] not null default '{}',
  photos jsonb not null default '{}'::jsonb,
  custom_aeds jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.aeds (
  id text primary key,
  lat double precision not null,
  lng double precision not null,
  name text not null,
  address text,
  city text,
  postcode text,
  validation_status text,
  validation_label text,
  function_state text,
  source_label text,
  is_custom boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.aed_validations (
  aed_id text primary key references public.aeds(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  validator_name text,
  photo_name text,
  metadata jsonb not null default '{}'::jsonb,
  validated_at timestamptz not null default now()
);

create table if not exists public.score_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  aed_id text,
  action text not null,
  points integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

drop trigger if exists game_states_touch_updated_at on public.game_states;
create trigger game_states_touch_updated_at
before update on public.game_states
for each row execute function public.touch_updated_at();

drop trigger if exists aeds_touch_updated_at on public.aeds;
create trigger aeds_touch_updated_at
before update on public.aeds
for each row execute function public.touch_updated_at();

create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'player')
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_profile_role() in ('admin', 'super_admin')
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_profile_role() = 'super_admin'
$$;

create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.role <> 'player' and not public.is_super_admin() then
    new.role = 'player';
  end if;

  if tg_op = 'UPDATE'
     and new.role <> old.role
     and not public.is_super_admin()
     and not (
       new.role = 'super_admin'
       and not exists (select 1 from public.profiles where role = 'super_admin')
     ) then
    raise exception 'Seul un super admin peut modifier les roles.';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard_role on public.profiles;
create trigger profiles_guard_role
before insert or update on public.profiles
for each row execute function public.guard_profile_role();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1), 'Joueur')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.set_user_role(target_user_id uuid, next_role text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  changed_profile public.profiles;
begin
  if not public.is_super_admin() then
    raise exception 'Seul un super admin peut modifier les roles.';
  end if;

  if next_role not in ('player', 'admin', 'super_admin') then
    raise exception 'Role invalide.';
  end if;

  update public.profiles
  set role = next_role
  where id = target_user_id
  returning * into changed_profile;

  return changed_profile;
end;
$$;

alter table public.profiles enable row level security;
alter table public.game_states enable row level security;
alter table public.aeds enable row level security;
alter table public.aed_validations enable row level security;
alter table public.score_events enable row level security;

drop policy if exists "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_self_or_admin"
on public.profiles for select
using (auth.uid() = id or public.is_admin());

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self"
on public.profiles for insert
with check (auth.uid() = id);

drop policy if exists "profiles_update_self_or_admin" on public.profiles;
create policy "profiles_update_self_or_admin"
on public.profiles for update
using (auth.uid() = id or public.is_admin())
with check (auth.uid() = id or public.is_admin());

drop policy if exists "game_states_select_self_or_admin" on public.game_states;
create policy "game_states_select_self_or_admin"
on public.game_states for select
using (auth.uid() = user_id or public.is_admin());

drop policy if exists "game_states_insert_self" on public.game_states;
create policy "game_states_insert_self"
on public.game_states for insert
with check (auth.uid() = user_id);

drop policy if exists "game_states_update_self" on public.game_states;
create policy "game_states_update_self"
on public.game_states for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "aeds_select_authenticated" on public.aeds;
create policy "aeds_select_authenticated"
on public.aeds for select
to authenticated
using (true);

drop policy if exists "aeds_insert_custom_self" on public.aeds;
create policy "aeds_insert_custom_self"
on public.aeds for insert
to authenticated
with check (is_custom = true and created_by = auth.uid());

drop policy if exists "aeds_update_admin" on public.aeds;
create policy "aeds_update_admin"
on public.aeds for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "aed_validations_select_authenticated" on public.aed_validations;
create policy "aed_validations_select_authenticated"
on public.aed_validations for select
to authenticated
using (true);

drop policy if exists "aed_validations_insert_self" on public.aed_validations;
create policy "aed_validations_insert_self"
on public.aed_validations for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "score_events_select_self_or_admin" on public.score_events;
create policy "score_events_select_self_or_admin"
on public.score_events for select
using (auth.uid() = user_id or public.is_admin());

drop policy if exists "score_events_insert_self" on public.score_events;
create policy "score_events_insert_self"
on public.score_events for insert
with check (auth.uid() = user_id);

grant select, insert on public.aeds to authenticated;
grant update on public.aeds to authenticated;
grant select, insert on public.aed_validations to authenticated;

create or replace view public.leaderboard_top5 as
select
  p.id as user_id,
  coalesce(nullif(p.display_name, ''), split_part(coalesce(p.email, ''), '@', 1), 'Joueur') as display_name,
  (coalesce(count(av.aed_id), 0) * 20)::integer as score,
  coalesce(count(av.aed_id), 0)::integer as validated_count,
  greatest(
    coalesce(gs.updated_at, p.updated_at, p.created_at),
    coalesce(max(av.validated_at), p.updated_at, p.created_at)
  ) as updated_at
from public.profiles p
left join public.game_states gs on gs.user_id = p.id
left join public.aed_validations av on av.user_id = p.id
group by p.id, p.display_name, p.email, p.created_at, p.updated_at, gs.score, gs.updated_at
having count(av.aed_id) > 0
order by coalesce(count(av.aed_id), 0) desc, updated_at asc
limit 5;

grant select on public.leaderboard_top5 to authenticated;

-- Apres la premiere inscription, designer le premier super admin avec :
-- update public.profiles set role = 'super_admin' where email = 'votre-email@example.com';
