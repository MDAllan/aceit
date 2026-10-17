-- ERTH 209 Study Site: run this ONCE in Supabase > SQL Editor > New query > Run.
-- Before running: change the two values marked CHANGE ME.

create table if not exists public.app_secrets (
  key text primary key,
  value text not null
);
alter table public.app_secrets enable row level security;  -- no policies = nobody can read it from the browser

insert into public.app_secrets (key, value) values
  ('access_code', 'madi@77'),                       -- the class access code
  ('admin_email', 'madihaa13h@gmail.com')           -- the admin account: sign up with THIS email
on conflict (key) do update set value = excluded.value;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  is_admin boolean not null default false,
  access_ok boolean not null default false,
  blocked boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.progress enable row level security;

-- helper: is the caller an admin?
create or replace function public.is_admin() returns boolean
language sql security definer set search_path = public stable as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- helper: may the caller use the site?
create or replace function public.can_use() returns boolean
language sql security definer set search_path = public stable as $$
  select coalesce((select access_ok and not blocked from public.profiles where id = auth.uid()), false);
$$;

-- new signups get a profile; the admin email is made admin automatically
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare adm text;
begin
  select value into adm from public.app_secrets where key = 'admin_email';
  insert into public.profiles (id, email, display_name, is_admin, access_ok)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
          lower(new.email) = lower(adm), lower(new.email) = lower(adm));
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- students type the access code after login; it is checked here, never in the browser
create or replace function public.redeem_code(code text) returns boolean
language plpgsql security definer set search_path = public as $$
declare real_code text; bl boolean;
begin
  if auth.uid() is null then return false; end if;
  select blocked into bl from public.profiles where id = auth.uid();
  if coalesce(bl, false) then return false; end if;
  select value into real_code from public.app_secrets where key = 'access_code';
  if code = real_code then
    update public.profiles set access_ok = true where id = auth.uid();
    return true;
  end if;
  return false;
end $$;

-- admin tools
create or replace function public.admin_set_blocked(uid uuid, flag boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  update public.profiles set blocked = flag where id = uid and not is_admin;
end $$;

create or replace function public.admin_delete_user(uid uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  if exists (select 1 from public.profiles where id = uid and is_admin) then raise exception 'cannot delete admin'; end if;
  delete from auth.users where id = uid;  -- cascades to profile + progress
end $$;

create or replace function public.admin_change_code(new_code text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  update public.app_secrets set value = new_code where key = 'access_code';
end $$;

-- row level security
drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for select using (id = auth.uid() or public.is_admin());

drop policy if exists "own progress read" on public.progress;
create policy "own progress read" on public.progress for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "own progress insert" on public.progress;
create policy "own progress insert" on public.progress for insert with check (user_id = auth.uid() and public.can_use());

drop policy if exists "own progress update" on public.progress;
create policy "own progress update" on public.progress for update using (user_id = auth.uid() and public.can_use());

grant execute on function public.redeem_code(text), public.is_admin(), public.can_use() to authenticated;
grant execute on function public.admin_set_blocked(uuid, boolean), public.admin_delete_user(uuid), public.admin_change_code(text) to authenticated;
-- Patch 1: fixes accounts that were created before the schema was installed (they had no profile row).
create or replace function public.ensure_profile() returns void
language plpgsql security definer set search_path = public as $$
declare adm text; u record;
begin
  if auth.uid() is null then return; end if;
  select value into adm from public.app_secrets where key = 'admin_email';
  select id, email, raw_user_meta_data into u from auth.users where id = auth.uid();
  insert into public.profiles (id, email, display_name, is_admin, access_ok)
  values (u.id, u.email, coalesce(u.raw_user_meta_data->>'name', split_part(u.email,'@',1)),
          lower(u.email) = lower(adm), lower(u.email) = lower(adm))
  on conflict (id) do nothing;
end $$;
grant execute on function public.ensure_profile() to authenticated;

-- one-time backfill for everyone who already signed up
insert into public.profiles (id, email, display_name, is_admin, access_ok)
select u.id, u.email, coalesce(u.raw_user_meta_data->>'name', split_part(u.email,'@',1)),
       lower(u.email) = lower((select value from public.app_secrets where key = 'admin_email')),
       lower(u.email) = lower((select value from public.app_secrets where key = 'admin_email'))
from auth.users u on conflict (id) do nothing;
-- Patch 2: separate access code for each class. Run once in Supabase > SQL Editor.
create table if not exists public.class_codes (
  class_id text primary key,
  code text not null
);
alter table public.class_codes enable row level security;      -- no policies: nobody can read it from the browser

create table if not exists public.class_access (
  user_id uuid not null references auth.users(id) on delete cascade,
  class_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, class_id)
);
alter table public.class_access enable row level security;
drop policy if exists "own access" on public.class_access;
create policy "own access" on public.class_access for select using (user_id = auth.uid() or public.is_admin());

-- ERTH 209 keeps the existing code. ASTR 207 gets a random code you can read and change in the Admin tab.
insert into public.class_codes (class_id, code)
select 'erth209', value from public.app_secrets where key = 'access_code'
on conflict (class_id) do nothing;
insert into public.class_codes (class_id, code)
values ('astr207', 'astr-' || substr(md5(random()::text), 1, 6))
on conflict (class_id) do nothing;

-- everyone who already unlocked the site keeps ERTH 209
insert into public.class_access (user_id, class_id)
select id, 'erth209' from public.profiles where access_ok or is_admin
on conflict do nothing;

-- being logged in is enough to use the site; classes are unlocked one by one
create or replace function public.can_use() returns boolean
language sql security definer set search_path = public stable as $$
  select coalesce((select not blocked from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.redeem_class_code(cid text, code text) returns boolean
language plpgsql security definer set search_path = public as $$
declare real_code text; bl boolean;
begin
  if auth.uid() is null then return false; end if;
  select blocked into bl from public.profiles where id = auth.uid();
  if coalesce(bl, false) then return false; end if;
  select c.code into real_code from public.class_codes c where c.class_id = cid;
  if real_code is not null and code = real_code then
    insert into public.class_access (user_id, class_id) values (auth.uid(), cid) on conflict do nothing;
    return true;
  end if;
  return false;
end $$;

create or replace function public.admin_set_class_code(cid text, new_code text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  insert into public.class_codes (class_id, code) values (cid, new_code)
  on conflict (class_id) do update set code = excluded.code;
end $$;

create or replace function public.admin_get_codes() returns table (class_id text, code text)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  return query select c.class_id, c.code from public.class_codes c order by c.class_id;
end $$;

grant execute on function public.redeem_class_code(text, text), public.admin_set_class_code(text, text), public.admin_get_codes() to authenticated;

-- (patch 3) join a class by typing only its code
create or replace function public.redeem_class_by_code(code text) returns text
language plpgsql security definer set search_path = public as $$
declare cid text; bl boolean;
begin
  if auth.uid() is null then return null; end if;
  select blocked into bl from public.profiles where id = auth.uid();
  if coalesce(bl, false) then return null; end if;
  select c.class_id into cid from public.class_codes c where c.code = code limit 1;
  if cid is null then return null; end if;
  insert into public.class_access (user_id, class_id) values (auth.uid(), cid) on conflict do nothing;
  return cid;
end $$;
grant execute on function public.redeem_class_by_code(text) to authenticated;

-- profile: let a student change their own display name
create or replace function public.set_my_name(new_name text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  update public.profiles set display_name = left(trim(new_name), 40) where id = auth.uid();
end $$;
grant execute on function public.set_my_name(text) to authenticated;
-- Patch 4: lets a student delete their own account (privacy). Safe to run more than once.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then return; end if;
  if exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    raise exception 'admin accounts cannot be deleted here';
  end if;
  delete from auth.users where id = auth.uid();   -- also removes the profile, progress and class access
end $$;
grant execute on function public.delete_my_account() to authenticated;
