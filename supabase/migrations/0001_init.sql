-- Family Home Display: households, family members, items.
-- Every signed-in user can belong to one or more households; all data is
-- scoped to a household and protected by row-level security.

-- ---------- Tables ----------
create table public.households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 60),
  join_code   text not null unique default upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8)),
  vt_gid      text check (vt_gid is null or vt_gid ~ '^[0-9]{16}$'),
  vt_stop     text check (vt_stop is null or char_length(vt_stop) <= 80),
  place       text check (place is null or char_length(place) <= 80),
  lat         double precision check (lat is null or lat between -90 and 90),
  lon         double precision check (lon is null or lon between -180 and 180),
  created_by  uuid references auth.users on delete set null,
  created_at  timestamptz not null default now()
);

create table public.household_users (
  household_id uuid not null references public.households on delete cascade,
  user_id      uuid not null references auth.users on delete cascade,
  role         text not null default 'member' check (role in ('owner', 'member')),
  joined_at    timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index household_users_user_idx on public.household_users (user_id);

-- The people shown on the display (they don't need accounts: kids, grandparents...)
create table public.people (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  name         text not null check (char_length(name) between 1 and 40),
  color        text not null default '#8a8896' check (color ~ '^#[0-9a-fA-F]{6}$'),
  sort         int  not null default 0
);
create index people_household_idx on public.people (household_id);

create table public.items (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  type         text not null check (type in ('task', 'event', 'reminder')),
  title        text not null check (char_length(title) between 1 and 120),
  person_id    uuid references public.people on delete set null,
  date         date,
  time         time,
  repeat       text not null default 'none' check (repeat in ('none', 'daily', 'weekly')),
  done         boolean not null default false,
  done_on      text check (done_on is null or char_length(done_on) <= 10),
  countdown    boolean not null default false,
  created_by   uuid references auth.users on delete set null default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index items_household_idx on public.items (household_id);

create function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
create trigger items_touch before update on public.items
  for each row execute function public.touch_updated_at();

-- A person picked for an item must belong to the same household.
create function public.check_item_person() returns trigger language plpgsql
security definer set search_path = public as $$
begin
  if new.person_id is not null and not exists (
    select 1 from people where id = new.person_id and household_id = new.household_id) then
    raise exception 'person does not belong to this household';
  end if;
  return new;
end $$;
create trigger items_person_check before insert or update on public.items
  for each row execute function public.check_item_person();

-- ---------- Helpers ----------
create function public.is_member(h uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from household_users where household_id = h and user_id = auth.uid())
$$;

create function public.is_owner(h uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from household_users where household_id = h and user_id = auth.uid() and role = 'owner')
$$;

-- ---------- Row-level security ----------
alter table public.households      enable row level security;
alter table public.household_users enable row level security;
alter table public.people          enable row level security;
alter table public.items           enable row level security;

create policy "members read household"   on public.households for select using (public.is_member(id));
create policy "members update household" on public.households for update using (public.is_member(id)) with check (public.is_member(id));
create policy "owner deletes household"  on public.households for delete using (public.is_owner(id));
-- households are created only through create_household()

create policy "members see each other" on public.household_users for select using (public.is_member(household_id));
create policy "leave or owner removes" on public.household_users for delete
  using (user_id = auth.uid() or public.is_owner(household_id));
-- memberships are added only through create_household() / join_household()

create policy "members manage people" on public.people for all
  using (public.is_member(household_id)) with check (public.is_member(household_id));
create policy "members manage items" on public.items for all
  using (public.is_member(household_id)) with check (public.is_member(household_id));

-- Members may not change the join code or who created the household.
revoke update on public.households from authenticated, anon;
grant  update (name, vt_gid, vt_stop, place, lat, lon) on public.households to authenticated;

-- ---------- Create / join ----------
create function public.create_household(p_name text) returns public.households
language plpgsql security definer set search_path = public as $$
declare h households;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into households (name, created_by) values (trim(p_name), auth.uid()) returning * into h;
  insert into household_users (household_id, user_id, role) values (h.id, auth.uid(), 'owner');
  return h;
end $$;

create function public.join_household(p_code text) returns public.households
language plpgsql security definer set search_path = public as $$
declare h households;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into h from households where join_code = upper(trim(p_code));
  if not found then raise exception 'No household with that code'; end if;
  insert into household_users (household_id, user_id) values (h.id, auth.uid()) on conflict do nothing;
  return h;
end $$;

-- Owner can issue a new code (e.g. after sharing it too widely).
create function public.new_join_code(h uuid) returns text
language plpgsql security definer set search_path = public as $$
declare c text := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
begin
  if not is_owner(h) then raise exception 'only the owner can do that'; end if;
  update households set join_code = c where id = h;
  return c;
end $$;

revoke execute on function public.create_household(text), public.join_household(text), public.new_join_code(uuid) from public, anon;
grant  execute on function public.create_household(text), public.join_household(text), public.new_join_code(uuid) to authenticated;

-- ---------- Live sync ----------
alter table public.items  replica identity full;
alter table public.people replica identity full;
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.items, public.people, public.households;
  end if;
end $$;
