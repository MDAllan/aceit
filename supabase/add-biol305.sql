-- Adds the BIOL 305 (Human Biology) course and its first class, join code Ace305.
-- Run once in Supabase > SQL Editor. Safe to run more than once. Run it after RUN-ME-2.sql if you are upgrading to schools.
--
-- After RUN-ME-2.sql (schools): the course is added to the catalogue, licensed to the default school "ACEIT Direct",
--   and a class "Human Biology (BIOL 305)" is created there with the join code Ace305 (codes ignore capital letters).
--   Other schools get the course by ticking BIOL 305 in Platform > Schools > (school) > Settings.
--   If the code Ace305 is already used by another class, no class is created and you can add one in Platform > Schools > ACEIT Direct > Classes.
-- Before RUN-ME-2.sql (older per-course model): the course gets the class code Ace305 (read and change it in the Admin tab).

do $$
begin
  if to_regclass('public.courses') is not null then
    insert into public.courses (id, title) values ('biol305', 'Human Biology (BIOL 305)') on conflict (id) do nothing;
    if to_regclass('public.school_courses') is not null and exists (select 1 from public.schools where id = '00000000-0000-0000-0000-000000000001') then
      insert into public.school_courses (school_id, course_id) values ('00000000-0000-0000-0000-000000000001', 'biol305') on conflict do nothing;
      insert into public.classes (school_id, course_id, name, term, code)
      select '00000000-0000-0000-0000-000000000001', 'biol305', 'Human Biology (BIOL 305)', 'Fall 2026', 'Ace305'
      where not exists (select 1 from public.classes where lower(code) = 'ace305');
    end if;
  elsif to_regclass('public.class_codes') is not null then
    insert into public.class_codes (class_id, code) values ('biol305', 'Ace305') on conflict (class_id) do nothing;
  end if;
end $$;
