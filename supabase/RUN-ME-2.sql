-- Patch 6: schools, school managers, instructors, classes, enrollments, email invites, platform admins, progress summaries.
-- Platform admin -> schools -> school managers + instructors -> classes -> students.
-- Run once in Supabase > SQL Editor (after RUN-ME.sql). Safe to run more than once.
-- Your current ERTH 209 and ASTR 207 classes, their codes, students and instructors are carried over automatically.

-- 0. catalogue of courses (the content a class can use) ------------------------------------------------------------------
create table if not exists public.courses (id text primary key, title text not null, active boolean not null default true);
insert into public.courses (id, title) values ('erth209', 'Geology (ERTH 209)'), ('astr207', 'Astronomy (ASTR 207)') on conflict (id) do nothing;
alter table public.courses enable row level security;
drop policy if exists "courses read" on public.courses;
create policy "courses read" on public.courses for select using (auth.uid() is not null);

-- 1. schools and their people ---------------------------------------------------------------------------------------------
create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 120),
  region text,
  active boolean not null default true,
  seat_limit int check (seat_limit is null or seat_limit > 0),
  created_at timestamptz not null default now());
create table if not exists public.school_managers (
  user_id uuid not null references auth.users(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  primary key (user_id, school_id));
create table if not exists public.school_courses (
  school_id uuid not null references public.schools(id) on delete cascade,
  course_id text not null references public.courses(id),
  primary key (school_id, course_id));

-- 2. classes (one per instructor or section), teachers and enrolled students ------------------------------------------------
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  course_id text not null references public.courses(id),
  name text not null check (length(trim(name)) between 2 and 120),
  term text,
  code text not null check (length(trim(code)) >= 4),
  code_expires date,
  max_students int check (max_students is null or max_students > 0),
  exam_name text, exam_date date,
  archived boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now());
create unique index if not exists classes_code_uq on public.classes (lower(code));
create table if not exists public.class_teachers (
  user_id uuid not null references auth.users(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  primary key (user_id, class_id));
create table if not exists public.enrollments (
  user_id uuid not null references auth.users(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (user_id, class_id));
create index if not exists enrollments_class_idx on public.enrollments (class_id);

-- 3. invites: add people by email, they get the role when they confirm that email ----------------------------------------------
create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role text not null check (role in ('admin', 'manager', 'teacher')),
  school_id uuid references public.schools(id) on delete cascade,
  class_id uuid references public.classes(id) on delete cascade,
  invited_by uuid,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  revoked boolean not null default false);
create index if not exists invites_email_idx on public.invites (lower(email));

-- 4. small progress summaries, so dashboards never have to download everyone's full progress ---------------------------------------
create table if not exists public.progress_summary (
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id text not null,
  pct int not null default 0 check (pct between 0 and 100), mastery int not null default 0 check (mastery between 0 and 100),
  read_topics int not null default 0 check (read_topics between 0 and 10000), cards_known int not null default 0 check (cards_known between 0 and 10000), cards_total int not null default 0 check (cards_total between 0 and 10000),
  quiz_attempts int not null default 0 check (quiz_attempts between 0 and 1000000), quiz_correct int not null default 0 check (quiz_correct between 0 and 1000000),
  last_active timestamptz not null default now(),
  primary key (user_id, course_id));
-- the permission checks look people up by school and by class, so keep those lookups fast when there are thousands of students
create index if not exists classes_school_idx on public.classes (school_id);
create index if not exists class_teachers_class_idx on public.class_teachers (class_id);
create index if not exists school_managers_school_idx on public.school_managers (school_id);
create index if not exists progress_summary_course_idx on public.progress_summary (course_id);

-- 5. permission helpers (every screen and every table rule uses these) -------------------------------------------------------------
create or replace function public.email_ok(uid uuid) returns boolean
language sql security definer set search_path = public, auth stable as $$
  select coalesce((select email_confirmed_at is not null from auth.users where id = uid), false);
$$;
create or replace function public.is_manager_of(sid uuid) returns boolean
language sql security definer set search_path = public stable as $$
  select public.is_admin() or exists (select 1 from public.school_managers where user_id = auth.uid() and school_id = sid);
$$;
create or replace function public.is_teacher_of(cid uuid) returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.class_teachers where user_id = auth.uid() and class_id = cid);
$$;
create or replace function public.can_manage_class(cid uuid) returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.classes c where c.id = cid and public.is_manager_of(c.school_id));
$$;
create or replace function public.can_teach_class(cid uuid) returns boolean
language sql security definer set search_path = public stable as $$
  select public.can_manage_class(cid) or public.is_teacher_of(cid);
$$;
-- may the caller see this person's profile and progress?
create or replace function public.can_view_student(sid uuid) returns boolean
language sql security definer set search_path = public stable as $$
  select sid = auth.uid() or public.is_admin()
    or exists (select 1 from public.enrollments e join public.classes c on c.id = e.class_id
               where e.user_id = sid and (public.is_manager_of(c.school_id) or public.is_teacher_of(c.id)))
    or exists (select 1 from public.class_teachers t join public.classes c on c.id = t.class_id
               where t.user_id = sid and public.is_manager_of(c.school_id));
$$;
-- may the caller read this course's lectures?
create or replace function public.has_course(cid text) returns boolean
language sql security definer set search_path = public stable as $$
  select public.is_admin()
    or exists (select 1 from public.enrollments e join public.classes c on c.id = e.class_id join public.schools s on s.id = c.school_id
               where e.user_id = auth.uid() and c.course_id = cid and s.active)
    or exists (select 1 from public.class_teachers t join public.classes c on c.id = t.class_id where t.user_id = auth.uid() and c.course_id = cid)
    or exists (select 1 from public.school_managers m join public.school_courses sc on sc.school_id = m.school_id where m.user_id = auth.uid() and sc.course_id = cid);
$$;
create or replace function public.has_class(cid text) returns boolean language sql security definer set search_path = public stable as $$ select public.has_course(cid); $$;

-- 6. audit log: scoped by school and impossible to edit or delete --------------------------------------------------------------
alter table public.admin_audit add column if not exists school_id uuid;
drop function if exists public.log_action(text, text, text);
create or replace function public.log_action(a text, t text, d text default null, sid uuid default null) returns void
language sql security definer set search_path = public as $$
  insert into public.admin_audit (actor, action, target, detail, school_id) values (auth.uid(), a, t, d, sid);
$$;
revoke all on function public.log_action(text, text, text, uuid) from public, anon, authenticated;
create or replace function public.audit_immutable() returns trigger language plpgsql as $$ begin raise exception 'the audit log is append-only'; end $$;
drop trigger if exists audit_no_change on public.admin_audit;
create trigger audit_no_change before update or delete on public.admin_audit for each row execute function public.audit_immutable();
drop policy if exists "audit read" on public.admin_audit;
create policy "audit read" on public.admin_audit for select using (public.is_admin() or (school_id is not null and public.is_manager_of(school_id)));

-- 7. who can read which rows (writes only happen through the functions below) -------------------------------------------------------
alter table public.schools enable row level security;
alter table public.school_managers enable row level security;
alter table public.school_courses enable row level security;
alter table public.classes enable row level security;
alter table public.class_teachers enable row level security;
alter table public.enrollments enable row level security;
alter table public.invites enable row level security;
alter table public.progress_summary enable row level security;

drop policy if exists "schools read" on public.schools;
create policy "schools read" on public.schools for select using (
  public.is_admin() or public.is_manager_of(id)
  or exists (select 1 from public.class_teachers t join public.classes c on c.id = t.class_id where t.user_id = auth.uid() and c.school_id = schools.id));
drop policy if exists "managers read" on public.school_managers;
create policy "managers read" on public.school_managers for select using (user_id = auth.uid() or public.is_manager_of(school_id));
drop policy if exists "school courses read" on public.school_courses;
create policy "school courses read" on public.school_courses for select using (
  public.is_manager_of(school_id) or exists (select 1 from public.class_teachers t join public.classes c on c.id = t.class_id where t.user_id = auth.uid() and c.school_id = school_courses.school_id));
drop policy if exists "classes read" on public.classes;
create policy "classes read" on public.classes for select using (public.can_teach_class(id));
drop policy if exists "teachers read" on public.class_teachers;
create policy "teachers read" on public.class_teachers for select using (user_id = auth.uid() or public.can_manage_class(class_id));
drop policy if exists "enrollments read" on public.enrollments;
create policy "enrollments read" on public.enrollments for select using (user_id = auth.uid() or public.can_teach_class(class_id));
drop policy if exists "invites read" on public.invites;
create policy "invites read" on public.invites for select using (
  public.is_admin() or (school_id is not null and public.is_manager_of(school_id)) or (class_id is not null and public.can_manage_class(class_id)));
drop policy if exists "summary read" on public.progress_summary;
create policy "summary read" on public.progress_summary for select using (public.can_view_student(user_id));
drop policy if exists "summary write" on public.progress_summary;
create policy "summary write" on public.progress_summary for insert with check (user_id = auth.uid() and public.can_use());
drop policy if exists "summary update" on public.progress_summary;
create policy "summary update" on public.progress_summary for update using (user_id = auth.uid() and public.can_use()) with check (user_id = auth.uid());

-- people who can see each other: managers and teachers see the students and teachers of their school; the admin sees everyone
drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for select using (public.can_view_student(id));
drop policy if exists "own progress read" on public.progress;
create policy "own progress read" on public.progress for select using (public.can_view_student(user_id));
drop policy if exists "own access" on public.class_access;
create policy "own access" on public.class_access for select using (user_id = auth.uid() or public.is_admin());

-- no account can change its own profile row directly (name changes use set_my_name, roles use the functions below) --------------
revoke update, insert, delete on public.profiles from anon, authenticated;
-- one account cannot fill the database with junk
do $$ begin
  alter table public.progress add constraint progress_size check (pg_column_size(data) < 300000);
exception when duplicate_object then null; end $$;

-- 8. carry the existing classes over (idempotent) ---------------------------------------------------------------------------------
insert into public.schools (id, name, region) values ('00000000-0000-0000-0000-000000000001', 'ACEIT Direct', 'Alberta, Canada') on conflict (id) do nothing;
insert into public.school_courses (school_id, course_id) select '00000000-0000-0000-0000-000000000001', id from public.courses on conflict do nothing;
insert into public.classes (id, school_id, course_id, name, term, code, exam_name, exam_date)
select md5('class:' || cc.class_id)::uuid, '00000000-0000-0000-0000-000000000001', cc.class_id,
       coalesce((select title from public.courses where id = cc.class_id), cc.class_id), 'Fall 2026', cc.code, cs.exam_name, cs.exam_date
from public.class_codes cc left join public.class_settings cs on cs.class_id = cc.class_id
where exists (select 1 from public.courses where id = cc.class_id)
on conflict (id) do nothing;
insert into public.enrollments (user_id, class_id)
select ca.user_id, md5('class:' || ca.class_id)::uuid from public.class_access ca
where exists (select 1 from public.classes where id = md5('class:' || ca.class_id)::uuid) on conflict do nothing;
insert into public.class_teachers (user_id, class_id)
select ci.user_id, md5('class:' || ci.class_id)::uuid from public.class_instructors ci
where exists (select 1 from public.classes where id = md5('class:' || ci.class_id)::uuid) on conflict do nothing;

-- 9. joining a class by code (keeps the 8-tries lockout) -----------------------------------------------------------------------------
create or replace function public.join_class(code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c public.classes; s public.schools; bl boolean; n int; seats int;
begin
  if auth.uid() is null then return null; end if;
  select blocked into bl from public.profiles where id = auth.uid();
  if coalesce(bl, false) then return null; end if;
  select count(*) into n from public.code_attempts where user_id = auth.uid() and at > now() - interval '10 minutes';
  if n >= 8 then raise exception 'too_many_attempts'; end if;
  select * into c from public.classes x where lower(x.code) = lower(trim(join_class.code)) limit 1;
  if c.id is null then insert into public.code_attempts (user_id) values (auth.uid()); return null; end if;
  select * into s from public.schools where id = c.school_id;
  if not s.active then raise exception 'school_inactive'; end if;
  if c.archived then raise exception 'class_closed'; end if;
  if c.code_expires is not null and c.code_expires < current_date then raise exception 'code_expired'; end if;
  if not exists (select 1 from public.enrollments where user_id = auth.uid() and class_id = c.id) then
    if c.max_students is not null and (select count(*) from public.enrollments where class_id = c.id) >= c.max_students then raise exception 'class_full'; end if;
    if s.seat_limit is not null then
      select count(distinct e.user_id) into seats from public.enrollments e join public.classes k on k.id = e.class_id where k.school_id = s.id;
      if seats >= s.seat_limit then raise exception 'school_full'; end if;
    end if;
    insert into public.enrollments (user_id, class_id) values (auth.uid(), c.id);
  end if;
  delete from public.code_attempts where user_id = auth.uid();
  return jsonb_build_object('class_id', c.id, 'course_id', c.course_id, 'name', c.name);
end $$;
-- the older entry points keep working for apps that have not refreshed yet (they answer with the course id)
create or replace function public.redeem_class_by_code(code text) returns text
language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  r := public.join_class(redeem_class_by_code.code);
  return r ->> 'course_id';
end $$;
create or replace function public.redeem_class_code(cid text, code text) returns boolean
language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  if auth.uid() is null then return false; end if;
  if not exists (select 1 from public.classes k where lower(k.code) = lower(trim(redeem_class_code.code)) and k.course_id = cid) then
    if (select count(*) from public.code_attempts where user_id = auth.uid() and at > now() - interval '10 minutes') >= 8 then raise exception 'too_many_attempts'; end if;
    insert into public.code_attempts (user_id) values (auth.uid());
    return false;
  end if;
  r := public.join_class(redeem_class_code.code);
  return r is not null;
end $$;

-- what the signed-in person belongs to (students: their classes; teachers and managers: the classes they run) -------------------------------
create or replace function public.my_classes() returns table (class_id uuid, course_id text, name text, term text, school_id uuid, school_name text, role text, exam_name text, exam_date date, archived boolean)
language sql security definer set search_path = public stable as $$
  select c.id, c.course_id, c.name, c.term, s.id, s.name, 'student'::text, c.exam_name, c.exam_date, c.archived
    from public.enrollments e join public.classes c on c.id = e.class_id join public.schools s on s.id = c.school_id where e.user_id = auth.uid() and s.active
  union
  select c.id, c.course_id, c.name, c.term, s.id, s.name, 'teacher', c.exam_name, c.exam_date, c.archived
    from public.class_teachers t join public.classes c on c.id = t.class_id join public.schools s on s.id = c.school_id where t.user_id = auth.uid()
  union
  select c.id, c.course_id, c.name, c.term, s.id, s.name, 'manager', c.exam_name, c.exam_date, c.archived
    from public.school_managers m join public.classes c on c.school_id = m.school_id join public.schools s on s.id = c.school_id where m.user_id = auth.uid();
$$;

-- the roles that are not tied to a class: platform admin and school manager (a manager may not have created any class yet)
create or replace function public.my_roles() returns table (role text, school_id uuid, school_name text)
language sql security definer set search_path = public stable as $$
  select 'manager'::text, s.id, s.name from public.school_managers m join public.schools s on s.id = m.school_id where m.user_id = auth.uid()
  union all
  select 'admin', null::uuid, null::text where public.is_admin();
$$;

-- 10. creating schools and classes ----------------------------------------------------------------------------------------------------------
create or replace function public.admin_create_school(nm text, rg text, seats int default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare sid uuid;
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  insert into public.schools (name, region, seat_limit) values (trim(nm), nullif(trim(rg), ''), seats) returning id into sid;
  perform public.log_action('create school', trim(nm), null, sid);
  return sid;
end $$;
create or replace function public.admin_update_school(sid uuid, nm text, rg text, is_active boolean, seats int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  update public.schools set name = trim(nm), region = nullif(trim(rg), ''), active = is_active, seat_limit = seats where id = sid;
  perform public.log_action(case when is_active then 'update school' else 'suspend school' end, trim(nm), null, sid);
end $$;
create or replace function public.admin_set_school_course(sid uuid, cid text, flag boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  if flag then insert into public.school_courses (school_id, course_id) values (sid, cid) on conflict do nothing;
  else delete from public.school_courses where school_id = sid and course_id = cid; end if;
  perform public.log_action(case when flag then 'license course' else 'remove course license' end, cid, null, sid);
end $$;

create or replace function public.make_code() returns text
language sql volatile as $$
  select upper(substr(translate(replace(gen_random_uuid()::text, '-', ''), '01', 'wx'), 1, 4)) || '-' || upper(substr(translate(replace(gen_random_uuid()::text, '-', ''), '01', 'wx'), 1, 4));
$$;
create or replace function public.create_class(sid uuid, cid text, nm text, tm text default null, seats int default null, new_code text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare k uuid; cd text;
begin
  if not public.is_manager_of(sid) then raise exception 'school managers only'; end if;
  if not public.is_admin() and not exists (select 1 from public.school_courses where school_id = sid and course_id = cid) then raise exception 'this school is not licensed for that course'; end if;
  cd := coalesce(nullif(trim(new_code), ''), public.make_code());
  insert into public.classes (school_id, course_id, name, term, code, max_students, created_by) values (sid, cid, trim(nm), nullif(trim(tm), ''), cd, seats, auth.uid()) returning id into k;
  perform public.log_action('create class', trim(nm), cid, sid);
  return k;
end $$;
create or replace function public.update_class(kid uuid, nm text, tm text, seats int, expires date, closed boolean) returns void
language plpgsql security definer set search_path = public as $$
declare sid uuid;
begin
  if not public.can_manage_class(kid) then raise exception 'school managers only'; end if;
  update public.classes set name = trim(nm), term = nullif(trim(tm), ''), max_students = seats, code_expires = expires, archived = closed where id = kid returning school_id into sid;
  perform public.log_action(case when closed then 'archive class' else 'update class' end, trim(nm), null, sid);
end $$;
create or replace function public.set_class_code(kid uuid, new_code text default null) returns text
language plpgsql security definer set search_path = public as $$
declare cd text; sid uuid;
begin
  if not public.can_teach_class(kid) then raise exception 'instructors only'; end if;
  cd := coalesce(nullif(trim(new_code), ''), public.make_code());
  if length(cd) < 6 then raise exception 'code too short (use at least 6 characters)'; end if;
  update public.classes set code = cd where id = kid returning school_id into sid;
  perform public.log_action('change class code', kid::text, 'code changed', sid);
  return cd;
end $$;
-- (replaces the older one that was keyed by course id)
drop function if exists public.set_class_exam(text, text, date);
create or replace function public.set_class_exam(kid uuid, nm text, d date) returns void
language plpgsql security definer set search_path = public as $$
declare sid uuid;
begin
  if not public.can_teach_class(kid) then raise exception 'instructors only'; end if;
  update public.classes set exam_name = nullif(trim(nm), ''), exam_date = d where id = kid returning school_id into sid;
  perform public.log_action('set exam date', kid::text, coalesce(nm, '') || ' ' || coalesce(d::text, 'cleared'), sid);
end $$;
create or replace function public.remove_student(uid uuid, kid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare em text; sid uuid;
begin
  if not public.can_teach_class(kid) then raise exception 'instructors only'; end if;
  select email into em from public.profiles where id = uid;
  delete from public.enrollments where user_id = uid and class_id = kid;
  select school_id into sid from public.classes where id = kid;
  perform public.log_action('remove student from class', em, kid::text, sid);
end $$;

-- students can leave a class on their own
create or replace function public.leave_class(kid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.enrollments where user_id = auth.uid() and class_id = kid;
end $$;

-- 11. adding people by email --------------------------------------------------------------------------------------------------------------
create or replace function public.apply_invites_for(uid uuid) returns int
language plpgsql security definer set search_path = public, auth as $$
declare r public.invites; em text; n int := 0;
begin
  if not public.email_ok(uid) then return 0; end if;   -- roles only go to emails the person has confirmed
  select email into em from auth.users where id = uid;
  for r in select * from public.invites i where lower(i.email) = lower(em) and i.accepted_at is null and not i.revoked and i.expires_at > now() loop
    if r.role = 'admin' then update public.profiles set is_admin = true, access_ok = true where id = uid;
    elsif r.role = 'manager' then insert into public.school_managers (user_id, school_id) values (uid, r.school_id) on conflict do nothing;
    elsif r.role = 'teacher' then insert into public.class_teachers (user_id, class_id) values (uid, r.class_id) on conflict do nothing; end if;
    update public.invites set accepted_at = now() where id = r.id;
    insert into public.admin_audit (actor, action, target, detail, school_id) values (uid, 'invite accepted', em, r.role, r.school_id);
    n := n + 1;
  end loop;
  return n;
end $$;
create or replace function public.claim_invites() returns int
language sql security definer set search_path = public as $$ select public.apply_invites_for(auth.uid()); $$;

-- The owner confirms that Supabase "Confirm email" is on. Until then nobody can be invited by an address that has not signed up yet,
-- because anyone could register that address first and receive the role.
create or replace function public.admin_set_confirm_email(flag boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  insert into public.app_secrets (key, value) values ('confirm_email_on', case when flag then '1' else '0' end) on conflict (key) do update set value = excluded.value;
  perform public.log_action('confirm email setting', case when flag then 'on' else 'off' end);
end $$;
create or replace function public.admin_get_confirm_email() returns boolean
language sql security definer set search_path = public stable as $$
  select case when public.is_admin() then coalesce((select value = '1' from public.app_secrets where key = 'confirm_email_on'), false) else false end;
$$;

create or replace function public.invite_user(target_email text, rl text, sid uuid default null, kid uuid default null) returns text
language plpgsql security definer set search_path = public, auth as $$
declare em text := lower(trim(target_email)); uid uuid; scope uuid; iid uuid;
begin
  if em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'that does not look like an email address'; end if;
  if rl = 'admin' then
    if not public.is_admin() then raise exception 'admin only'; end if;
  elsif rl = 'manager' then
    if not public.is_admin() then raise exception 'only the platform admin can add school managers'; end if;
    if sid is null then raise exception 'choose a school'; end if;
  elsif rl = 'teacher' then
    if kid is null then raise exception 'choose a class'; end if;
    select school_id into scope from public.classes where id = kid;
    if scope is null then raise exception 'unknown class'; end if;
    if not public.is_manager_of(scope) then raise exception 'only school managers can add instructors'; end if;
    sid := scope;
  else raise exception 'unknown role'; end if;
  select id into uid from auth.users where lower(email) = em;
  if uid is null and coalesce((select value from public.app_secrets where key = 'confirm_email_on'), '0') <> '1' then
    raise exception 'Turn on Confirm email (Workspace, Settings) before inviting someone who has not signed up yet.';
  end if;
  update public.invites set revoked = true where lower(email) = em and role = rl and accepted_at is null and not revoked
     and coalesce(school_id, '00000000-0000-0000-0000-000000000000') = coalesce(sid, '00000000-0000-0000-0000-000000000000')
     and coalesce(class_id, '00000000-0000-0000-0000-000000000000') = coalesce(kid, '00000000-0000-0000-0000-000000000000');
  insert into public.invites (email, role, school_id, class_id, invited_by) values (em, rl, sid, kid, auth.uid()) returning id into iid;
  perform public.log_action('invite ' || rl, em, null, sid);
  if uid is not null and public.apply_invites_for(uid) > 0 then return 'added'; end if;
  return 'invited';
end $$;
create or replace function public.revoke_invite(iid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r public.invites;
begin
  select * into r from public.invites where id = iid;
  if r.id is null then return; end if;
  if not (public.is_admin() or (r.school_id is not null and public.is_manager_of(r.school_id))) then raise exception 'not allowed'; end if;
  update public.invites set revoked = true where id = iid;
  perform public.log_action('revoke invite', r.email, r.role, r.school_id);
end $$;
create or replace function public.remove_teacher(uid uuid, kid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare em text; sid uuid;
begin
  if not public.can_manage_class(kid) then raise exception 'school managers only'; end if;
  select email into em from public.profiles where id = uid;
  delete from public.class_teachers where user_id = uid and class_id = kid;
  select school_id into sid from public.classes where id = kid;
  perform public.log_action('remove instructor', em, kid::text, sid);
end $$;
create or replace function public.remove_manager(uid uuid, sid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare em text;
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  select email into em from public.profiles where id = uid;
  delete from public.school_managers where user_id = uid and school_id = sid;
  perform public.log_action('remove school manager', em, null, sid);
end $$;
-- platform admins: add by email, remove (the last admin can never be removed)
create or replace function public.admin_set_admin(target_email text, flag boolean) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  select id into uid from public.profiles where lower(email) = lower(trim(target_email));
  if uid is null then raise exception 'no account with that email'; end if;
  if flag and not public.email_ok(uid) then raise exception 'that person must confirm their email first'; end if;
  if not flag and (select count(*) from public.profiles where is_admin) <= 1 then raise exception 'you cannot remove the last admin'; end if;
  update public.profiles set is_admin = flag, access_ok = access_ok or flag where id = uid;
  perform public.log_action(case when flag then 'add admin' else 'remove admin' end, lower(trim(target_email)));
end $$;
create or replace function public.list_admins() returns table (user_id uuid, email text, display_name text)
language sql security definer set search_path = public stable as $$
  select p.id, p.email, p.display_name from public.profiles p where p.is_admin and public.is_admin() order by p.email;
$$;
-- the old instructor tools were keyed by course id; the new ones above replace them
drop function if exists public.admin_set_instructor(text, text, boolean);
drop function if exists public.instructor_get_codes();
drop function if exists public.instructor_set_code(text, text);
drop function if exists public.instructor_remove_student(uuid, text);

-- new accounts: roles from invites are applied once the email is confirmed -------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare adm text; doms text; ok boolean;
begin
  select value into adm from public.app_secrets where key = 'admin_email';
  select value into doms from public.app_secrets where key = 'allowed_domains';
  if doms is not null and btrim(doms) <> '' and lower(new.email) <> lower(coalesce(adm, '')) then
    select exists (select 1 from unnest(string_to_array(replace(doms, ' ', ''), ',')) d where d <> '' and lower(new.email) like '%@' || d) into ok;
    if not ok then   -- someone a school or the admin invited by email may always sign up with that address
      select exists (select 1 from public.invites i where lower(i.email) = lower(new.email) and i.accepted_at is null and not i.revoked and i.expires_at > now()) into ok;
    end if;
    if not ok then raise exception 'Sign-ups are limited to approved school email addresses.'; end if;
  end if;
  insert into public.profiles (id, email, display_name, is_admin, access_ok)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
          lower(new.email) = lower(coalesce(adm, '')), lower(new.email) = lower(coalesce(adm, '')));
  perform public.apply_invites_for(new.id);
  return new;
end $$;
create or replace function public.on_user_confirmed() returns trigger
language plpgsql security definer set search_path = public as $$
begin perform public.apply_invites_for(new.id); return new; end $$;
drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_confirmed after update of email_confirmed_at on auth.users
  for each row when (old.email_confirmed_at is null and new.email_confirmed_at is not null) execute function public.on_user_confirmed();

-- 12. dashboards for staff (small answers, filtered to what the caller may see) ---------------------------------------------------------------
create or replace function public.staff_schools() returns table (school_id uuid, name text, region text, active boolean, seat_limit int, seats_used int, courses text[], classes int, teachers int, managers int, students int, active7 int)
language sql security definer set search_path = public stable as $$
  select s.id, s.name, s.region, s.active, s.seat_limit,
    (select count(distinct e.user_id)::int from public.enrollments e join public.classes c on c.id = e.class_id where c.school_id = s.id),
    coalesce((select array_agg(sc.course_id order by sc.course_id) from public.school_courses sc where sc.school_id = s.id), '{}'),
    (select count(*)::int from public.classes c where c.school_id = s.id),
    (select count(distinct t.user_id)::int from public.class_teachers t join public.classes c on c.id = t.class_id where c.school_id = s.id),
    (select count(*)::int from public.school_managers m where m.school_id = s.id),
    (select count(distinct e.user_id)::int from public.enrollments e join public.classes c on c.id = e.class_id where c.school_id = s.id),
    (select count(distinct e.user_id)::int from public.enrollments e join public.classes c on c.id = e.class_id join public.progress_summary ps on ps.user_id = e.user_id and ps.course_id = c.course_id
       where c.school_id = s.id and ps.last_active > now() - interval '7 days')
  from public.schools s
  where public.is_manager_of(s.id) or exists (select 1 from public.class_teachers t join public.classes c on c.id = t.class_id where t.user_id = auth.uid() and c.school_id = s.id)
  order by s.name;
$$;
create or replace function public.staff_classes(sid uuid default null) returns table (class_id uuid, school_id uuid, school_name text, course_id text, name text, term text, code text, code_expires date, max_students int, exam_name text, exam_date date, archived boolean, students int, active7 int, avg_pct int, avg_mastery int, teachers jsonb)
language sql security definer set search_path = public stable as $$
  select c.id, c.school_id, s.name, c.course_id, c.name, c.term, c.code, c.code_expires, c.max_students, c.exam_name, c.exam_date, c.archived,
    (select count(*)::int from public.enrollments e where e.class_id = c.id),
    (select count(*)::int from public.enrollments e join public.progress_summary ps on ps.user_id = e.user_id and ps.course_id = c.course_id where e.class_id = c.id and ps.last_active > now() - interval '7 days'),
    coalesce((select round(avg(ps.pct))::int from public.enrollments e join public.progress_summary ps on ps.user_id = e.user_id and ps.course_id = c.course_id where e.class_id = c.id), 0),
    coalesce((select round(avg(ps.mastery))::int from public.enrollments e join public.progress_summary ps on ps.user_id = e.user_id and ps.course_id = c.course_id where e.class_id = c.id), 0),
    coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'email', p.email, 'name', p.display_name) order by p.email) from public.class_teachers t join public.profiles p on p.id = t.user_id where t.class_id = c.id), '[]'::jsonb)
  from public.classes c join public.schools s on s.id = c.school_id
  where public.can_teach_class(c.id) and (sid is null or c.school_id = sid)
  order by s.name, c.archived, c.name;
$$;
create or replace function public.class_roster(kid uuid) returns table (user_id uuid, email text, display_name text, blocked boolean, joined_at timestamptz, pct int, mastery int, read_topics int, cards_known int, cards_total int, quiz_attempts int, quiz_correct int, last_active timestamptz)
language sql security definer set search_path = public stable as $$
  select p.id, p.email, p.display_name, p.blocked, e.joined_at, coalesce(ps.pct, 0), coalesce(ps.mastery, 0), coalesce(ps.read_topics, 0), coalesce(ps.cards_known, 0), coalesce(ps.cards_total, 0),
         coalesce(ps.quiz_attempts, 0), coalesce(ps.quiz_correct, 0), ps.last_active
  from public.enrollments e join public.classes c on c.id = e.class_id join public.profiles p on p.id = e.user_id
  left join public.progress_summary ps on ps.user_id = e.user_id and ps.course_id = c.course_id
  where e.class_id = kid and public.can_teach_class(kid) order by p.display_name, p.email;
$$;
-- how every question did across a class (for "hardest questions")
create or replace function public.class_question_stats(kid uuid) returns table (qid text, attempts int, correct int)
language sql security definer set search_path = public stable as $$
  select q.key, sum((q.value ->> 'attempts')::bigint)::int, sum(coalesce((q.value ->> 'correct')::bigint, 0))::int
  from public.enrollments e join public.progress p on p.user_id = e.user_id, jsonb_each(case when jsonb_typeof(p.data -> 'quiz') = 'object' then p.data -> 'quiz' else '{}'::jsonb end) q
  where e.class_id = kid and public.can_teach_class(kid) and jsonb_typeof(q.value) = 'object'
    and (q.value ->> 'attempts') ~ '^[0-9]{1,6}$' and coalesce(q.value ->> 'correct', '0') ~ '^[0-9]{1,6}$'
  group by q.key;
$$;
create or replace function public.staff_people(sid uuid) returns table (role text, user_id uuid, email text, display_name text, classes text[])
language sql security definer set search_path = public stable as $$
  select 'manager'::text, p.id, p.email, p.display_name, '{}'::text[] from public.school_managers m join public.profiles p on p.id = m.user_id where m.school_id = sid and public.is_manager_of(sid)
  union all
  select 'teacher', p.id, p.email, p.display_name, array_agg(c.name order by c.name)
  from public.class_teachers t join public.classes c on c.id = t.class_id join public.profiles p on p.id = t.user_id
  where c.school_id = sid and public.is_manager_of(sid) group by p.id, p.email, p.display_name
  order by 1, 3;
$$;
create or replace function public.list_invites(sid uuid default null) returns table (id uuid, email text, role text, school_id uuid, class_id uuid, created_at timestamptz, expires_at timestamptz)
language sql security definer set search_path = public stable as $$
  select i.id, i.email, i.role, i.school_id, i.class_id, i.created_at, i.expires_at from public.invites i
  where i.accepted_at is null and not i.revoked and i.expires_at > now()
    and ((sid is null and public.is_admin()) or (sid is not null and (i.school_id = sid) and public.is_manager_of(sid)))
  order by i.created_at desc;
$$;

-- 13. feedback now points at the class ----------------------------------------------------------------------------------------------------------
alter table public.feedback add column if not exists class_uuid uuid;
drop policy if exists "feedback read" on public.feedback;
create policy "feedback read" on public.feedback for select using (public.is_admin() or (class_uuid is not null and public.can_teach_class(class_uuid)));
create or replace function public.submit_feedback(cid text, r int, m text) returns void
language plpgsql security definer set search_path = public as $$
declare k uuid;
begin
  if auth.uid() is null then return; end if;
  if (select count(*) from public.feedback where user_id = auth.uid() and at > now() - interval '1 day') >= 5 then raise exception 'too many messages today'; end if;
  begin k := cid::uuid; exception when others then k := null; end;
  if k is null then select e.class_id into k from public.enrollments e join public.classes c on c.id = e.class_id where e.user_id = auth.uid() and c.course_id = cid limit 1; end if;
  insert into public.feedback (user_id, class_id, class_uuid, rating, message) values (auth.uid(), cid, k, r, left(coalesce(m, ''), 1000));
end $$;

-- 14. grants --------------------------------------------------------------------------------------------------------------------------------------
grant execute on function
  public.is_manager_of(uuid), public.is_teacher_of(uuid), public.can_manage_class(uuid), public.can_teach_class(uuid), public.can_view_student(uuid),
  public.has_course(text), public.has_class(text), public.join_class(text), public.redeem_class_by_code(text), public.redeem_class_code(text, text), public.my_classes(), public.my_roles(),
  public.admin_create_school(text, text, int), public.admin_update_school(uuid, text, text, boolean, int), public.admin_set_school_course(uuid, text, boolean),
  public.create_class(uuid, text, text, text, int, text), public.update_class(uuid, text, text, int, date, boolean), public.set_class_code(uuid, text),
  public.set_class_exam(uuid, text, date), public.remove_student(uuid, uuid), public.leave_class(uuid), public.claim_invites(), public.invite_user(text, text, uuid, uuid), public.revoke_invite(uuid),
  public.remove_teacher(uuid, uuid), public.remove_manager(uuid, uuid), public.admin_set_admin(text, boolean), public.list_admins(), public.admin_set_confirm_email(boolean), public.admin_get_confirm_email(),
  public.staff_schools(), public.staff_classes(uuid), public.class_roster(uuid), public.class_question_stats(uuid), public.staff_people(uuid), public.list_invites(uuid),
  public.submit_feedback(text, int, text)
to authenticated;
revoke all on function public.email_ok(uuid), public.apply_invites_for(uuid), public.on_user_confirmed(), public.audit_immutable(), public.make_code() from public, anon, authenticated;

-- let the API pick up the new functions straight away
notify pgrst, 'reload schema';
