-- Reward chart: kids earn "notes" for activities and spend them on rewards.
-- reward_items is the chart (things to earn and things to buy); reward_log is
-- every note earned (+) or spent (-). A person's balance is the sum of their log.

-- ---------- Tables ----------
create table public.reward_items (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  person_id    uuid references public.people on delete cascade,      -- null = everyone on the chart
  kind         text not null check (kind in ('earn', 'spend')),
  title        text not null check (char_length(title) between 1 and 80),
  icon         text check (icon is null or char_length(icon) <= 16),
  category     text check (category is null or char_length(category) <= 40),
  notes        int  not null check (notes between 1 and 1000),
  per          text not null default 'any' check (per in ('any', 'day', 'week')),  -- how often it can be earned
  sort         int  not null default 0,
  created_at   timestamptz not null default now()
);
create index reward_items_household_idx on public.reward_items (household_id);
create index reward_items_person_idx on public.reward_items (person_id);

create table public.reward_log (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  person_id    uuid not null references public.people on delete cascade,
  item_id      uuid references public.reward_items on delete set null,
  title        text not null check (char_length(title) between 1 and 80),
  icon         text check (icon is null or char_length(icon) <= 16),
  notes        int  not null check (notes <> 0 and notes between -1000 and 1000),
  day          date not null default current_date,           -- the family's local day it counts for
  created_by   uuid references auth.users on delete set null default auth.uid(),
  created_at   timestamptz not null default now()
);
create index reward_log_household_idx on public.reward_log (household_id, created_at desc);
create index reward_log_person_item_idx on public.reward_log (person_id, item_id, day);
create index reward_log_item_idx on public.reward_log (item_id);

-- Each person can save up for one reward.
alter table public.people add column goal_item uuid references public.reward_items on delete set null;
create index people_goal_item_idx on public.people (goal_item);

-- People (and goals) must belong to the same household as the row.
create function public.check_reward_person() returns trigger language plpgsql
security definer set search_path = '' as $$
begin
  if new.person_id is not null and not exists (
    select 1 from public.people where id = new.person_id and household_id = new.household_id) then
    raise exception 'person does not belong to this household';
  end if;
  return new;
end $$;
create trigger reward_items_person_check before insert or update on public.reward_items
  for each row execute function public.check_reward_person();
create trigger reward_log_person_check before insert or update on public.reward_log
  for each row execute function public.check_reward_person();

create function public.check_person_goal() returns trigger language plpgsql
security definer set search_path = '' as $$
begin
  if new.goal_item is not null and not exists (
    select 1 from public.reward_items where id = new.goal_item and household_id = new.household_id and kind = 'spend') then
    raise exception 'goal must be a reward in this household';
  end if;
  return new;
end $$;
create trigger people_goal_check before insert or update of goal_item on public.people
  for each row execute function public.check_person_goal();

-- ---------- Row-level security ----------
alter table public.reward_items enable row level security;
alter table public.reward_log   enable row level security;

create policy "members manage reward items" on public.reward_items for all
  using (public.is_member(household_id)) with check (public.is_member(household_id));
-- Members can read, add bonus/penalty rows and undo; earning and spending go through the functions below.
create policy "members read reward log" on public.reward_log for select using (public.is_member(household_id));
create policy "members add reward log" on public.reward_log for insert with check (public.is_member(household_id));
create policy "members undo reward log" on public.reward_log for delete using (public.is_member(household_id));

-- Balance per person; runs with the caller's rights so RLS applies.
create view public.reward_balances with (security_invoker = true) as
  select person_id, household_id, sum(notes)::int as balance
  from public.reward_log group by person_id, household_id;

-- ---------- Earn / spend ----------
-- p_day is the family's local date, sent by the display (the server runs in UTC).
create function public.reward_earn(p_item uuid, p_person uuid, p_day date) returns public.reward_log
language plpgsql security definer set search_path = '' as $$
declare it public.reward_items; r public.reward_log;
begin
  select * into it from public.reward_items where id = p_item;
  if not found or not public.is_member(it.household_id) then raise exception 'Not found'; end if;
  if it.kind <> 'earn' then raise exception 'That is a reward, not something to earn'; end if;
  if it.person_id is not null and it.person_id <> p_person then raise exception 'That is on someone else''s chart'; end if;
  if p_day not between current_date - 1 and current_date + 1 then raise exception 'Wrong date'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_person::text, 0));
  if it.per = 'day' and exists (select 1 from public.reward_log
      where person_id = p_person and item_id = it.id and day = p_day) then
    raise exception 'Already earned today';
  end if;
  if it.per = 'week' and exists (select 1 from public.reward_log
      where person_id = p_person and item_id = it.id and day between p_day - 7 and p_day + 7
        and to_char(day, 'IYYY-IW') = to_char(p_day, 'IYYY-IW')) then
    raise exception 'Already earned this week';
  end if;
  insert into public.reward_log (household_id, person_id, item_id, title, icon, notes, day)
    values (it.household_id, p_person, it.id, it.title, it.icon, it.notes, p_day) returning * into r;
  return r;
end $$;

create function public.reward_spend(p_item uuid, p_person uuid, p_day date) returns public.reward_log
language plpgsql security definer set search_path = '' as $$
declare it public.reward_items; r public.reward_log; bal int;
begin
  select * into it from public.reward_items where id = p_item;
  if not found or not public.is_member(it.household_id) then raise exception 'Not found'; end if;
  if it.kind <> 'spend' then raise exception 'That is something to earn, not a reward'; end if;
  if it.person_id is not null and it.person_id <> p_person then raise exception 'That is on someone else''s chart'; end if;
  if p_day not between current_date - 1 and current_date + 1 then raise exception 'Wrong date'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_person::text, 0));
  select coalesce(sum(notes), 0) into bal from public.reward_log where person_id = p_person;
  if bal < it.notes then raise exception 'Not enough notes yet'; end if;
  insert into public.reward_log (household_id, person_id, item_id, title, icon, notes, day)
    values (it.household_id, p_person, it.id, it.title, it.icon, -it.notes, p_day) returning * into r;
  return r;
end $$;

revoke execute on function public.reward_earn(uuid, uuid, date), public.reward_spend(uuid, uuid, date) from public, anon;
grant  execute on function public.reward_earn(uuid, uuid, date), public.reward_spend(uuid, uuid, date) to authenticated;

-- ---------- Live sync ----------
alter table public.reward_items replica identity full;
alter table public.reward_log   replica identity full;
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.reward_items, public.reward_log;
  end if;
end $$;
