-- Saved trips (Office, University, School…) shown with the next connections on the Bus tab.
-- Each end is either a Västtrafik stop (gid) or a place/address (coordinates).

create table public.trips (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  name         text not null check (char_length(name) between 1 and 40),
  icon         text not null default '📍' check (char_length(icon) between 1 and 8),
  from_name    text not null check (char_length(from_name) between 1 and 80),
  from_gid     text check (from_gid is null or from_gid ~ '^[0-9]{16}$'),
  from_lat     double precision check (from_lat is null or from_lat between -90 and 90),
  from_lon     double precision check (from_lon is null or from_lon between -180 and 180),
  to_name      text not null check (char_length(to_name) between 1 and 80),
  to_gid       text check (to_gid is null or to_gid ~ '^[0-9]{16}$'),
  to_lat       double precision check (to_lat is null or to_lat between -90 and 90),
  to_lon       double precision check (to_lon is null or to_lon between -180 and 180),
  walk_min     int  not null default 0 check (walk_min between 0 and 60),
  sort         int  not null default 0,
  created_at   timestamptz not null default now(),
  check (from_gid is not null or (from_lat is not null and from_lon is not null)),
  check (to_gid   is not null or (to_lat   is not null and to_lon   is not null))
);
create index trips_household_idx on public.trips (household_id);

alter table public.trips enable row level security;
create policy "members manage trips" on public.trips for all
  using (public.is_member(household_id)) with check (public.is_member(household_id));

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.trips;
  end if;
end $$;
