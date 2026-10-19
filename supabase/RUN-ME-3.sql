-- Patch 7: instructors add their own questions, flashcards, notes, announcements and whole lectures to their class, with pictures in a private bucket.
-- Run once in Supabase > SQL Editor, after RUN-ME-2.sql. Safe to run more than once.
-- Nothing changes for students until an instructor publishes something. The shared course material itself can never be changed from here.

-- 1. a school can ask that a manager approves what instructors publish ------------------------------------------------------------------
alter table public.schools add column if not exists require_approval boolean not null default false;

-- 2. the rules every item must follow (the app checks the same rules; tools/test_sql.mjs makes sure they agree) ---------------------------
-- a text value of lo to hi characters once the ends are trimmed, with no control characters and without the app's reserved marker
create or replace function public.txt_ok(v jsonb, lo int, hi int) returns boolean
language sql immutable as $$
  select coalesce(
    jsonb_typeof(v) = 'string'
    and (v #>> '{}') !~ '[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]'
    and position(chr(8291) in (v #>> '{}')) = 0
    and char_length(regexp_replace(v #>> '{}', '^[ \t\r\n]+|[ \t\r\n]+$', '', 'g')) between lo and hi,
    false);
$$;
create or replace function public.img_ok(v jsonb) returns boolean
language sql immutable as $$
  select coalesce(jsonb_typeof(v) = 'object' and (v - array['path', 'alt']) = '{}'::jsonb and public.txt_ok(v -> 'path', 5, 200) and public.txt_ok(v -> 'alt', 1, 200), false);
$$;
-- the first thing wrong with an item, or null when it is fine
create or replace function public.item_problem(k text, b jsonb) returns text
language plpgsql immutable as $$
declare n int; o jsonb; seen text[] := '{}'; t text; s text;
begin
  if b is null or jsonb_typeof(b) <> 'object' then return 'That is not a valid item.'; end if;
  if k = 'question' then
    if (b - array['q', 'options', 'answer', 'why', 'img']) <> '{}'::jsonb then return 'This question has fields that are not allowed.'; end if;
    if not public.txt_ok(b -> 'q', 3, 700) then return 'Write the question (3 to 700 characters).'; end if;
    if coalesce(jsonb_typeof(b -> 'options'), '') <> 'array' then return 'Add the answer options.'; end if;
    n := jsonb_array_length(b -> 'options');
    if n < 2 or n > 5 then return 'Use 2 to 5 answer options.'; end if;
    for o in select * from jsonb_array_elements(b -> 'options') loop
      if not public.txt_ok(o, 1, 300) then return 'Each answer option needs 1 to 300 characters.'; end if;
      t := lower(regexp_replace(o #>> '{}', '^[ \t\r\n]+|[ \t\r\n]+$', '', 'g'));
      if t = any (seen) then return 'Two answer options are the same.'; end if;
      seen := seen || t;
    end loop;
    if coalesce(jsonb_typeof(b -> 'answer'), '') <> 'number' or (b ->> 'answer') !~ '^[0-9]{1,3}$' then return 'Mark which option is correct.'; end if;
    if (b ->> 'answer')::int >= n then return 'Mark which option is correct.'; end if;
    if jsonb_exists(b, 'why') and not public.txt_ok(b -> 'why', 0, 800) then return 'The explanation can be up to 800 characters.'; end if;
    if jsonb_exists(b, 'img') and not public.img_ok(b -> 'img') then return 'The picture needs a description for people who cannot see it.'; end if;
    return null;
  elsif k = 'card' then
    if (b - array['front', 'back', 'short']) <> '{}'::jsonb then return 'This flashcard has fields that are not allowed.'; end if;
    if not public.txt_ok(b -> 'front', 1, 200) then return 'Write the front of the card (up to 200 characters).'; end if;
    if not public.txt_ok(b -> 'back', 1, 800) then return 'Write the back of the card (up to 800 characters).'; end if;
    if jsonb_exists(b, 'short') and not public.txt_ok(b -> 'short', 0, 100) then return 'The short version can be up to 100 characters.'; end if;
    return null;
  elsif k = 'note' then
    if (b - array['title', 'bullets', 'img']) <> '{}'::jsonb then return 'This note has fields that are not allowed.'; end if;
    if not public.txt_ok(b -> 'title', 1, 150) then return 'Give the note a title (up to 150 characters).'; end if;
    if jsonb_exists(b, 'bullets') then
      if coalesce(jsonb_typeof(b -> 'bullets'), '') <> 'array' or jsonb_array_length(b -> 'bullets') > 15 then return 'A note can have up to 15 points.'; end if;
      for o in select * from jsonb_array_elements(b -> 'bullets') loop
        if not public.txt_ok(o, 1, 500) then return 'Each point needs 1 to 500 characters.'; end if;
      end loop;
    end if;
    if jsonb_exists(b, 'img') and not public.img_ok(b -> 'img') then return 'The picture needs a description for people who cannot see it.'; end if;
    return null;
  elsif k = 'lecture' then
    if (b - array['title', 'chapter', 'icon', 'intro']) <> '{}'::jsonb then return 'This lecture has fields that are not allowed.'; end if;
    if not public.txt_ok(b -> 'title', 1, 100) then return 'Give the lecture a title (up to 100 characters).'; end if;
    if jsonb_exists(b, 'chapter') and not public.txt_ok(b -> 'chapter', 0, 60) then return 'The label can be up to 60 characters.'; end if;
    if jsonb_exists(b, 'icon') and not public.txt_ok(b -> 'icon', 1, 8) then return 'Pick an icon.'; end if;
    if jsonb_exists(b, 'intro') and not public.txt_ok(b -> 'intro', 0, 600) then return 'The introduction can be up to 600 characters.'; end if;
    return null;
  elsif k = 'announcement' then
    if (b - array['title', 'text', 'until']) <> '{}'::jsonb then return 'This announcement has fields that are not allowed.'; end if;
    if not public.txt_ok(b -> 'title', 1, 120) then return 'Give the announcement a title (up to 120 characters).'; end if;
    if jsonb_exists(b, 'text') and not public.txt_ok(b -> 'text', 0, 1500) then return 'The message can be up to 1500 characters.'; end if;
    if jsonb_exists(b, 'until') then
      s := b ->> 'until';
      if coalesce(jsonb_typeof(b -> 'until'), '') <> 'string' or s !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or s < '2000-01-01' or s > '2100-12-31' then return 'Choose a valid last day to show it.'; end if;
      begin
        if to_char(s::date, 'YYYY-MM-DD') <> s then return 'Choose a valid last day to show it.'; end if;
      exception when others then return 'Choose a valid last day to show it.';
      end;
    end if;
    return null;
  end if;
  return 'Unknown kind of item.';
end $$;

-- 3. the items -----------------------------------------------------------------------------------------------------------------------------
-- kind: lecture (a whole lecture of this class), note, card, question (each belongs to a lecture: lecture_ref is a course lecture id such as 'motion',
-- or the id of one of this class's own lectures), announcement. Students read published items of their classes; the class's staff read everything.
create table if not exists public.class_items (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  kind text not null check (kind in ('lecture', 'note', 'card', 'question', 'announcement')),
  lecture_ref text,
  position int not null default 0,
  status text not null default 'draft' check (status in ('draft', 'review', 'published')),
  body jsonb not null,
  author_id uuid,
  author_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint class_items_ref check ((kind in ('note', 'card', 'question')) = (lecture_ref is not null)),
  constraint class_items_size check (pg_column_size(body) < 24000));
create index if not exists class_items_class_idx on public.class_items (class_id, kind, lecture_ref, position);
create index if not exists class_items_img_idx on public.class_items ((body #>> '{img,path}')) where (body #>> '{img,path}') is not null;
alter table public.class_items enable row level security;
revoke all on public.class_items from anon, authenticated;     -- every change goes through the functions below
grant select on public.class_items to authenticated;

-- a school that is suspended shows nothing to its students
create or replace function public.class_open(cid uuid) returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.classes c join public.schools s on s.id = c.school_id where c.id = cid and s.active);
$$;
drop policy if exists "class items read" on public.class_items;
create policy "class items read" on public.class_items for select using (
  public.can_teach_class(class_id)
  or (status = 'published' and public.class_open(class_id) and exists (select 1 from public.enrollments e where e.user_id = auth.uid() and e.class_id = class_items.class_id)));

-- 4. adding, changing, publishing, removing ------------------------------------------------------------------------------------------------
create or replace function public.save_class_item(kid uuid, k text, ref text, b jsonb, item_id uuid default null, pos int default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare sid uuid; p text; cnt int; per int; cur public.class_items; st text; newid uuid; nm text; cname text; mgr boolean; req boolean;
begin
  if auth.uid() is null or not public.can_teach_class(kid) then raise exception 'instructors only'; end if;
  select c.school_id, c.name, s.require_approval into sid, cname, req from public.classes c join public.schools s on s.id = c.school_id where c.id = kid;
  if sid is null then raise exception 'unknown class'; end if;
  if k not in ('lecture', 'note', 'card', 'question', 'announcement') then raise exception 'unknown kind'; end if;
  p := public.item_problem(k, b);
  if p is not null then raise exception '%', p; end if;
  if jsonb_exists(b, 'img') and (b -> 'img' ->> 'path') not like (kid::text || '/%') then raise exception 'That picture belongs to another class.'; end if;
  if k in ('note', 'card', 'question') then
    if coalesce(ref, '') = '' then raise exception 'Choose a lecture.'; end if;
    if ref ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      if not exists (select 1 from public.class_items x where x.id = ref::uuid and x.class_id = kid and x.kind = 'lecture') then raise exception 'That lecture is not in this class.'; end if;
    elsif ref !~ '^[a-z0-9][a-z0-9_-]{1,39}$' then raise exception 'Choose a lecture.'; end if;
  elsif ref is not null then raise exception 'This kind of item does not belong to a lecture.';
  end if;
  mgr := public.is_manager_of(sid);
  if item_id is not null then
    select * into cur from public.class_items where id = item_id;
    if cur.id is null or cur.class_id <> kid then raise exception 'That item is not in this class.'; end if;
    if cur.kind <> k then raise exception 'The kind of an item cannot change.'; end if;
    st := cur.status;
    if st = 'published' and req and not mgr then st := 'review'; end if;   -- in a school that wants approval, a changed item goes back for review
    update public.class_items set body = b, lecture_ref = ref, position = coalesce(pos, position), status = st, updated_at = now() where id = item_id;
    return item_id;
  end if;
  select count(*) into cnt from public.class_items where class_id = kid;
  if cnt >= 600 then raise exception 'This class already has 600 items, the most it can hold.'; end if;
  if ref is not null then
    select count(*) into per from public.class_items where class_id = kid and lecture_ref = ref;
    if per >= 200 then raise exception 'That lecture already has 200 items, the most it can hold.'; end if;
  end if;
  select display_name into nm from public.profiles where id = auth.uid();
  insert into public.class_items (class_id, kind, lecture_ref, position, status, body, author_id, author_name)
  values (kid, k, ref, coalesce(pos, (select coalesce(max(x.position), 0) + 1 from public.class_items x where x.class_id = kid and x.kind = k and x.lecture_ref is not distinct from ref)), 'draft', b, auth.uid(), nm)
  returning id into newid;
  perform public.log_action('add ' || k, left(coalesce(b ->> 'title', b ->> 'q', b ->> 'front', ''), 60), cname, sid);
  return newid;
end $$;

-- draft -> published (or, in a school that wants approval, -> review until a manager approves); published/review -> draft takes it back
create or replace function public.set_class_item_status(item_id uuid, new_status text, with_children boolean default false) returns text
language plpgsql security definer set search_path = public as $$
declare cur public.class_items; sid uuid; mgr boolean; req boolean; res text; cname text;
begin
  if new_status not in ('draft', 'review', 'published') then raise exception 'unknown status'; end if;
  select * into cur from public.class_items where id = item_id;
  if cur.id is null then raise exception 'no such item'; end if;
  if auth.uid() is null or not public.can_teach_class(cur.class_id) then raise exception 'instructors only'; end if;
  select c.school_id, c.name, s.require_approval into sid, cname, req from public.classes c join public.schools s on s.id = c.school_id where c.id = cur.class_id;
  mgr := public.is_manager_of(sid);
  res := case when new_status = 'draft' then 'draft' when cur.status = 'published' then 'published' when req and not mgr then 'review' else 'published' end;
  update public.class_items set status = res, updated_at = now()
   where id = item_id or (with_children and cur.kind = 'lecture' and lecture_ref = item_id::text and (res = 'draft' or status <> 'published'));
  perform public.log_action(case res when 'published' then 'publish class item' when 'review' then 'submit class item for approval' else 'unpublish class item' end,
                            left(coalesce(cur.body ->> 'title', cur.body ->> 'q', cur.body ->> 'front', ''), 60), cname, sid);
  return res;
end $$;

-- removes an item (a lecture takes its notes, cards and questions with it) and tells the app which pictures to delete
create or replace function public.delete_class_item(item_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cur public.class_items; paths jsonb; sid uuid; cname text;
begin
  select * into cur from public.class_items where id = item_id;
  if cur.id is null then return '[]'::jsonb; end if;
  if auth.uid() is null or not public.can_teach_class(cur.class_id) then raise exception 'instructors only'; end if;
  select c.school_id, c.name into sid, cname from public.classes c where c.id = cur.class_id;
  select coalesce(jsonb_agg(x.body #>> '{img,path}') filter (where x.body #>> '{img,path}' is not null), '[]'::jsonb) into paths
    from public.class_items x where x.id = item_id or (cur.kind = 'lecture' and x.lecture_ref = item_id::text);
  delete from public.class_items where id = item_id or (cur.kind = 'lecture' and lecture_ref = item_id::text);
  perform public.log_action('delete class item', left(coalesce(cur.body ->> 'title', cur.body ->> 'q', cur.body ->> 'front', ''), 60), cname, sid);
  return paths;
end $$;

create or replace function public.reorder_class_items(kid uuid, ids uuid[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.can_teach_class(kid) then raise exception 'instructors only'; end if;
  update public.class_items c set position = o.ord from unnest(ids) with ordinality as o(id, ord) where c.id = o.id and c.class_id = kid;
end $$;

-- a copy of one class's items in another class (for next term). Everything arrives as a draft. Pictures must be copied by the app: the rows returned
-- say which file goes where.
create or replace function public.copy_class_items(from_kid uuid, to_kid uuid) returns table (new_id uuid, old_path text, new_path text)
language plpgsql security definer set search_path = public as $$
declare r public.class_items; m jsonb := '{}'::jsonb; nid uuid; nb jsonb; nref text; op text; np text; have int; adding int; nm text;
begin
  if auth.uid() is null or not public.can_teach_class(from_kid) or not public.can_teach_class(to_kid) then raise exception 'instructors only'; end if;
  if from_kid = to_kid then raise exception 'Choose a different class.'; end if;
  select count(*) into have from public.class_items where class_id = to_kid;
  select count(*) into adding from public.class_items where class_id = from_kid and kind <> 'announcement';
  if have + adding > 600 then raise exception 'The other class would have more than 600 items.'; end if;
  select display_name into nm from public.profiles where id = auth.uid();
  for r in select * from public.class_items where class_id = from_kid and kind = 'lecture' order by position, created_at loop
    insert into public.class_items (class_id, kind, position, status, body, author_id, author_name) values (to_kid, 'lecture', r.position, 'draft', r.body, auth.uid(), nm) returning id into nid;
    m := m || jsonb_build_object(r.id::text, nid::text);
  end loop;
  for r in select * from public.class_items where class_id = from_kid and kind in ('note', 'card', 'question') order by position, created_at loop
    nref := coalesce(m ->> r.lecture_ref, r.lecture_ref);
    nb := r.body; op := nb #>> '{img,path}'; np := null;
    if op is not null then np := to_kid::text || '/' || split_part(op, '/', 2); nb := jsonb_set(nb, '{img,path}', to_jsonb(np)); end if;
    insert into public.class_items (class_id, kind, lecture_ref, position, status, body, author_id, author_name) values (to_kid, r.kind, nref, r.position, 'draft', nb, auth.uid(), nm) returning id into nid;
    if op is not null then new_id := nid; old_path := op; new_path := np; return next; end if;
  end loop;
  perform public.log_action('copy class content', (select name from public.classes where id = from_kid), (select name from public.classes where id = to_kid), (select school_id from public.classes where id = to_kid));
end $$;

create or replace function public.set_school_approval(sid uuid, flag boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_manager_of(sid) then raise exception 'school managers only'; end if;
  update public.schools set require_approval = flag where id = sid;
  perform public.log_action(case when flag then 'require approval of class content' else 'stop requiring approval of class content' end, (select name from public.schools where id = sid), null, sid);
end $$;

-- what is waiting for a manager's approval in a school
create or replace function public.review_queue(sid uuid) returns table (item_id uuid, class_id uuid, class_name text, kind text, lecture_ref text, body jsonb, author_name text, updated_at timestamptz)
language sql security definer set search_path = public stable as $$
  select i.id, i.class_id, c.name, i.kind, i.lecture_ref, i.body, i.author_name, i.updated_at
  from public.class_items i join public.classes c on c.id = i.class_id
  where c.school_id = sid and i.status = 'review' and public.is_manager_of(sid) order by i.updated_at;
$$;

-- 5. pictures: a private bucket. Only the class's staff add files; students read only pictures of published items of their own class ------------
create or replace function public.media_class(name text) returns uuid
language plpgsql immutable as $$ begin return split_part(name, '/', 1)::uuid; exception when others then return null; end $$;
create or replace function public.can_read_media(name text) returns boolean
language sql security definer set search_path = public stable as $$
  select public.can_teach_class(public.media_class(name))
      or (public.class_open(public.media_class(name))
          and exists (select 1 from public.enrollments e join public.class_items i on i.class_id = e.class_id
                      where e.user_id = auth.uid() and e.class_id = public.media_class(name) and i.status = 'published' and (i.body #>> '{img,path}') = name));
$$;
do $$
begin
  if to_regclass('storage.objects') is not null and to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('class-media', 'class-media', false, 1048576, array['image/webp', 'image/jpeg', 'image/png'])
    on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
    execute 'drop policy if exists "class media read" on storage.objects';
    execute $p$create policy "class media read" on storage.objects for select to authenticated using (bucket_id = 'class-media' and public.can_read_media(name))$p$;
    -- a class may hold at most 400 picture files (the app deletes a picture when its item goes; this stops a runaway upload loop)
    execute $f$create or replace function public.media_room(fname text) returns boolean
      language sql security definer set search_path = public, storage stable as $g$
        select (select count(*) from storage.objects o where o.bucket_id = 'class-media' and split_part(o.name, '/', 1) = split_part(fname, '/', 1)) < 400;
      $g$
    $f$;
    execute 'drop policy if exists "class media add" on storage.objects';
    execute $p$create policy "class media add" on storage.objects for insert to authenticated with check (bucket_id = 'class-media'
      and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[A-Za-z0-9_-]{8,64}[.](webp|jpg|png)$' and public.can_teach_class(public.media_class(name)) and public.media_room(name))$p$;
    execute 'drop policy if exists "class media remove" on storage.objects';
    execute $p$create policy "class media remove" on storage.objects for delete to authenticated using (bucket_id = 'class-media' and public.can_teach_class(public.media_class(name)))$p$;
  end if;
end $$;

-- 6. who may call what -----------------------------------------------------------------------------------------------------------------------
grant execute on function
  public.save_class_item(uuid, text, text, jsonb, uuid, int), public.set_class_item_status(uuid, text, boolean), public.delete_class_item(uuid), public.reorder_class_items(uuid, uuid[]),
  public.copy_class_items(uuid, uuid), public.set_school_approval(uuid, boolean), public.review_queue(uuid), public.can_read_media(text), public.class_open(uuid)
to authenticated;
do $$ begin
  if to_regprocedure('public.media_room(text)') is not null then
    revoke all on function public.media_room(text) from public, anon;
    grant execute on function public.media_room(text) to authenticated;
  end if;
end $$;
revoke all on function public.txt_ok(jsonb, int, int), public.img_ok(jsonb), public.item_problem(text, jsonb) from public, anon, authenticated;
revoke all on function public.save_class_item(uuid, text, text, jsonb, uuid, int), public.set_class_item_status(uuid, text, boolean), public.delete_class_item(uuid), public.reorder_class_items(uuid, uuid[]),
  public.copy_class_items(uuid, uuid), public.set_school_approval(uuid, boolean), public.review_queue(uuid) from anon;

notify pgrst, 'reload schema';
