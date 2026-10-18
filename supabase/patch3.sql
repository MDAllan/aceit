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

-- Class codes (change anytime in the Admin tab)
insert into public.class_codes (class_id, code) values ('astr207', 'cry@18')
on conflict (class_id) do update set code = excluded.code;

-- "Join a class": a student types a code and gets whichever class it belongs to
create or replace function public.redeem_class_by_code(code text) returns text
language plpgsql security definer set search_path = public as $$
declare cid text; bl boolean;
begin
  if auth.uid() is null then return null; end if;
  select blocked into bl from public.profiles where id = auth.uid();
  if coalesce(bl, false) then return null; end if;
  select c.class_id into cid from public.class_codes c where c.code = redeem_class_by_code.code limit 1;
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
