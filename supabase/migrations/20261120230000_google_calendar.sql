-- Google Calendar: each family member can connect their own Google account. Their
-- appointments show on the display, and appointments/reminders added on the display for
-- the person linked to that account are written to their Google Calendar.
-- All talking to Google happens in the `google` server function; the browser never sees a token.

create table public.google_accounts (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  user_id      uuid not null references auth.users on delete cascade,   -- who connected it
  person_id    uuid references public.people on delete set null,        -- whose dot the events get
  google_sub   text not null,
  email        text not null,
  -- [{ id, name, color, primary, write: bool (can add events), show: bool }]
  calendars    jsonb not null default '[]'::jsonb,
  write_cal    text,                                                     -- where new events go
  tz           text not null default 'Europe/Stockholm',
  synced_at    timestamptz,
  sync_error   text,
  created_at   timestamptz not null default now(),
  unique (household_id, google_sub)
);
create index google_accounts_household_idx on public.google_accounts (household_id);

-- Tokens live apart, with no policies at all: only the server function (service role) reads them.
create table public.google_tokens (
  account_id    uuid primary key references public.google_accounts on delete cascade,
  refresh_token text not null,
  access_token  text,
  expires_at    timestamptz
);
alter table public.google_tokens enable row level security;
revoke all on public.google_tokens from anon, authenticated;

alter table public.google_accounts enable row level security;
create policy "members see google accounts" on public.google_accounts for select using (public.is_member(household_id));
create policy "owner of the account changes it" on public.google_accounts for update
  using (user_id = auth.uid() and public.is_member(household_id)) with check (user_id = auth.uid() and public.is_member(household_id));
-- accounts are added and removed only through the server function
revoke insert, update, delete on public.google_accounts from anon, authenticated;
grant  update (person_id, calendars, write_cal) on public.google_accounts to authenticated;

create function public.check_google_person() returns trigger language plpgsql
security definer set search_path = public as $$
begin
  if new.person_id is not null and not exists (
    select 1 from people where id = new.person_id and household_id = new.household_id) then
    raise exception 'person does not belong to this household';
  end if;
  return new;
end $$;
create trigger google_accounts_person_check before insert or update on public.google_accounts
  for each row execute function public.check_google_person();

-- Items that came from, or were sent to, Google Calendar.
alter table public.items
  add column gcal_account uuid references public.google_accounts on delete set null,
  add column gcal_cal     text check (gcal_cal is null or char_length(gcal_cal) <= 300),
  add column gcal_event   text check (gcal_event is null or char_length(gcal_event) <= 300),
  add column gcal_key     text check (gcal_key is null or char_length(gcal_key) <= 600),  -- iCalUID + start, to show an event once even if two members see it
  add column dur_min      int  check (dur_min is null or dur_min between 0 and 20160);
create unique index items_gcal_key_idx on public.items (household_id, gcal_key);  -- NULLs don't clash
create index items_gcal_account_idx on public.items (gcal_account) where gcal_account is not null;

-- The Google link of an item is set only by the server function.
revoke update on public.items from authenticated, anon;
grant  update (household_id, type, title, person_id, date, time, repeat, done, done_on, countdown) on public.items to authenticated;
revoke insert on public.items from authenticated, anon;
grant  insert (household_id, type, title, person_id, date, time, repeat, done, done_on, countdown) on public.items to authenticated;

alter table public.google_accounts replica identity full;
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.google_accounts;
  end if;
end $$;
