-- Patch 8: acceptance of the Terms and Privacy Policy, account deletion with a 22 day wait, a customer service inbox,
-- admin tools for instructors, and admin editing of the course lectures with a change history.
-- Run once in Supabase > SQL Editor, after RUN-ME-2.sql and RUN-ME-3.sql. Safe to run more than once.
-- Nothing changes for anyone until the new version of the app is live.

-- 1. Terms of Service and Privacy Policy acceptance -----------------------------------------------------------------------------------------------
alter table public.profiles
  add column if not exists terms_version text,
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists privacy_version text,
  add column if not exists deletion_requested_at timestamptz;
create index if not exists profiles_deletion_idx on public.profiles (deletion_requested_at) where deletion_requested_at is not null;

-- a version label such as '2026-10' or 'v1.2': 1 to 32 letters, numbers, dots, dashes or underscores
create or replace function public.version_ok(v text) returns boolean
language sql immutable as $$ select coalesce(v ~ '^[A-Za-z0-9._-]{1,32}$', false); $$;

-- one line for every time a person accepted a version (the history that proves which wording they agreed to)
create table if not exists public.terms_acceptances (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete cascade,
  terms_version text not null,
  privacy_version text not null,
  accepted_at timestamptz not null default now());
create index if not exists terms_acceptances_user_idx on public.terms_acceptances (user_id, accepted_at desc);
alter table public.terms_acceptances enable row level security;
revoke all on public.terms_acceptances from anon, authenticated;     -- nobody writes directly; the functions below do
grant select on public.terms_acceptances to authenticated;
drop policy if exists "terms read" on public.terms_acceptances;
create policy "terms read" on public.terms_acceptances for select using (user_id = auth.uid() or public.is_admin());

create or replace function public.accept_terms(tv text, pv text) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); cur_t text; cur_p text;
begin
  if uid is null then return; end if;
  if not public.version_ok(tv) or not public.version_ok(pv) then raise exception 'invalid version (use 1 to 32 letters, numbers, dots, dashes or underscores)'; end if;
  select terms_version, privacy_version into cur_t, cur_p from public.profiles where id = uid;
  if cur_t is not distinct from tv and cur_p is not distinct from pv then return; end if;   -- already on record: keep the first date
  if (select count(*) from public.terms_acceptances where user_id = uid and accepted_at > now() - interval '1 day') >= 10 then raise exception 'too many changes today'; end if;
  update public.profiles set terms_version = tv, privacy_version = pv, terms_accepted_at = now() where id = uid;
  insert into public.terms_acceptances (user_id, terms_version, privacy_version) values (uid, tv, pv);
end $$;

-- new accounts: as before (allowed domains, admin email, invites), and the versions the person accepted on the sign-up form are put on record.
-- Bad or missing terms values are ignored: they never stop a sign-up.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare adm text; doms text; ok boolean; tv text; pv text;
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
  begin
    tv := new.raw_user_meta_data ->> 'terms_version';
    pv := new.raw_user_meta_data ->> 'privacy_version';
    if public.version_ok(tv) and public.version_ok(pv) then
      update public.profiles set terms_version = tv, privacy_version = pv, terms_accepted_at = now() where id = new.id;
      insert into public.terms_acceptances (user_id, terms_version, privacy_version) values (new.id, tv, pv);
    end if;
  exception when others then null;
  end;
  return new;
end $$;

-- 2. deleting an account: a 22 day wait, then the account is removed for good ---------------------------------------------------------------------
-- The person asks to delete; nothing is removed yet. Logging in again within 22 days cancels it (the app calls cancel_account_deletion on every login).
-- A daily job (purge_deleted_accounts) removes the accounts whose wait is over: profile, progress, class memberships and acceptances go with them.
create or replace function public.deletion_grace() returns interval
language sql immutable as $$ select interval '22 days'; $$;

create or replace function public.request_account_deletion() returns timestamptz
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); asked timestamptz;
begin
  if uid is null then return null; end if;
  if exists (select 1 from public.profiles where id = uid and is_admin) then
    raise exception 'admin accounts cannot be deleted here';
  end if;
  update public.profiles set deletion_requested_at = now() where id = uid and deletion_requested_at is null returning deletion_requested_at into asked;
  if found then
    perform public.log_action('request account deletion', null, 'permanent deletion on ' || (asked + public.deletion_grace())::date::text);
  else   -- already asked: the date does not move
    select deletion_requested_at into asked from public.profiles where id = uid;
  end if;
  if asked is null then return null; end if;
  return asked + public.deletion_grace();
end $$;

create or replace function public.cancel_account_deletion() returns boolean
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null then return false; end if;
  update public.profiles set deletion_requested_at = null where id = auth.uid() and deletion_requested_at is not null;
  get diagnostics n = row_count;
  if n = 0 then return false; end if;
  perform public.log_action('cancel account deletion', null, null);
  return true;
end $$;

-- removes every account whose 22 days are over (never an admin). Only the database owner and the daily job may run it.
create or replace function public.purge_deleted_accounts() returns int
language plpgsql security definer set search_path = public, auth as $$
declare r record; n int := 0;
begin
  for r in select p.id, p.deletion_requested_at as asked from public.profiles p
           where p.deletion_requested_at is not null and p.deletion_requested_at <= now() - public.deletion_grace() and not p.is_admin loop
    begin
      delete from auth.users where id = r.id;   -- also removes the profile, progress, summaries, memberships and acceptances
      perform public.log_action('purge deleted account', r.id::text, 'requested on ' || r.asked::date::text);   -- the audit line holds an id, not a name or an email
      n := n + 1;
    exception when others then
      raise warning 'could not remove account %: %', r.id, sqlerrm;   -- one stuck account must not stop the others
    end;
  end loop;
  return n;
end $$;

-- the daily job. It needs the pg_cron extension; where that cannot be switched on from here the patch still succeeds and says what to do by hand.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    begin
      create extension if not exists pg_cron;
      execute $c$select cron.unschedule(jobid) from cron.job where jobname = 'aceit-purge-deleted-accounts'$c$;
      execute $c$select cron.schedule('aceit-purge-deleted-accounts', '17 3 * * *', 'select public.purge_deleted_accounts()')$c$;
    exception when others then
      raise notice 'The daily job that removes accounts after their 22 day wait could not be set up automatically (%). Do this once by hand: Supabase Dashboard > Database > Extensions > enable pg_cron, then run this one line in the SQL Editor: select cron.schedule(''aceit-purge-deleted-accounts'', ''17 3 * * *'', ''select public.purge_deleted_accounts()'');', sqlerrm;
    end;
  else
    raise notice 'The daily job that removes accounts after their 22 day wait was not set up, because pg_cron is not available here. Do this once by hand: Supabase Dashboard > Database > Extensions > enable pg_cron, then run this one line in the SQL Editor: select cron.schedule(''aceit-purge-deleted-accounts'', ''17 3 * * *'', ''select public.purge_deleted_accounts()'');';
  end if;
end $$;

-- when a person changes their sign-in email (Change my email), the copy in their profile follows
create or replace function public.sync_profile_email() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set email = new.email where id = new.id and email is distinct from new.email;
  return new;
end $$;
drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed after update of email on auth.users
  for each row when (old.email is distinct from new.email) execute function public.sync_profile_email();

-- 3. customer service questions (an inbox for the platform admin) ----------------------------------------------------------------------------------
create table if not exists public.support_questions (
  id bigserial primary key,
  at timestamptz not null default now(),
  user_id uuid references auth.users(id) on delete set null,
  email text,
  name text,
  topic text,
  message text not null,
  status text not null default 'open' check (status in ('open', 'answered', 'closed')),
  admin_note text,
  handled_by uuid,
  handled_at timestamptz);
create index if not exists support_questions_user_idx on public.support_questions (user_id, at);
create index if not exists support_questions_status_idx on public.support_questions (status, at desc);
alter table public.support_questions enable row level security;
revoke all on public.support_questions from anon, authenticated;
grant select on public.support_questions to authenticated;
drop policy if exists "questions read" on public.support_questions;
create policy "questions read" on public.support_questions for select using (public.is_admin());

-- when an account is removed (by anyone), the name and email on its old questions go with it; the question text stays for the admin
create or replace function public.scrub_support_questions() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.support_questions set email = null, name = null where user_id = old.id;
  return old;
end $$;
drop trigger if exists scrub_support_on_user_delete on auth.users;
create trigger scrub_support_on_user_delete before delete on auth.users
  for each row execute function public.scrub_support_questions();

create or replace function public.submit_question(topic text, message text) returns void
language plpgsql security definer set search_path = public as $$
declare t text := regexp_replace(coalesce(submit_question.topic, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g');
        m text := regexp_replace(coalesce(submit_question.message, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g');
        em text; nm text;
begin
  if auth.uid() is null then return; end if;
  if char_length(t) < 1 or char_length(t) > 60 or t ~ '[[:cntrl:]]' then raise exception 'Choose a topic (1 to 60 characters, on one line).'; end if;
  if char_length(m) < 5 or char_length(m) > 2000 then raise exception 'Write your question in 5 to 2000 characters.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('support_questions:' || auth.uid()::text, 0));   -- two sends at the same moment cannot get past the daily limit
  if (select count(*) from public.support_questions q where q.user_id = auth.uid() and q.at > now() - interval '1 day') >= 5 then raise exception 'too many messages today'; end if;
  select p.email, p.display_name into em, nm from public.profiles p where p.id = auth.uid();
  insert into public.support_questions (user_id, email, name, topic, message) values (auth.uid(), em, nm, t, m);
end $$;

create or replace function public.admin_questions(status_filter text default null) returns table (id bigint, at timestamptz, user_id uuid, email text, name text, topic text, message text, status text, admin_note text)
language sql security definer set search_path = public stable as $$
  select q.id, q.at, q.user_id, q.email, q.name, q.topic, q.message, q.status, q.admin_note
  from public.support_questions q
  where public.is_admin() and (nullif(status_filter, '') is null or q.status = status_filter)
  order by q.at desc, q.id desc limit 200;
$$;

create or replace function public.admin_set_question_status(qid bigint, new_status text, note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare n text;
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  if new_status is null or new_status not in ('open', 'answered', 'closed') then raise exception 'unknown status'; end if;
  n := regexp_replace(admin_set_question_status.note, '^[[:space:]]+|[[:space:]]+$', '', 'g');
  if char_length(n) > 1000 then raise exception 'The note can be up to 1000 characters.'; end if;
  update public.support_questions q set status = new_status, admin_note = case when admin_set_question_status.note is null then q.admin_note else nullif(n, '') end,
         handled_by = auth.uid(), handled_at = now() where q.id = qid;
  if not found then raise exception 'no such question'; end if;
  perform public.log_action('set question status', qid::text, new_status);
end $$;

-- a person reads their own questions and the admin's reply (note and status), so no email is needed
create or replace function public.my_questions() returns table (id bigint, at timestamptz, topic text, message text, status text, admin_note text, handled_at timestamptz)
language sql security definer set search_path = public stable as $$
  select q.id, q.at, q.topic, q.message, q.status, q.admin_note, q.handled_at
  from public.support_questions q
  where q.user_id = auth.uid()
  order by q.at desc, q.id desc limit 50;
$$;

-- 4. the platform admin makes a person an instructor of a class (or takes the role away) -------------------------------------------------------------
-- (the platform admin can also use invite_user(..., 'teacher', ...) for a person who has not signed up yet)
create or replace function public.admin_set_instructor_of(uid uuid, kid uuid, flag boolean) returns void
language plpgsql security definer set search_path = public as $$
declare sid uuid; em text;
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  if flag is null then raise exception 'choose add or remove'; end if;
  select c.school_id into sid from public.classes c where c.id = kid;
  if sid is null then raise exception 'unknown class'; end if;
  select p.email into em from public.profiles p where p.id = uid;
  if em is null then raise exception 'no such account'; end if;
  if flag then
    if not public.email_ok(uid) then raise exception 'that person must confirm their email first'; end if;
    insert into public.class_teachers (user_id, class_id) values (uid, kid) on conflict do nothing;
  else
    delete from public.class_teachers where user_id = uid and class_id = kid;
  end if;
  perform public.log_action(case when flag then 'add instructor' else 'remove instructor' end, em, kid::text, sid);
end $$;

create or replace function public.admin_instructor_classes(uid uuid) returns table (class_id uuid, class_name text, school_name text)
language sql security definer set search_path = public stable as $$
  select c.id, c.name, s.name from public.class_teachers t join public.classes c on c.id = t.class_id join public.schools s on s.id = c.school_id
  where t.user_id = uid and public.is_admin() order by s.name, c.name;
$$;

-- 5. the platform admin edits the course lectures, with a history that can be undone -----------------------------------------------------------------
create table if not exists public.content_history (
  id bigserial primary key,
  at timestamptz not null default now(),
  user_id uuid,
  user_email text,
  lecture_id text not null,
  course_id text not null,
  summary text,
  before jsonb,
  after jsonb,
  undone boolean not null default false);
create index if not exists content_history_lecture_idx on public.content_history (lecture_id, id desc);
alter table public.content_history enable row level security;
revoke all on public.content_history from anon, authenticated;
grant select on public.content_history to authenticated;
drop policy if exists "content history read" on public.content_history;
create policy "content history read" on public.content_history for select using (public.is_admin());

-- saves a lecture and keeps the version it replaced. old_body is what the lecture looked like before its first edit (the published file); it is used only
-- when the database has no copy of the lecture yet. Only the newest 100 changes of a lecture are kept.
create or replace function public.admin_save_lecture(lid text, cid text, new_body jsonb, old_body jsonb default null, summary text default null) returns bigint
language plpgsql security definer set search_path = public as $$
declare cur public.lecture_content; bef jsonb; s text; em text; hid bigint; k text;
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  if lid is null or lid !~ '^[A-Za-z0-9_-]{1,64}$' then raise exception 'The lecture id must be 1 to 64 letters, numbers, dashes or underscores.'; end if;
  if cid is null or cid !~ '^[A-Za-z0-9_-]{1,64}$' then raise exception 'The course id must be 1 to 64 letters, numbers, dashes or underscores.'; end if;
  if not exists (select 1 from public.courses c where c.id = cid) then raise exception 'unknown course'; end if;
  if new_body is null or jsonb_typeof(new_body) <> 'object' then raise exception 'The lecture must be an object.'; end if;
  foreach k in array array['sections', 'cards', 'quiz'] loop
    if jsonb_exists(new_body, k) and jsonb_typeof(new_body -> k) <> 'array' then raise exception 'The "%" part of the lecture must be a list.', k; end if;
  end loop;
  if octet_length(new_body::text) > 2000000 then raise exception 'This lecture is too large (the limit is 2 MB).'; end if;
  if old_body is not null and (jsonb_typeof(old_body) <> 'object' or octet_length(old_body::text) > 2000000) then raise exception 'The earlier version of the lecture is not valid.'; end if;
  s := left(regexp_replace(coalesce(admin_save_lecture.summary, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g'), 200);
  if s = '' then s := 'Edited'; end if;
  perform pg_advisory_xact_lock(hashtextextended('lecture:' || lid, 0));   -- one save at a time per lecture
  select * into cur from public.lecture_content where lecture_id = lid;
  if cur.lecture_id is not null then
    if cur.class_id <> cid then raise exception 'That lecture belongs to another course.'; end if;
    bef := cur.body;
  else
    bef := old_body;
  end if;
  insert into public.lecture_content (lecture_id, class_id, body, updated_at) values (lid, cid, new_body, now())
    on conflict (lecture_id) do update set class_id = excluded.class_id, body = excluded.body, updated_at = excluded.updated_at;
  select p.email into em from public.profiles p where p.id = auth.uid();
  insert into public.content_history (user_id, user_email, lecture_id, course_id, summary, before, after) values (auth.uid(), em, lid, cid, s, bef, new_body) returning id into hid;
  delete from public.content_history h where h.lecture_id = lid
    and h.id < coalesce((select x.id from public.content_history x where x.lecture_id = lid order by x.id desc offset 99 limit 1), 0);
  perform public.log_action('edit lecture', lid, s);
  return hid;
end $$;

create or replace function public.admin_content_history(lid text) returns table (id bigint, at timestamptz, user_email text, summary text, undone boolean)
language sql security definer set search_path = public stable as $$
  select h.id, h.at, h.user_email, h.summary, h.undone from public.content_history h
  where public.is_admin() and h.lecture_id = lid order by h.at desc, h.id desc limit 50;
$$;

-- puts the lecture back the way it was before one change; the undo is itself a change in the history, so it can be undone too
create or replace function public.admin_undo_content_change(hid bigint) returns bigint
language plpgsql security definer set search_path = public as $$
declare h public.content_history; cur jsonb; em text; nid bigint; s text;
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  select * into h from public.content_history where id = hid;
  if h.id is null then raise exception 'no such change'; end if;
  perform pg_advisory_xact_lock(hashtextextended('lecture:' || h.lecture_id, 0));
  select * into h from public.content_history where id = hid;   -- (look again now that no other save can run)
  if h.id is null then raise exception 'no such change'; end if;
  if h.before is null then raise exception 'There is nothing to go back to: no earlier version of this lecture was kept.'; end if;
  if h.undone then raise exception 'That change was already undone.'; end if;
  select l.body into cur from public.lecture_content l where l.lecture_id = h.lecture_id;
  insert into public.lecture_content (lecture_id, class_id, body, updated_at) values (h.lecture_id, h.course_id, h.before, now())
    on conflict (lecture_id) do update set class_id = excluded.class_id, body = excluded.body, updated_at = excluded.updated_at;
  update public.content_history set undone = true where id = hid;
  s := left('Undid: ' || coalesce(h.summary, 'Edited'), 200);
  select p.email into em from public.profiles p where p.id = auth.uid();
  insert into public.content_history (user_id, user_email, lecture_id, course_id, summary, before, after) values (auth.uid(), em, h.lecture_id, h.course_id, s, cur, h.before) returning id into nid;
  delete from public.content_history x where x.lecture_id = h.lecture_id
    and x.id < coalesce((select y.id from public.content_history y where y.lecture_id = h.lecture_id order by y.id desc offset 99 limit 1), 0);
  perform public.log_action('undo lecture change', h.lecture_id, s);
  return nid;
end $$;

-- pictures an admin puts into course lectures: a private bucket. Path: <course id>/<name>.<webp|jpg|png>. Anyone who may read the course reads its pictures; only the platform admin adds, replaces or removes them.
do $$
begin
  if to_regclass('storage.objects') is not null and to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('course-media', 'course-media', false, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
    on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
    execute 'drop policy if exists "course media read" on storage.objects';
    execute $p$create policy "course media read" on storage.objects for select to authenticated using (bucket_id = 'course-media' and public.has_course(split_part(name, '/', 1)))$p$;
    execute 'drop policy if exists "course media add" on storage.objects';
    execute $p$create policy "course media add" on storage.objects for insert to authenticated with check (bucket_id = 'course-media'
      and name ~ '^[A-Za-z0-9_-]{1,64}/[A-Za-z0-9_-]{8,64}[.](webp|jpg|png)$' and public.is_admin())$p$;
    execute 'drop policy if exists "course media change" on storage.objects';
    execute $p$create policy "course media change" on storage.objects for update to authenticated using (bucket_id = 'course-media' and public.is_admin())
      with check (bucket_id = 'course-media' and name ~ '^[A-Za-z0-9_-]{1,64}/[A-Za-z0-9_-]{8,64}[.](webp|jpg|png)$' and public.is_admin())$p$;
    execute 'drop policy if exists "course media remove" on storage.objects';
    execute $p$create policy "course media remove" on storage.objects for delete to authenticated using (bucket_id = 'course-media' and public.is_admin())$p$;
  end if;
end $$;

-- 6. who may call what ------------------------------------------------------------------------------------------------------------------------------
-- Postgres lets everybody run a new function unless it is told otherwise, so visitors who are not logged in are shut out explicitly.
grant execute on function
  public.accept_terms(text, text), public.deletion_grace(), public.request_account_deletion(), public.cancel_account_deletion(),
  public.submit_question(text, text), public.my_questions(), public.admin_questions(text), public.admin_set_question_status(bigint, text, text),
  public.admin_set_instructor_of(uuid, uuid, boolean), public.admin_instructor_classes(uuid),
  public.admin_save_lecture(text, text, jsonb, jsonb, text), public.admin_content_history(text), public.admin_undo_content_change(bigint)
to authenticated;
revoke execute on function
  public.accept_terms(text, text), public.deletion_grace(), public.request_account_deletion(), public.cancel_account_deletion(),
  public.submit_question(text, text), public.my_questions(), public.admin_questions(text), public.admin_set_question_status(bigint, text, text),
  public.admin_set_instructor_of(uuid, uuid, boolean), public.admin_instructor_classes(uuid),
  public.admin_save_lecture(text, text, jsonb, jsonb, text), public.admin_content_history(text), public.admin_undo_content_change(bigint)
from public, anon;
-- internal: only the database owner (and the daily job, which runs as the owner) may run these
revoke all on function public.purge_deleted_accounts(), public.sync_profile_email(), public.scrub_support_questions(), public.version_ok(text) from public, anon, authenticated;

notify pgrst, 'reload schema';
