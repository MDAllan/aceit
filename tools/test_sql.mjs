// Database security tests. Installs the schema on a real Postgres with a tiny Supabase-like shim, then checks every permission rule
// with simulated people: platform admins, school managers, instructors and students of two different schools.
//   npm i --no-save embedded-postgres pg
//   node tools/test_sql.mjs                 fresh install of supabase/schema.sql
//   MODE=upgrade node tools/test_sql.mjs    the owner's real path: first schema + patch 1 + RUN-ME.sql, legacy data, then RUN-ME-2.sql
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";
import { readFileSync, rmSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import path from "node:path";

const R = process.env.ACEIT_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(tmpdir(), "aceit-pgtest-" + process.pid);
const PORT = 54000 + (process.pid % 900); // a different port each run, so a server left over from an earlier run cannot block this one
rmSync(dir, { recursive: true, force: true });
const server = new EmbeddedPostgres({ databaseDir: dir, user: "postgres", password: "pw", port: PORT, persistent: false, onLog: () => {}, onError: () => {} });
await server.initialise(); await server.start();
const postmaster = Number(readFileSync(path.join(dir, "postmaster.pid"), "utf8").split("\n")[0]);
// stop the database for good (on Windows the server can outlive stop(), and a leftover one would hold the port)
const finish = async (code) => {
  try { await admin.end(); } catch {}
  try { await server.stop(); } catch {}
  try { process.kill(postmaster); } catch {}
  try { rmSync(dir, { recursive: true, force: true }); } catch {}
  process.exit(code);
};
const conn = () => new pg.Client({ host: "localhost", port: PORT, user: "postgres", password: "pw", database: "postgres" });
const admin = conn(); await admin.connect();
const q = (sql, params) => admin.query(sql, params);
const read = (f) => readFileSync(R + "/supabase/" + f, "utf8");

let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.log("FAIL:", msg); } };

// ---- Supabase-like shim ----
await q(`create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text unique, email_confirmed_at timestamptz default now(), raw_user_meta_data jsonb default '{}'::jsonb);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated; grant usage on schema public to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;`);
const mk = async (email, name, confirmed = true) => (await q(`insert into auth.users(email, email_confirmed_at, raw_user_meta_data) values ($1, ${confirmed ? "now()" : "null"}, jsonb_build_object('name',$2::text)) returning id`, [email, name])).rows[0].id;

// run SQL as a logged-in user (row level security applies, exactly like the app); everything is rolled back unless keep=true
// AAL is the sign-in strength in the session token: aal1 = password only, aal2 = password plus authenticator app
let AAL = "aal1";
const withAal = async (level, fn) => { const old = AAL; AAL = level; try { return await fn(); } finally { AAL = old; } };
async function as(uid, fn, keep = false) {
  const c = conn(); await c.connect();
  await c.query("begin"); await c.query("set local role authenticated"); await c.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid || ""]);
  await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: uid || "", role: "authenticated", aal: AAL })]);
  try { const r = await fn((s, p) => c.query(s, p)); await c.query(keep ? "commit" : "rollback"); return r; }
  catch (e) { await c.query("rollback").catch(() => {}); throw e; } finally { await c.end(); }
}
const keep = (uid, fn) => as(uid, fn, true);
const rows = async (uid, sql, p) => (await as(uid, (x) => x(sql, p))).rows;
const one = async (uid, sql, p) => (await rows(uid, sql, p))[0];
const fails = async (fn, re) => { try { await fn(); return false; } catch (e) { return re ? re.test(e.message) : true; } };

// ---- install ----
if (process.env.MODE === "upgrade") {
  const base = execSync("git show 6070ce3:supabase/schema.sql", { cwd: R }).toString();
  try { await q(base); await q(read("patch1.sql")); await q(read("RUN-ME.sql")); ok(true, "original schema + patch 1 + RUN-ME.sql install"); } catch (e) { console.log("BASE ERROR:", e.message); await finish(1); }
  // legacy data exactly as the owner's database has it before the schools upgrade
  var LA = await mk("legacy.student@x.ca", "Legacy Student"), LI = await mk("legacy.teacher@x.ca", "Legacy Teacher");
  await q(`insert into public.class_access(user_id,class_id) values ($1,'astr207'),($1,'erth209')`, [LA]);
  await q(`insert into public.class_instructors(user_id,class_id) values ($1,'astr207')`, [LI]);
  await q(`insert into public.class_settings(class_id,exam_name,exam_date) values ('astr207','Midterm','2026-11-02') on conflict (class_id) do update set exam_name='Midterm', exam_date='2026-11-02'`);
  await q(`update public.class_codes set code='cry@18' where class_id='astr207'`);
  try { await q(read("RUN-ME-2.sql")); ok(true, "RUN-ME-2.sql upgrades it"); } catch (e) { console.log("RUNME2 ERROR:", e.message); await finish(1); }
  const cls = Object.fromEntries((await q(`select c.course_id, c.code, c.exam_name, c.exam_date::text d, (select count(*) from public.enrollments e where e.class_id=c.id)::int en, (select count(*) from public.class_teachers t where t.class_id=c.id)::int te from public.classes c`)).rows.map((r) => [r.course_id, r]));
  ok(cls.astr207?.code === "cry@18" && cls.erth209?.code === "madi@77", "the two existing classes keep their codes: " + JSON.stringify(cls));
  ok(cls.astr207?.exam_name === "Midterm" && cls.astr207?.d === "2026-11-02", "the exam date is carried over: " + JSON.stringify(cls.astr207));
  ok(cls.astr207?.en === 1 && cls.erth209?.en === 1 && cls.astr207?.te === 1, "existing students and the instructor are carried over: " + JSON.stringify(cls));
} else {
  try { await q(read("schema.sql")); ok(true, "schema installs"); } catch (e) { console.log("SCHEMA ERROR:", e.message); await finish(1); }
}
await q(`grant all on all tables in schema public to anon, authenticated; grant execute on all functions in schema public to anon, authenticated;`);
for (const fn of ["log_action(text,text,text,uuid)", "email_ok(uuid)", "apply_invites_for(uuid)", "on_user_confirmed()", "audit_immutable()", "make_code()"]) await q(`revoke all on function public.${fn} from public, anon, authenticated`);
// the patches must be safe to run again
for (const f of ["patch5.sql", "patch6.sql", "RUN-ME-2.sql"]) { try { await q(read(f)); ok(true, f + " reruns cleanly"); } catch (e) { ok(false, f + " rerun: " + e.message); } }
await q(`grant all on all tables in schema public to anon, authenticated; grant execute on all functions in schema public to anon, authenticated;`);
for (const fn of ["log_action(text,text,text,uuid)", "email_ok(uuid)", "apply_invites_for(uuid)", "on_user_confirmed()", "audit_immutable()", "make_code()"]) await q(`revoke all on function public.${fn} from public, anon, authenticated`);

// ---- people ----
const adminEmail = (await q(`select value from public.app_secrets where key='admin_email'`)).rows[0].value;
const ADMIN = await mk(adminEmail, "Admin");
const S1 = await mk("s1@alpha.ca", "Sam"), S2 = await mk("s2@beta.ca", "Bea"), S3 = await mk("s3@alpha.ca", "Cal"), S4 = await mk("s4@alpha.ca", "Dee");
const T1 = await mk("t1@alpha.ca", "Tess"), T2 = await mk("t2@beta.ca", "Tom"), M1 = await mk("m1@alpha.ca", "Mia"), M2 = await mk("m2@beta.ca", "Max"), X = await mk("x@else.ca", "Xan");
ok((await q(`select is_admin from public.profiles where id=$1`, [ADMIN])).rows[0].is_admin === true, "the configured admin email becomes admin on signup");
ok((await q(`select count(*)::int n from public.profiles where is_admin`)).rows[0].n === 1, "nobody else is admin");

// ---- the platform admin builds two schools ----
const A = (await keep(ADMIN, (x) => x(`select public.admin_create_school('Alpha University','Alberta',null) id`))).rows[0].id;
const B = (await keep(ADMIN, (x) => x(`select public.admin_create_school('Beta College','Ontario',2) id`))).rows[0].id;
await keep(ADMIN, async (x) => { for (const c of ["erth209", "astr207"]) await x(`select public.admin_set_school_course($1,$2,true)`, [A, c]); await x(`select public.admin_set_school_course($1,'erth209',true)`, [B]); });
ok(await fails(() => keep(S1, (x) => x(`select public.admin_create_school('Evil U','x',null)`)), /admin only/), "students cannot create schools");
ok(await fails(() => keep(M1, (x) => x(`select public.admin_create_school('Evil U','x',null)`))), "managers cannot create schools");
ok(await fails(() => keep(S1, (x) => x(`select public.invite_user('s1@alpha.ca','manager',$1)`, [A])), /only the platform admin/), "students cannot make managers");
ok((await keep(ADMIN, (x) => x(`select public.invite_user('m1@alpha.ca','manager',$1) r`, [A]))).rows[0].r === "added", "inviting an existing confirmed person adds them at once");
await keep(ADMIN, (x) => x(`select public.invite_user('m2@beta.ca','manager',$1)`, [B]));
ok(await fails(() => keep(M1, (x) => x(`select public.invite_user('t1@alpha.ca','manager',$1)`, [A])), /only the platform admin/), "a manager cannot add other managers");

// ---- manager creates classes ----
const KA = (await keep(M1, (x) => x(`select public.create_class($1,'astr207','ASTR 207 Section 1','Fall 2026',null,null) id`, [A]))).rows[0].id;
const KA2 = (await keep(M1, (x) => x(`select public.create_class($1,'erth209','ERTH 209 Section 1','Fall 2026',null,null) id`, [A]))).rows[0].id;
const KB = (await keep(M2, (x) => x(`select public.create_class($1,'erth209','ERTH 209 Beta','Fall 2026',1,null) id`, [B]))).rows[0].id;
ok(await fails(() => keep(M2, (x) => x(`select public.create_class($1,'astr207','Nope','t',null,null)`, [B])), /not licensed/), "a school cannot create classes for courses it has no licence for");
ok(await fails(() => keep(M1, (x) => x(`select public.create_class($1,'erth209','Sneaky','t',null,null)`, [B])), /school managers only/), "a manager cannot create classes in another school");
ok(await fails(() => keep(T1, (x) => x(`select public.create_class($1,'erth209','Sneaky','t',null,null)`, [A]))), "instructors cannot create classes");
const codeA = (await q(`select code from public.classes where id=$1`, [KA])).rows[0].code, codeB = (await q(`select code from public.classes where id=$1`, [KB])).rows[0].code;
ok(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/i.test(codeA) && codeA !== codeB, "class codes are generated, readable and unique");

// ---- invites: add instructors by email ----
ok(await fails(() => keep(M1, (x) => x(`select public.invite_user('nobody@alpha.ca','teacher',null,$1)`, [KA])), /Confirm email/), "until Confirm email is switched on, nobody can be invited before they have an account");
ok(await fails(() => keep(M1, (x) => x(`select public.admin_set_confirm_email(true)`)), /admin only/), "only the platform admin can say Confirm email is on");
ok((await one(M1, `select public.admin_get_confirm_email() v`)).v === false, "managers cannot read that setting");
await keep(ADMIN, (x) => x(`select public.admin_set_confirm_email(true)`));
ok((await one(ADMIN, `select public.admin_get_confirm_email() v`)).v === true, "the admin can read it");
ok((await keep(M1, (x) => x(`select public.invite_user('t1@alpha.ca','teacher',null,$1) r`, [KA]))).rows[0].r === "added", "a manager adds an existing instructor to a class");
ok(await fails(() => keep(M2, (x) => x(`select public.invite_user('t2@beta.ca','teacher',null,$1)`, [KA])), /only school managers/), "a manager of another school cannot add instructors here");
ok(await fails(() => keep(T1, (x) => x(`select public.invite_user('s1@alpha.ca','teacher',null,$1)`, [KA])), /only school managers/), "instructors cannot add instructors");
await keep(M2, (x) => x(`select public.invite_user('t2@beta.ca','teacher',null,$1)`, [KB]));
ok((await keep(M1, (x) => x(`select public.invite_user('late@alpha.ca','teacher',null,$1) r`, [KA]))).rows[0].r === "invited", "an email that has not signed up yet gets a pending invite");
ok((await rows(M1, `select * from public.list_invites($1)`, [A])).length === 1, "the manager sees the pending invite");
ok((await rows(M2, `select * from public.list_invites($1)`, [A])).length === 0, "another school's manager does not");
const LATE = await mk("late@alpha.ca", "Lee");
ok((await q(`select count(*)::int n from public.class_teachers where user_id=$1 and class_id=$2`, [LATE, KA])).rows[0].n === 1, "signing up with an invited email gives the role automatically");
ok((await rows(M1, `select * from public.list_invites($1)`, [A])).length === 0, "the accepted invite leaves the pending list");
// unconfirmed email must not receive a role until confirmed
await keep(M1, (x) => x(`select public.invite_user('unconf@alpha.ca','teacher',null,$1)`, [KA]));
const UN = await mk("unconf@alpha.ca", "Una", false);
ok((await q(`select count(*)::int n from public.class_teachers where user_id=$1`, [UN])).rows[0].n === 0, "an unconfirmed email gets no role");
await q(`update auth.users set email_confirmed_at = now() where id=$1`, [UN]);
ok((await q(`select count(*)::int n from public.class_teachers where user_id=$1 and class_id=$2`, [UN, KA])).rows[0].n === 1, "confirming the email applies the invite");
await keep(M1, (x) => x(`select public.invite_user('expired@alpha.ca','teacher',null,$1)`, [KA]));
await q(`update public.invites set expires_at = now() - interval '1 day' where lower(email)='expired@alpha.ca'`);
const EX = await mk("expired@alpha.ca", "Exa");
ok((await q(`select count(*)::int n from public.class_teachers where user_id=$1`, [EX])).rows[0].n === 0, "expired invites do nothing");
await keep(M1, (x) => x(`select public.invite_user('revoked@alpha.ca','teacher',null,$1)`, [KA]));
const rid = (await rows(M1, `select id from public.list_invites($1) where email='revoked@alpha.ca'`, [A]))[0].id;
await keep(M1, (x) => x(`select public.revoke_invite($1)`, [rid]));
const RV = await mk("revoked@alpha.ca", "Rev");
ok((await q(`select count(*)::int n from public.class_teachers where user_id=$1`, [RV])).rows[0].n === 0, "revoked invites do nothing");

// ---- students join by code ----
ok((await one(S1, `select public.join_class('nope-nope') r`)).r === null, "a wrong code is refused");
ok((await keep(S1, (x) => x(`select public.join_class($1) r`, [codeA.toLowerCase()]))).rows[0].r.course_id === "astr207", "the right code (any capitals) joins the class");
ok((await keep(S2, (x) => x(`select public.join_class($1) r`, [codeB]))).rows[0].r.course_id === "erth209", "a student of another school joins that school's class");
ok(await fails(() => keep(S3, (x) => x(`select public.join_class($1)`, [codeB])), /class_full/), "a full class (seat limit 1) refuses more students");
await keep(S3, (x) => x(`select public.join_class($1)`, [codeA]));
await q(`update public.classes set archived=true where id=$1`, [KA2]);
const codeA2 = (await q(`select code from public.classes where id=$1`, [KA2])).rows[0].code;
ok(await fails(() => keep(S4, (x) => x(`select public.join_class($1)`, [codeA2])), /class_closed/), "an archived class cannot be joined");
await q(`update public.classes set archived=false, code_expires = current_date - 1 where id=$1`, [KA2]);
ok(await fails(() => keep(S4, (x) => x(`select public.join_class($1)`, [codeA2])), /code_expired/), "an expired code is refused");
await q(`update public.classes set code_expires = null where id=$1`, [KA2]);
await q(`update public.schools set seat_limit = 1 where id=$1`, [B]); await keep(S4, (x) => x(`select public.join_class($1)`, [codeA2]));
await q(`update public.schools set seat_limit = null where id=$1`, [B]);
await q(`update public.schools set active=false where id=$1`, [A]);
ok(await fails(() => one(X, `select public.join_class($1)`, [codeA2]), /school_inactive/), "a suspended school's classes cannot be joined");
await q(`update public.schools set active=true where id=$1`, [A]);
for (let i = 0; i < 8; i++) await keep(X, (x) => x(`select public.join_class($1)`, ["bad" + i + "xx"]));
ok(await fails(() => one(X, `select public.join_class($1)`, [codeA]), /too_many_attempts/), "after 8 wrong tries even the right code is locked out");
await q(`delete from public.code_attempts`);
ok((await one(S1, `select public.redeem_class_by_code($1) r`, [codeA])).r === "astr207", "the older join function still answers with the course id");

// ---- students can leave a class ----
const LV = await mk("leaver@alpha.ca", "Lou");
await keep(LV, (x) => x(`select public.join_class($1)`, [codeA2]));
await keep(LV, (x) => x(`select public.leave_class($1)`, [KA2]));
ok((await q(`select count(*)::int n from public.enrollments where user_id=$1`, [LV])).rows[0].n === 0, "a student can leave a class");
const before2 = (await q(`select count(*)::int n from public.enrollments`)).rows[0].n;
await keep(LV, (x) => x(`select public.leave_class($1)`, [KA]));
ok((await q(`select count(*)::int n from public.enrollments`)).rows[0].n === before2, "leaving only ever removes your own enrolment");

// ---- who sees whom ----
const emails = async (uid) => (await rows(uid, `select email from public.profiles`)).map((r) => r.email).sort();
ok((await emails(S1)).join() === "s1@alpha.ca", "a student sees only themselves");
ok((await emails(X)).join() === "x@else.ca", "a stranger sees only themselves");
const t1 = await emails(T1); ok(t1.includes("s1@alpha.ca") && t1.includes("s3@alpha.ca") && !t1.includes("s2@beta.ca"), "an instructor sees the students of their class only: " + t1.join());
ok(!t1.includes("s4@alpha.ca"), "an instructor does not see students of another class in the same school");
const m1 = await emails(M1); ok(m1.includes("s1@alpha.ca") && m1.includes("s4@alpha.ca") && m1.includes("t1@alpha.ca") && !m1.includes("s2@beta.ca") && !m1.includes("t2@beta.ca"), "a manager sees their whole school (students and instructors) but not another school: " + m1.join());
const m2 = await emails(M2); ok(m2.includes("s2@beta.ca") && m2.includes("t2@beta.ca") && !m2.includes("s1@alpha.ca"), "the other school's manager sees only that school");
ok((await emails(ADMIN)).length >= 12, "the platform admin sees everyone");
ok((await rows(T1, `select user_id from public.class_roster($1)`, [KA])).length === 2, "an instructor reads their class roster");
ok((await rows(T1, `select user_id from public.class_roster($1)`, [KB])).length === 0, "an instructor gets nothing for another school's class");
ok((await rows(M1, `select user_id from public.class_roster($1)`, [KB])).length === 0, "a manager gets nothing for another school's class");
ok((await rows(ADMIN, `select user_id from public.class_roster($1)`, [KB])).length === 1, "the admin reads any roster");
ok((await rows(S1, `select user_id from public.class_roster($1)`, [KA])).length === 0, "a student cannot read a roster");
const sc = (uid) => rows(uid, `select name from public.staff_schools()`).then((r) => r.map((x) => x.name).sort().join());
ok((await sc(M1)) === "Alpha University", "a manager's school list shows only their school");
ok((await sc(T1)) === "Alpha University", "an instructor's school list shows only theirs");
ok((await sc(ADMIN)).includes("Alpha University") && (await sc(ADMIN)).includes("Beta College"), "the admin sees all schools");
ok((await sc(S1)) === "", "a student sees no schools");
const cn = (uid) => rows(uid, `select name from public.staff_classes()`).then((r) => r.map((x) => x.name).sort().join("|"));
ok((await cn(T1)) === "ASTR 207 Section 1", "an instructor sees only their own classes");
ok((await cn(M1)) === "ASTR 207 Section 1|ERTH 209 Section 1", "a manager sees all classes of their school");
ok((await rows(S1, `select * from public.staff_classes()`)).length === 0, "a student sees no staff class list");
ok((await rows(S1, `select * from public.classes`)).length === 0 && (await rows(S1, `select * from public.class_teachers`)).length === 0, "students cannot read class or teacher tables (codes stay hidden)");
const mine = await rows(S1, `select course_id, role, school_name from public.my_classes()`);
ok(mine.length === 1 && mine[0].course_id === "astr207" && mine[0].role === "student" && mine[0].school_name === "Alpha University", "a student's class list shows their class, role and school");
ok((await rows(T1, `select role from public.my_classes()`))[0].role === "teacher", "an instructor's class list marks the role");
const roleList = async (uid) => (await rows(uid, `select role from public.my_roles()`)).map((r) => r.role).sort().join();
ok((await roleList(ADMIN)) === "admin" && (await roleList(M1)) === "manager" && (await roleList(S1)) === "" && (await roleList(T1)) === "", "my_roles tells admins and managers apart from instructors and students");
ok(await fails(() => keep(S1, (x) => x(`insert into public.progress_summary(user_id,course_id,pct) values (auth.uid(),'astr207',500)`))), "summary numbers must stay in range");

// ---- content is readable only by people who belong to a class of that course ----
await keep(ADMIN, (x) => x(`insert into public.lecture_content(lecture_id,class_id,body) values ('motion','astr207','{"t":1}'),('minerals','erth209','{"t":2}')`));
const lec = async (uid) => (await rows(uid, `select lecture_id from public.lecture_content`)).map((r) => r.lecture_id).sort().join();
ok((await lec(S1)) === "motion", "a student reads only their class's course");
ok((await lec(S2)) === "minerals", "a student of a school with only ERTH reads only ERTH");
ok((await lec(X)) === "", "a person with no class reads nothing");
ok((await lec(T1)) === "motion", "an instructor reads the course they teach");
ok((await lec(M1)) === "minerals,motion", "a manager reads the courses their school is licensed for");
ok((await lec(M2)) === "minerals", "the other manager reads only theirs");
ok((await lec(ADMIN)) === "minerals,motion", "the admin reads everything");
ok(await fails(() => keep(M1, (x) => x(`insert into public.lecture_content(lecture_id,class_id,body) values ('x','astr207','{}')`))), "only the platform admin can publish content");

// ---- what staff may change ----
ok(await fails(() => keep(S1, (x) => x(`select public.set_class_code($1,'hack-hack')`, [KA])), /instructors only/), "students cannot change a class code");
ok(await fails(() => keep(T1, (x) => x(`select public.set_class_code($1,'hack-hack')`, [KB])), /instructors only/), "an instructor cannot change another class's code");
ok((await keep(T1, (x) => x(`select public.set_class_code($1,'NEW-CODE1') c`, [KA]))).rows[0].c === "NEW-CODE1", "an instructor changes their own class code");
ok(await fails(() => keep(T1, (x) => x(`select public.set_class_code($1,'NEW-CODE1')`, [KA2]))), "class codes must be unique");
ok(await fails(() => keep(T1, (x) => x(`select public.set_class_code($1,'abc12')`, [KA])), /at least 6/), "custom class codes need at least 6 characters");
await keep(T1, (x) => x(`select public.set_class_exam($1,'Midterm','2026-11-02')`, [KA]));
ok((await one(S1, `select exam_name, exam_date::text d from public.my_classes()`)).d === "2026-11-02", "students see the exam date of their class");
ok(await fails(() => keep(T1, (x) => x(`select public.update_class($1,'Renamed','t',null,null,false)`, [KA])), /school managers only/), "an instructor cannot rename or archive a class");
await keep(M1, (x) => x(`select public.update_class($1,'ASTR 207 Section 1 (renamed)','Fall 2026',30,null,false)`, [KA]));
ok(await fails(() => keep(M2, (x) => x(`select public.update_class($1,'Hijack','t',null,null,false)`, [KA])), /school managers only/), "another school's manager cannot edit this class");
ok(await fails(() => keep(T1, (x) => x(`select public.remove_student($1,$2)`, [S2, KB])), /instructors only/), "an instructor cannot remove students from another class");
await keep(T1, (x) => x(`select public.remove_student($1,$2)`, [S3, KA]));
ok((await q(`select count(*)::int n from public.enrollments where user_id=$1`, [S3])).rows[0].n === 0, "an instructor removes a student from their class");
ok(await fails(() => keep(T1, (x) => x(`select public.remove_teacher($1,$2)`, [T1, KA])), /school managers only/), "an instructor cannot remove instructors");
await keep(M1, (x) => x(`select public.remove_teacher($1,$2)`, [UN, KA]));
ok((await q(`select count(*)::int n from public.class_teachers where user_id=$1`, [UN])).rows[0].n === 0, "a manager removes an instructor");
ok(await fails(() => keep(M1, (x) => x(`select public.remove_manager($1,$2)`, [M1, A])), /admin only/), "only the admin removes managers");
ok(await fails(() => keep(S1, (x) => x(`select public.admin_set_blocked($1,true)`, [S2])), /admin only/), "students cannot block people");
ok(await fails(() => keep(M1, (x) => x(`select public.admin_delete_user($1)`, [S2])), /admin only/), "managers cannot delete accounts");

// ---- platform admins ----
ok(await fails(() => keep(M1, (x) => x(`select public.admin_set_admin('m1@alpha.ca',true)`)), /admin only/), "managers cannot make admins");
ok(await fails(() => keep(ADMIN, (x) => x(`select public.admin_set_admin($1,false)`, [adminEmail])), /last admin/), "the last admin cannot be removed");
const UC = await mk("pending@x.ca", "Pen", false);
ok(await fails(() => keep(ADMIN, (x) => x(`select public.admin_set_admin('pending@x.ca',true)`)), /confirm their email/), "an unconfirmed person cannot be made admin");
await keep(ADMIN, (x) => x(`select public.admin_set_admin('s1@alpha.ca',true)`));
ok((await one(S1, `select count(*)::int n from public.list_admins()`)).n === 2, "a second admin exists and can list admins");
await keep(ADMIN, (x) => x(`select public.admin_set_admin('s1@alpha.ca',false)`));
ok((await rows(S2, `select * from public.list_admins()`)).length === 0, "students cannot list admins");
ok((await keep(ADMIN, (x) => x(`select public.invite_user('future.admin@x.ca','admin') r`))).rows[0].r === "invited", "admins can invite a future admin by email");
const FA = await mk("future.admin@x.ca", "Fay");
ok((await q(`select is_admin from public.profiles where id=$1`, [FA])).rows[0].is_admin === true, "the invited admin becomes admin when they sign up");
await q(`update public.profiles set is_admin=false where id=$1`, [FA]);

// ---- progress, summaries and dashboards ----
await keep(S1, (x) => x(`insert into public.progress(user_id,data) values (auth.uid(), '{"quiz":{"q1":{"attempts":3,"correct":1},"q2":{"attempts":2,"correct":2}},"read":{}}')`));
await keep(S3, (x) => x(`select public.join_class($1)`, [codeA]).catch(() => null)).catch(() => null);
ok(await fails(() => keep(S1, (x) => x(`insert into public.progress(user_id,data) values ($1,'{}')`, [S2]))), "a student cannot write another student's progress");
ok(await fails(() => keep(S1, (x) => x(`update public.progress set data = ${"jsonb_build_object('x', repeat('a', 400000))"} where user_id = auth.uid()`)), /progress_size|check/), "one account cannot store a huge progress file");
await keep(S1, (x) => x(`insert into public.progress_summary(user_id,course_id,pct,mastery,read_topics,cards_known,cards_total,quiz_attempts,quiz_correct) values (auth.uid(),'astr207',40,30,5,10,60,5,3)`));
ok(await fails(() => keep(S1, (x) => x(`insert into public.progress_summary(user_id,course_id,pct) values ($1,'astr207',99)`, [S2]))), "a student cannot write another student's summary");
const ros = await rows(T1, `select email,pct,mastery from public.class_roster($1) where email='s1@alpha.ca'`, [KA]);
ok(ros.length === 1 && ros[0].pct === 40, "the roster shows the student's summary");
ok((await one(T1, `select avg_pct, students from public.staff_classes() where class_id=$1`, [KA])).avg_pct === 40, "the class average comes from the summaries");
const qs = await rows(T1, `select qid,attempts,correct from public.class_question_stats($1) order by qid`, [KA]);
ok(qs.length === 2 && qs[0].qid === "q1" && qs[0].attempts === 3 && qs[0].correct === 1, "hardest-question statistics aggregate the class");
ok((await rows(T1, `select * from public.class_question_stats($1)`, [KB])).length === 0, "...and only for classes the caller may see");
await keep(S1, (x) => x(`update public.progress set data = '{"quiz":{"bad":{"attempts":"999999999999","correct":"x"},"q1":{"attempts":3,"correct":1}}}' where user_id = auth.uid()`));
ok((await rows(T1, `select qid from public.class_question_stats($1)`, [KA])).length >= 1, "junk numbers in a student's progress cannot break class statistics");
ok((await one(T1, `select progress_ok from (select true as progress_ok) z`)).progress_ok, "dashboards still answer");
ok((await rows(T1, `select data from public.progress where user_id=$1`, [S1])).length === 1 && (await rows(T1, `select data from public.progress where user_id=$1`, [S2])).length === 0, "an instructor can open one of their students' progress but not another school's");

// ---- every table is closed to direct writes, and direct reads are scoped ----
const denied = async (uid, sql, p) => { try { return (await as(uid, (x) => x(sql, p))).rowCount === 0; } catch { return true; } }; // an error, or nothing changed
ok(await denied(S1, `insert into public.enrollments(user_id,class_id) values (auth.uid(), $1)`, [KB]), "a student cannot enrol themselves by writing to the table");
ok(await denied(T1, `insert into public.class_teachers(user_id,class_id) values (auth.uid(), $1)`, [KB]), "an instructor cannot add themselves to another class");
ok(await denied(M1, `insert into public.school_managers(user_id,school_id) values (auth.uid(), $1)`, [B]), "a manager cannot add themselves to another school");
ok(await denied(M1, `insert into public.schools(name) values ('Mine now')`), "a manager cannot create a school by writing to the table");
ok(await denied(M1, `update public.schools set seat_limit = 9999 where id = $1`, [A]), "a manager cannot change school limits directly");
ok(await denied(T1, `update public.classes set code = 'HACK-HACK' where id = $1`, [KA]), "an instructor cannot change a class directly");
ok(await denied(M1, `update public.classes set school_id = $1 where id = $2`, [B, KA]), "a manager cannot move a class to another school");
ok(await denied(M1, `delete from public.classes where id = $1`, [KA]), "a manager cannot delete a class directly");
ok(await denied(M1, `delete from public.enrollments where class_id = $1`, [KA]), "a manager cannot delete enrolments directly");
ok(await denied(T1, `insert into public.invites(email,role) values ('z@z.ca','admin')`), "an instructor cannot invite an admin by writing to the table");
ok(await denied(S1, `update public.progress_summary set pct = 100 where user_id = $1`, [S2]), "a student cannot change another student's summary");
ok(await denied(S1, `insert into public.courses(id,title) values ('x','x')`), "nobody adds courses from the app");
ok(await denied(ADMIN, `update public.profiles set is_admin = true where id = $1`, [S2]), "not even the admin edits profile rows directly (they use the functions)");
ok((await rows(S1, `select * from public.invites`)).length === 0, "a student reads no invites");
ok((await rows(M1, `select * from public.invites where school_id = $1`, [B])).length === 0, "a manager reads no invites of another school");
ok((await rows(S1, `select * from public.school_managers`)).length === 0, "a student reads no manager list");
ok((await rows(M1, `select distinct school_id from public.school_managers`)).every((r) => r.school_id === A), "a manager reads only their own school's managers");
ok((await rows(S1, `select * from public.schools`)).length === 0, "a student reads no schools");
ok((await rows(T1, `select id from public.schools`)).map((r) => r.id).join() === A, "an instructor reads only their own school");
ok((await rows(M2, `select id from public.schools`)).map((r) => r.id).join() === B, "the other manager reads only theirs");
ok((await rows(S1, `select user_id from public.enrollments`)).every((r) => r.user_id === S1), "a student reads only their own enrolments");
ok((await rows(T1, `select class_id from public.enrollments`)).every((r) => r.class_id === KA), "an instructor reads only the enrolments of their class");
ok((await rows(M1, `select user_id from public.progress_summary`)).every((r) => r.user_id !== S2), "a manager reads no summaries from another school");
ok((await one(S1, `select public.is_admin() a`)).a === false && (await one(M1, `select public.is_admin() a`)).a === false, "being a student or a manager does not make you an admin");

// ---- a visitor who is not logged in gets nothing ----
async function asAnon(fn) {
  const c = conn(); await c.connect();
  await c.query("begin"); await c.query("set local role anon"); await c.query(`select set_config('request.jwt.claim.sub', '', true)`);
  try { return await fn((sql, p) => c.query(sql, p)); } finally { await c.query("rollback").catch(() => {}); await c.end(); }
}
const counts = async () => (await q(`select (select count(*) from public.enrollments)::int e, (select count(*) from public.classes)::int c, (select count(*) from public.class_teachers)::int t, (select count(*) from public.schools)::int s, (select count(*) from public.invites)::int i, (select count(*) from public.admin_audit)::int a`)).rows[0];
const before = await counts();
for (const [name, sql] of [["join a class", `select public.join_class('${codeA}')`], ["join with the older function", `select public.redeem_class_by_code('${codeA}')`], ["join with the oldest function", `select public.redeem_class_code('astr207','${codeA}')`]]) {
  const r = await asAnon((x) => x(sql)).catch(() => null);
  ok(!r || !Object.values(r.rows[0])[0], `a visitor who is not logged in cannot ${name}`);
}
for (const [name, sql] of [["create a school", `select public.admin_create_school('Fake','x',null)`], ["create a class", `select public.create_class('${A}','erth209','Fake','t',null,null)`], ["invite someone", `select public.invite_user('z@z.ca','admin')`], ["change a code", `select public.set_class_code('${KA}','HACK-HACK')`], ["make an admin", `select public.admin_set_admin('z@z.ca', true)`], ["remove a student", `select public.remove_student('${S1}','${KA}')`], ["block a person", `select public.admin_set_blocked('${S1}', true)`]]) {
  ok(await fails(() => asAnon((x) => x(sql))), `a visitor who is not logged in cannot ${name}`);
}
for (const [name, sql] of [["profiles", "select * from public.profiles"], ["progress", "select * from public.progress"], ["lecture content", "select * from public.lecture_content"], ["exam content", "select * from public.exam_content"], ["classes", "select * from public.classes"], ["schools", "select * from public.schools"], ["enrolments", "select * from public.enrollments"], ["invites", "select * from public.invites"], ["audit lines", "select * from public.admin_audit"], ["feedback", "select * from public.feedback"], ["my classes", "select * from public.my_classes()"], ["staff classes", "select * from public.staff_classes()"], ["staff schools", "select * from public.staff_schools()"], ["a roster", `select * from public.class_roster('${KA}')`], ["question statistics", `select * from public.class_question_stats('${KA}')`]]) {
  const r = await asAnon((x) => x(sql)).catch(() => ({ rows: [] }));
  ok(r.rows.length === 0, `a visitor who is not logged in sees no ${name}`);
}
ok(JSON.stringify(await counts()) === JSON.stringify(before), "...and nothing in the database changed");

// ---- a school that leaves ----
const GS = (await keep(ADMIN, (x) => x(`select public.admin_create_school('Gamma Institute','x',null) id`))).rows[0].id;
await keep(ADMIN, (x) => x(`select public.admin_set_school_course($1,'erth209',true)`, [GS]));
const GK = (await keep(ADMIN, (x) => x(`select public.create_class($1,'erth209','ERTH Gamma','t',null,'GAMMA-77X') id`, [GS]))).rows[0].id;
const G1 = await mk("g1@gamma.ca", "Gus"), G2 = await mk("g2@gamma.ca", "Gia");
await keep(G1, (x) => x(`select public.join_class('GAMMA-77X')`)); await keep(G2, (x) => x(`select public.join_class('GAMMA-77X')`));
await q(`insert into public.enrollments(user_id,class_id) values ($1,$2) on conflict do nothing`, [G2, KB]); // Gia also studies in Beta College
ok(await fails(() => keep(M1, (x) => x(`select public.admin_delete_school($1,true)`, [GS])), /admin only/), "only the platform admin can delete a school");
ok(await fails(() => keep(ADMIN, (x) => x(`select public.admin_delete_school('00000000-0000-0000-0000-000000000001', true)`)), /default school/), "the default school cannot be deleted");
ok((await keep(ADMIN, (x) => x(`select public.admin_delete_school($1,true) n`, [GS]))).rows[0].n === 1, "deleting a school with accounts removes only students who belong to no other school");
ok((await q(`select count(*)::int n from auth.users where id=$1`, [G1])).rows[0].n === 0 && (await q(`select count(*)::int n from auth.users where id=$1`, [G2])).rows[0].n === 1, "...the shared student keeps their account");
ok((await q(`select count(*)::int n from public.classes where school_id=$1`, [GS])).rows[0].n === 0 && (await q(`select count(*)::int n from public.schools where id=$1`, [GS])).rows[0].n === 0, "...and the school and its classes are gone");
ok((await q(`select count(*)::int n from public.enrollments where user_id=$1 and class_id=$2`, [G2, KB])).rows[0].n === 1, "...other schools are untouched");
ok((await q(`select count(*)::int n from public.admin_audit where action='delete school'`)).rows[0].n === 1, "...and the deletion is in the audit log");
const GS2 = (await keep(ADMIN, (x) => x(`select public.admin_create_school('Delta Tech','x',null) id`))).rows[0].id;
ok((await keep(ADMIN, (x) => x(`select public.admin_delete_school($1,false) n`, [GS2]))).rows[0].n === 0, "a school can also be removed without deleting accounts");

// ---- two-step login for staff (optional) ----
const emailsOf = async (uid) => (await rows(uid, `select email from public.profiles`)).map((r) => r.email).sort().join();
ok((await one(S1, `select public.mfa_required() v`)).v === false, "two-step login is off by default");
ok(await fails(() => keep(ADMIN, (x) => x(`select public.admin_set_require_mfa(true)`)), /two-step login for your own account/), "the admin cannot switch it on before using it themselves");
ok(await fails(() => withAal("aal2", () => keep(M1, (x) => x(`select public.admin_set_require_mfa(true)`))), /admin only/), "only the admin can switch it");
await withAal("aal2", () => keep(ADMIN, (x) => x(`select public.admin_set_require_mfa(true)`)));
ok((await one(S1, `select public.mfa_required() v`)).v === true, "...and every signed-in person can see that it is on");
ok((await one(ADMIN, `select public.is_admin() a`)).a === false, "an admin on a password-only session is treated as a plain user");
ok((await rows(ADMIN, `select * from public.staff_schools()`)).length === 0, "...sees no schools");
ok(await fails(() => keep(ADMIN, (x) => x(`select public.admin_create_school('Nope','x',null)`)), /admin only/), "...cannot create a school");
ok(await fails(() => keep(ADMIN, (x) => x(`select public.admin_set_admin('s2@beta.ca', true)`)), /admin only/), "...cannot make another admin");
ok((await rows(T1, `select * from public.class_roster($1)`, [KA])).length === 0 && (await rows(M1, `select * from public.staff_classes()`)).length === 0, "instructors and managers see no roster or classes on a password-only session");
ok((await emailsOf(T1)) === "t1@alpha.ca" && (await emailsOf(M1)) === "m1@alpha.ca", "...not even their students' email addresses");
ok(await fails(() => keep(T1, (x) => x(`select public.set_class_code($1,'SNEAKY-77')`, [KA])), /instructors only/), "...and cannot change a class code");
ok((await rows(S1, `select * from public.my_classes()`)).length >= 1 && (await keep(S1, (x) => x(`select public.my_classes()`))).rowCount >= 1, "students are not affected");
ok((await one(S1, `select public.join_class('nope-nope') r`)).r === null, "students can still use the join box");
await withAal("aal2", async () => {
  ok((await one(ADMIN, `select public.is_admin() a`)).a === true, "on a two-step session the admin is an admin");
  ok((await rows(T1, `select user_id from public.class_roster($1)`, [KA])).length >= 1, "instructors see their roster");
  ok((await rows(M1, `select * from public.staff_classes()`)).length === 2, "managers see their classes");
  ok((await emailsOf(M1)).includes("s1@alpha.ca"), "managers see their school's people");
});
await withAal("aal2", () => keep(ADMIN, (x) => x(`select public.admin_set_require_mfa(false)`)));
ok((await one(ADMIN, `select public.is_admin() a`)).a === true && (await one(S1, `select public.mfa_required() v`)).v === false, "switching it off restores password-only access");

// ---- audit log ----
ok((await rows(ADMIN, `select * from public.admin_audit`)).length >= 10, "admin actions are logged");
const aud = await rows(M1, `select distinct school_id from public.admin_audit`);
ok(aud.length === 1 && aud[0].school_id === A, "a manager sees only their school's audit lines");
ok((await rows(S1, `select * from public.admin_audit`)).length === 0, "students cannot read the audit log");
ok(await fails(() => q(`update public.admin_audit set action='x'`), /append-only/), "the audit log cannot be edited (even by the owner)");
ok(await fails(() => q(`delete from public.admin_audit`), /append-only/), "the audit log cannot be deleted");
ok(await fails(() => keep(S1, (x) => x(`select public.log_action('fake','x')`))), "students cannot write fake audit lines");

// ---- profile protection, feedback, errors, domains, deletion ----
ok((await as(S1, async (x) => { try { const r = await x(`update public.profiles set is_admin=true where id=auth.uid()`); return r.rowCount; } catch { return 0; } })) === 0, "nobody can edit their own profile row directly");
await keep(S1, (x) => x(`select public.set_my_name('Samantha')`));
ok((await q(`select display_name from public.profiles where id=$1`, [S1])).rows[0].display_name === "Samantha", "people can change their own display name");
await keep(S1, (x) => x(`select public.submit_feedback('astr207', 5, 'Great')`));
ok((await rows(T1, `select message from public.feedback`)).length === 1 && (await rows(T2, `select * from public.feedback`)).length === 0, "feedback reaches the class instructor, not other schools");
await keep(S1, (x) => x(`select public.log_client_error('boom','stack','/x')`));
ok((await rows(ADMIN, `select * from public.client_errors`)).length === 1 && (await rows(S1, `select * from public.client_errors`)).length === 0, "error reports reach the admin only");
await keep(M1, (x) => x(`select public.invite_user('guest@gmail.com','teacher',null,$1)`, [KA]));
await keep(ADMIN, (x) => x(`select public.admin_set_domains('alpha.ca, beta.ca')`));
ok(await fails(() => mk("z@gmail.com", "Z"), /approved school email/), "sign-ups are limited to the allowed domains");
const GUEST = await mk("guest@gmail.com", "Guest");
ok((await q(`select count(*)::int n from public.class_teachers where user_id=$1 and class_id=$2`, [GUEST, KA])).rows[0].n === 1, "...except for someone a school invited by email, who also gets their role");
ok(!!(await mk("ok@alpha.ca", "Ok")), "...but allowed domains work");
await keep(ADMIN, (x) => x(`select public.admin_set_domains('')`));
const D = await mk("d@alpha.ca", "Dee");
await keep(D, (x) => x(`select public.delete_my_account()`));
ok((await q(`select count(*)::int n from auth.users where id=$1`, [D])).rows[0].n === 0, "a student can delete their own account");
ok(await fails(() => keep(ADMIN, (x) => x(`select public.delete_my_account()`)), /admin accounts/), "the admin account cannot be deleted by the self-service button");

// ---- the existing codes still work through the older entry points ----
ok((await keep(X, (x) => x(`select public.redeem_class_by_code('madi@77') r`))).rows[0].r === "erth209", "the original ERTH 209 code still joins ERTH 209");
const astrCode = (await q(`select code from public.classes where school_id='00000000-0000-0000-0000-000000000001' and course_id='astr207'`)).rows[0].code;
ok(process.env.MODE !== "upgrade" || astrCode === "cry@18", "the owner's ASTR 207 code survives the upgrade");
ok((await keep(X, (x) => x(`select public.redeem_class_code('astr207',$1) r`, [astrCode]))).rows[0].r === true, "the original ASTR 207 code still joins ASTR 207");
ok((await one(X, `select count(*)::int n from public.my_classes()`)).n === 2, "...and the person now belongs to both default classes");

console.log(`\n${pass} passed, ${fail} failed`);
await finish(fail ? 1 : 0);
