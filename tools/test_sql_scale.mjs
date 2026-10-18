// How fast are the staff dashboards with a realistic amount of data? 20 schools, 200 classes, 6000 students, 3 KB of progress each.
//   npm i --no-save embedded-postgres pg   then   node tools/test_sql_scale.mjs   (not part of CI; run it before a big rollout)
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";
import { readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
const R = process.env.ACEIT_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(tmpdir(), "aceit-scale-" + process.pid), PORT = 55000 + (process.pid % 900);
rmSync(dir, { recursive: true, force: true });
const server = new EmbeddedPostgres({ databaseDir: dir, user: "postgres", password: "pw", port: PORT, persistent: false, onLog: () => {}, onError: () => {} });
await server.initialise(); await server.start();
const pm = Number(readFileSync(path.join(dir, "postmaster.pid"), "utf8").split("\n")[0]);
const conn = () => new pg.Client({ host: "localhost", port: PORT, user: "postgres", password: "pw", database: "postgres" });
const admin = conn(); await admin.connect(); const q = (s, p) => admin.query(s, p);
await q(`create role anon nologin; create role authenticated nologin; create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text unique, email_confirmed_at timestamptz default now(), raw_user_meta_data jsonb default '{}'::jsonb);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated; grant usage on schema public to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;`);
await q(readFileSync(R + "/supabase/schema.sql", "utf8"));
await q(`grant all on all tables in schema public to anon, authenticated; grant execute on all functions in schema public to anon, authenticated;`);
const adminEmail = (await q(`select value from public.app_secrets where key='admin_email'`)).rows[0].value;
const ADMIN = (await q(`insert into auth.users(email) values ($1) returning id`, [adminEmail])).rows[0].id;
console.time("load data");
await q(`insert into public.schools (id, name, seat_limit) select gen_random_uuid(), 'School ' || g, 2000 from generate_series(1, 20) g`);
await q(`insert into public.school_courses select s.id, c.id from public.schools s, public.courses c where s.name like 'School %'`);
await q(`insert into public.classes (school_id, course_id, name, code) select s.id, (array['erth209','astr207'])[1 + (g % 2)], 'Class ' || g, upper(substr(md5(s.id::text || g), 1, 8)) from public.schools s, generate_series(1, 10) g where s.name like 'School %'`);
await q(`insert into auth.users (email) select 'student' || g || '@x.ca' from generate_series(1, 6000) g`);
await q(`with k as (select id, row_number() over () rn from public.classes where school_id <> '00000000-0000-0000-0000-000000000001'), u as (select id, row_number() over () rn from auth.users where email like 'student%')
  insert into public.enrollments (user_id, class_id) select u.id, k.id from u join k on k.rn = ((u.rn - 1) % 200) + 1`);
await q(`insert into public.progress (user_id, data) select id, jsonb_build_object('quiz', (select jsonb_object_agg('q' || n, jsonb_build_object('attempts', 3, 'correct', 2, 'last', true)) from generate_series(1, 60) n), 'read', '{}'::jsonb, 'cards', '{}'::jsonb, 'games', '{}'::jsonb) from auth.users where email like 'student%'`);
await q(`insert into public.progress_summary (user_id, course_id, pct, mastery, read_topics, cards_known, cards_total, quiz_attempts, quiz_correct, last_active)
  select e.user_id, c.course_id, (random() * 100)::int, (random() * 100)::int, 5, 10, 60, 30, 20, now() - (random() * 20 || ' days')::interval from public.enrollments e join public.classes c on c.id = e.class_id`);
await q(`analyze`);
console.timeEnd("load data");
const sch = (await q(`select id from public.schools where name = 'School 1'`)).rows[0].id;
const MGR = (await q(`insert into auth.users(email) values ('mgr@x.ca') returning id`)).rows[0].id; await q(`insert into public.school_managers values ($1,$2)`, [MGR, sch]);
const kid = (await q(`select id from public.classes where school_id=$1 limit 1`, [sch])).rows[0].id;
const TCH = (await q(`insert into auth.users(email) values ('t@x.ca') returning id`)).rows[0].id; await q(`insert into public.class_teachers values ($1,$2)`, [TCH, kid]);
async function as(uid, sql, label) {
  const c = conn(); await c.connect(); await c.query("begin"); await c.query("set local role authenticated"); await c.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid]);
  const t0 = performance.now(); const r = await c.query(sql); const ms = performance.now() - t0; await c.query("rollback"); await c.end();
  console.log(`${label.padEnd(58)} ${String(r.rows.length).padStart(5)} rows  ${ms.toFixed(0).padStart(5)} ms`); return ms;
}
const times = [];
times.push(await as(ADMIN, `select * from public.staff_schools()`, "admin: all schools with counts"));
times.push(await as(ADMIN, `select * from public.staff_classes()`, "admin: every class (200)"));
times.push(await as(MGR, `select * from public.staff_schools()`, "manager: own school"));
times.push(await as(MGR, `select * from public.staff_classes()`, "manager: classes of own school"));
times.push(await as(MGR, `select * from public.class_roster('${kid}')`, "manager: roster of one class (30 students)"));
times.push(await as(TCH, `select * from public.class_roster('${kid}')`, "instructor: roster of own class"));
times.push(await as(TCH, `select * from public.class_question_stats('${kid}')`, "instructor: hardest-question statistics (30 students x 60 questions)"));
times.push(await as(TCH, `select * from public.profiles`, "instructor: profiles visible to them (RLS)"));
times.push(await as(MGR, `select * from public.profiles`, "manager: profiles visible to them (RLS)"));
times.push(await as(ADMIN, `select id,email from public.profiles where email ilike '%student59%' limit 12`, "admin: find a person"));
const w = Math.max(...times);
console.log(`\nslowest: ${w.toFixed(0)} ms ->`, w < 800 ? "fine for a school" : "needs an index or a rewrite");
try { await admin.end(); } catch {} try { await server.stop(); } catch {} try { process.kill(pm); } catch {} try { rmSync(dir, { recursive: true, force: true }); } catch {}
process.exit(0);
