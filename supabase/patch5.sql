-- Patch 5: instructors, content protection, audit log, code lockout, exam dates, feedback, error reports, allowed email domains.
-- Run once in Supabase > SQL Editor (after patches 2 to 4). Safe to run more than once.

-- helpers -------------------------------------------------------------------------------------
create table if not exists public.class_instructors (
  user_id uuid not null references auth.users(id) on delete cascade,
  class_id text not null,
  primary key (user_id, class_id)
);
alter table public.class_instructors enable row level security;

create or replace function public.is_instructor_of(cid text) returns boolean
language sql security definer set search_path = public stable as $$
  select public.is_admin() or exists (select 1 from public.class_instructors where user_id = auth.uid() and class_id = cid);
$$;
create or replace function public.has_class(cid text) returns boolean
language sql security definer set search_path = public stable as $$
  select public.is_instructor_of(cid) or exists (select 1 from public.class_access where user_id = auth.uid() and class_id = cid);
$$;
-- may the caller look at this student's profile and progress? (themselves, an admin, or an instructor of one of their classes)
create or replace function public.can_view_student(sid uuid) returns boolean
language sql security definer set search_path = public stable as $$
  select sid = auth.uid() or public.is_admin() or exists (
    select 1 from public.class_access a join public.class_instructors i on i.class_id = a.class_id
    where a.user_id = sid and i.user_id = auth.uid());
$$;

drop policy if exists "instructor rows" on public.class_instructors;
create policy "instructor rows" on public.class_instructors for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for select using (public.can_view_student(id));
drop policy if exists "own progress read" on public.progress;
create policy "own progress read" on public.progress for select using (public.can_view_student(user_id));
drop policy if exists "own access" on public.class_access;
create policy "own access" on public.class_access for select using (
  user_id = auth.uid() or public.is_admin()
  or exists (select 1 from public.class_instructors i where i.user_id = auth.uid() and i.class_id = class_access.class_id));

-- audit log -----------------------------------------------------------------------------------
create table if not exists public.admin_audit (
  id bigserial primary key, at timestamptz not null default now(), actor uuid, action text not null, target text, detail text);
alter table public.admin_audit enable row level security;
drop policy if exists "audit read" on public.admin_audit;
create policy "audit read" on public.admin_audit for select using (public.is_admin());
create or replace function public.log_action(a text, t text, d text default null) returns void
language sql security definer set search_path = public as $$
  insert into public.admin_audit (actor, action, target, detail) values (auth.uid(), a, t, d);
$$;

-- admin and instructor tools (now logged) -------------------------------------------------------
create or replace function public.admin_set_blocked(uid uuid, flag boolean) returns void
language plpgsql security definer set search_path = public as $$
declare em text;
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  select email into em from public.profiles where id = uid;
  update public.profiles set blocked = flag where id = uid and not is_admin;
  perform public.log_action(case when flag then 'block' else 'unblock' end, em);
end $$;

create or replace function public.admin_delete_user(uid uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
declare em text;
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  if exists (select 1 from public.profiles where id = uid and is_admin) then raise exception 'cannot delete admin'; end if;
  select email into em from public.profiles where id = uid;
  delete from auth.users where id = uid;
  perform public.log_action('kick (delete user)', em);
end $$;

create or replace function public.admin_set_class_code(cid text, new_code text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  insert into public.class_codes (class_id, code) values (cid, new_code) on conflict (class_id) do update set code = excluded.code;
  perform public.log_action('change class code', cid, 'code changed');
end $$;

create or replace function public.instructor_get_codes() returns table (class_id text, code text)
language sql security definer set search_path = public stable as $$
  select c.class_id, c.code from public.class_codes c where public.is_instructor_of(c.class_id) order by c.class_id;
$$;
create or replace function public.instructor_set_code(cid text, new_code text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_instructor_of(cid) then raise exception 'instructors only'; end if;
  if length(trim(new_code)) < 4 then raise exception 'code too short'; end if;
  insert into public.class_codes (class_id, code) values (cid, trim(new_code)) on conflict (class_id) do update set code = excluded.code;
  perform public.log_action('change class code', cid, 'code changed');
end $$;
create or replace function public.instructor_remove_student(uid uuid, cid text) returns void
language plpgsql security definer set search_path = public as $$
declare em text;
begin
  if not public.is_instructor_of(cid) then raise exception 'instructors only'; end if;
  select email into em from public.profiles where id = uid;
  delete from public.class_access where user_id = uid and class_id = cid;
  perform public.log_action('remove from class', em, cid);
end $$;
create or replace function public.admin_set_instructor(target_email text, cid text, flag boolean) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  select id into uid from public.profiles where lower(email) = lower(trim(target_email));
  if uid is null then raise exception 'no account with that email (they must sign up first)'; end if;
  if flag then insert into public.class_instructors (user_id, class_id) values (uid, cid) on conflict do nothing;
  else delete from public.class_instructors where user_id = uid and class_id = cid; end if;
  perform public.log_action(case when flag then 'add instructor' else 'remove instructor' end, target_email, cid);
end $$;

-- code-guessing lockout: 8 wrong codes in 10 minutes locks that student out for the rest of the window ---------------------
create table if not exists public.code_attempts (user_id uuid not null, at timestamptz not null default now());
create index if not exists code_attempts_idx on public.code_attempts (user_id, at);
alter table public.code_attempts enable row level security;

create or replace function public.redeem_class_code(cid text, code text) returns boolean
language plpgsql security definer set search_path = public as $$
declare real_code text; bl boolean; n int;
begin
  if auth.uid() is null then return false; end if;
  select blocked into bl from public.profiles where id = auth.uid();
  if coalesce(bl, false) then return false; end if;
  select count(*) into n from public.code_attempts where user_id = auth.uid() and at > now() - interval '10 minutes';
  if n >= 8 then raise exception 'too_many_attempts'; end if;
  select c.code into real_code from public.class_codes c where c.class_id = cid;
  if real_code is not null and code = real_code then
    insert into public.class_access (user_id, class_id) values (auth.uid(), cid) on conflict do nothing;
    delete from public.code_attempts where user_id = auth.uid();
    return true;
  end if;
  insert into public.code_attempts (user_id) values (auth.uid());
  return false;
end $$;

create or replace function public.redeem_class_by_code(code text) returns text
language plpgsql security definer set search_path = public as $$
declare cid text; bl boolean; n int;
begin
  if auth.uid() is null then return null; end if;
  select blocked into bl from public.profiles where id = auth.uid();
  if coalesce(bl, false) then return null; end if;
  select count(*) into n from public.code_attempts where user_id = auth.uid() and at > now() - interval '10 minutes';
  if n >= 8 then raise exception 'too_many_attempts'; end if;
  select c.class_id into cid from public.class_codes c where c.code = redeem_class_by_code.code limit 1;
  if cid is null then insert into public.code_attempts (user_id) values (auth.uid()); return null; end if;
  insert into public.class_access (user_id, class_id) values (auth.uid(), cid) on conflict do nothing;
  delete from public.code_attempts where user_id = auth.uid();
  return cid;
end $$;

-- exam dates ------------------------------------------------------------------------------------
create table if not exists public.class_settings (class_id text primary key, exam_name text, exam_date date);
alter table public.class_settings enable row level security;
drop policy if exists "settings read" on public.class_settings;
create policy "settings read" on public.class_settings for select using (public.has_class(class_id));
create or replace function public.set_class_exam(cid text, nm text, d date) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_instructor_of(cid) then raise exception 'instructors only'; end if;
  insert into public.class_settings (class_id, exam_name, exam_date) values (cid, nullif(trim(nm), ''), d)
  on conflict (class_id) do update set exam_name = excluded.exam_name, exam_date = excluded.exam_date;
  perform public.log_action('set exam date', cid, coalesce(nm, '') || ' ' || coalesce(d::text, 'cleared'));
end $$;

-- feedback and error reports ---------------------------------------------------------------------
create table if not exists public.feedback (
  id bigserial primary key, at timestamptz not null default now(), user_id uuid, class_id text,
  rating int check (rating between 1 and 5), message text);
alter table public.feedback enable row level security;
drop policy if exists "feedback read" on public.feedback;
create policy "feedback read" on public.feedback for select using (public.is_admin() or (class_id is not null and public.is_instructor_of(class_id)));
create or replace function public.submit_feedback(cid text, r int, m text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  if (select count(*) from public.feedback where user_id = auth.uid() and at > now() - interval '1 day') >= 5 then raise exception 'too many messages today'; end if;
  insert into public.feedback (user_id, class_id, rating, message) values (auth.uid(), cid, r, left(coalesce(m, ''), 1000));
end $$;

create table if not exists public.client_errors (
  id bigserial primary key, at timestamptz not null default now(), user_id uuid, url text, msg text, stack text);
alter table public.client_errors enable row level security;
drop policy if exists "errors read" on public.client_errors;
create policy "errors read" on public.client_errors for select using (public.is_admin());
create or replace function public.log_client_error(m text, s text, u text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  if (select count(*) from public.client_errors where user_id = auth.uid() and at > now() - interval '1 hour') >= 20 then return; end if;
  insert into public.client_errors (user_id, url, msg, stack) values (auth.uid(), left(u, 200), left(m, 300), left(s, 1500));
end $$;

-- allowed school email domains (empty list = anyone can sign up) ------------------------------------
create or replace function public.admin_set_domains(list text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  insert into public.app_secrets (key, value) values ('allowed_domains', lower(coalesce(list, ''))) on conflict (key) do update set value = excluded.value;
  perform public.log_action('set allowed email domains', null, list);
end $$;
create or replace function public.admin_get_domains() returns text
language sql security definer set search_path = public stable as $$
  select case when public.is_admin() then coalesce((select value from public.app_secrets where key = 'allowed_domains'), '') end;
$$;
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare adm text; doms text; ok boolean;
begin
  select value into adm from public.app_secrets where key = 'admin_email';
  select value into doms from public.app_secrets where key = 'allowed_domains';
  if doms is not null and btrim(doms) <> '' and lower(new.email) <> lower(coalesce(adm, '')) then
    select exists (select 1 from unnest(string_to_array(replace(doms, ' ', ''), ',')) d where d <> '' and lower(new.email) like '%@' || d) into ok;
    if not ok then raise exception 'Sign-ups are limited to approved school email addresses.'; end if;
  end if;
  insert into public.profiles (id, email, display_name, is_admin, access_ok)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
          lower(new.email) = lower(coalesce(adm, '')), lower(new.email) = lower(coalesce(adm, '')));
  return new;
end $$;

-- protected lecture content: only members of a class (and its instructors / admin) can read its lectures ----------------------
create table if not exists public.lecture_content (
  lecture_id text primary key, class_id text not null, body jsonb not null, updated_at timestamptz not null default now());
create table if not exists public.exam_content (
  class_id text primary key, body jsonb not null, updated_at timestamptz not null default now());
alter table public.lecture_content enable row level security;
alter table public.exam_content enable row level security;
drop policy if exists "lecture read" on public.lecture_content;
create policy "lecture read" on public.lecture_content for select using (public.has_class(class_id));
drop policy if exists "lecture write" on public.lecture_content;
create policy "lecture write" on public.lecture_content for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "exam read" on public.exam_content;
create policy "exam read" on public.exam_content for select using (public.has_class(class_id));
drop policy if exists "exam write" on public.exam_content;
create policy "exam write" on public.exam_content for all using (public.is_admin()) with check (public.is_admin());

grant execute on function
  public.is_instructor_of(text), public.has_class(text), public.can_view_student(uuid),
  public.admin_set_blocked(uuid, boolean), public.admin_delete_user(uuid), public.admin_set_class_code(text, text),
  public.instructor_get_codes(), public.instructor_set_code(text, text), public.instructor_remove_student(uuid, text),
  public.admin_set_instructor(text, text, boolean), public.redeem_class_code(text, text), public.redeem_class_by_code(text),
  public.set_class_exam(text, text, date), public.submit_feedback(text, int, text), public.log_client_error(text, text, text),
  public.admin_set_domains(text), public.admin_get_domains()
to authenticated;

-- the audit writer is internal only: students must not be able to add fake audit lines
revoke all on function public.log_action(text, text, text) from public, anon, authenticated;
