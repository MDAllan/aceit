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
