// Database security tests: installs supabase/schema.sql (or the upgrade path) on a real Postgres and checks every rule
// with simulated users. Needs:  npm i --no-save embedded-postgres pg   then:  node tools/test_sql.mjs   (MODE=upgrade for the upgrade path)
// Runs supabase/schema.sql (a fresh install, which includes every patch) on a real Postgres with a tiny Supabase-like shim,
// then checks the security rules with simulated users.
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";
import { readFileSync, rmSync } from "node:fs";

import { fileURLToPath } from "node:url"; import { tmpdir } from "node:os"; import path from "node:path";
const R = process.env.ACEIT_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(tmpdir(), "aceit-pgtest-" + process.pid);
rmSync(dir, { recursive: true, force: true });
const server = new EmbeddedPostgres({ databaseDir: dir, user: "postgres", password: "pw", port: 54329, persistent: false });
await server.initialise(); await server.start();
const admin = new pg.Client({ host: "localhost", port: 54329, user: "postgres", password: "pw", database: "postgres" });
await admin.connect();

let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.log("FAIL:", msg); } };
const q = (sql, params) => admin.query(sql, params);

// ---- Supabase-like shim ----
await q(`create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text unique, raw_user_meta_data jsonb default '{}'::jsonb);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated; grant usage on schema public to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;`);

// ---- install the real schema ----
import { execSync } from "node:child_process";
if (process.env.MODE === "upgrade") {
  // what the owner's database really looks like: the first schema, then patch 1, then the single RUN-ME file
  const base = execSync("git show 6070ce3:supabase/schema.sql", { cwd: R }).toString();
  try { await q(base); await q(readFileSync(R + "/supabase/patch1.sql", "utf8")); ok(true, "original schema + patch 1 install"); } catch (e) { console.log("BASE ERROR:", e.message); process.exit(1); }
  try { await q(readFileSync(R + "/supabase/RUN-ME.sql", "utf8")); ok(true, "RUN-ME.sql upgrades it"); } catch (e) { console.log("RUNME ERROR:", e.message); process.exit(1); }
} else {
  const sql = readFileSync(R + "/supabase/schema.sql", "utf8");
  try { await q(sql); ok(true, "schema installs"); } catch (e) { console.log("SCHEMA ERROR:", e.message); process.exit(1); }
}
// run the patches a second time: everything must be safe to repeat
for (const f of ["patch3", "patch4", "patch5", "RUN-ME"]) { try { await q(readFileSync(R + `/supabase/${f}.sql`, "utf8")); ok(true, f + " reruns cleanly"); } catch (e) { ok(false, f + " rerun: " + e.message); } }
await q(`grant all on all tables in schema public to anon, authenticated; grant execute on all functions in schema public to anon, authenticated;`);
await q(`revoke all on function public.log_action(text,text,text) from public, anon, authenticated`);

// ---- people (inserting into auth.users fires the signup trigger, like real signups) ----
const adminEmail = (await q(`select value from public.app_secrets where key='admin_email'`)).rows[0].value;
const mk = async (email, name) => (await q(`insert into auth.users(email, raw_user_meta_data) values ($1, jsonb_build_object('name',$2::text)) returning id`, [email, name])).rows[0].id;
const ADMIN = await mk(adminEmail, "Admin"), A = await mk("a@school.ca", "Ava"), B = await mk("b@school.ca", "Ben"), I = await mk("inst@school.ca", "Ines"), C = await mk("c@school.ca", "Cy");

// run SQL as a logged-in user (row level security applies, exactly like the app)
async function as(uid, fn) {
  const c = new pg.Client({ host: "localhost", port: 54329, user: "postgres", password: "pw", database: "postgres" }); await c.connect();
  await c.query("begin"); await c.query("set local role authenticated"); await c.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid || ""]);
  try { return await fn((s, p) => c.query(s, p)); } finally { await c.query("rollback").catch(() => {}); await c.end(); }
}
const asKeep = async (uid, fn) => { // same but commits (for actions that must persist)
  const c = new pg.Client({ host: "localhost", port: 54329, user: "postgres", password: "pw", database: "postgres" }); await c.connect();
  await c.query("begin"); await c.query("set local role authenticated"); await c.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid]);
  try { const r = await fn((s, p) => c.query(s, p)); await c.query("commit"); return r; } catch (e) { await c.query("rollback").catch(() => {}); throw e; } finally { await c.end(); }
};
const fails = async (fn) => { try { await fn(); return false; } catch { return true; } };

ok((await q(`select is_admin from public.profiles where id=$1`, [ADMIN])).rows[0].is_admin === true, "the configured admin email becomes admin on signup");
ok((await q(`select is_admin from public.profiles where id=$1`, [A])).rows[0].is_admin === false, "a normal signup is not admin");

// class codes
const codes = Object.fromEntries((await q(`select class_id, code from public.class_codes`)).rows.map((r) => [r.class_id, r.code]));
ok(codes.erth209 === "madi@77" && codes.astr207 === "cry@18", "class codes are set (erth209 madi@77, astr207 cry@18)");
ok((await as(A, (x) => x(`select * from public.class_codes`))).rows.length === 0, "students cannot read class codes");
ok((await as(A, (x) => x(`select * from public.app_secrets`))).rows.length === 0, "students cannot read app secrets");
ok((await as(A, (x) => x(`select public.redeem_class_code('astr207','wrong') r`))).rows[0].r === false, "a wrong code is refused");
await asKeep(A, (x) => x(`select public.redeem_class_code('astr207','cry@18')`));
ok((await as(A, (x) => x(`select class_id from public.class_access`))).rows.map((r) => r.class_id).join() === "astr207", "right code unlocks only that class");
ok((await asKeep(B, (x) => x(`select public.redeem_class_by_code('madi@77') c`))).rows[0].c === "erth209", "join-by-code finds the class from the code alone");
ok((await as(C, (x) => x(`select public.redeem_class_by_code('nope') c`))).rows[0].c === null, "join-by-code refuses an unknown code");

// lockout after 8 wrong tries
for (let i = 0; i < 8; i++) await asKeep(C, (x) => x(`select public.redeem_class_code('astr207','bad${i}')`));
ok(await fails(() => as(C, (x) => x(`select public.redeem_class_code('astr207','cry@18')`))), "after 8 wrong tries even the right code is locked out for 10 minutes");
await q(`delete from public.code_attempts`);

// privacy between students
await as(A, async (x) => { await x(`insert into public.progress(user_id,data) values (auth.uid(), '{"a":1}')`); });
await asKeep(A, (x) => x(`insert into public.progress(user_id,data) values (auth.uid(), '{"a":1}')`));
await asKeep(B, (x) => x(`insert into public.progress(user_id,data) values (auth.uid(), '{"b":1}')`));
ok((await as(A, (x) => x(`select user_id from public.progress`))).rows.length === 1, "a student sees only their own progress");
ok((await as(A, (x) => x(`select id from public.profiles`))).rows.length === 1, "a student sees only their own profile");
ok(await fails(() => as(A, (x) => x(`insert into public.progress(user_id,data) values ($1,'{}')`, [B]))), "a student cannot write another student's progress");
ok((await as(A, (x) => x(`update public.profiles set is_admin=true where id=auth.uid()`))).rowCount === 0, "a student cannot make themselves admin (the update changes no rows)");
ok((await as(A, async (x) => { await x(`update public.profiles set is_admin=true where id=auth.uid()`).catch(() => {}); return x(`select is_admin from public.profiles where id=auth.uid()`); })).rows[0].is_admin === false, "profile admin flag stays false");
ok(await fails(() => as(A, (x) => x(`select public.admin_set_blocked($1,true)`, [B]))), "students cannot block people");
ok(await fails(() => as(A, (x) => x(`select public.admin_delete_user($1)`, [B]))), "students cannot delete people");
ok(await fails(() => as(A, (x) => x(`select public.admin_set_class_code('astr207','hack123')`))), "students cannot change codes");
ok(await fails(() => as(A, (x) => x(`select public.log_action('x','y')`))), "students cannot write fake audit lines");
ok((await as(ADMIN, (x) => x(`select id from public.profiles`))).rows.length === 5, "the admin sees every account");

// instructors: see only their own class
await asKeep(ADMIN, (x) => x(`select public.admin_set_instructor('inst@school.ca','astr207',true)`));
const seen = (await as(I, (x) => x(`select email from public.profiles order by email`))).rows.map((r) => r.email);
ok(seen.includes("a@school.ca") && seen.includes("inst@school.ca") && !seen.includes("b@school.ca"), "an ASTR instructor sees ASTR students (and self) but not ERTH-only students; saw " + seen.join());
ok((await as(I, (x) => x(`select user_id from public.progress`))).rows.length === 1, "instructor sees only their class's progress");
ok((await as(I, (x) => x(`select * from public.instructor_get_codes()`))).rows.map((r) => r.class_id).join() === "astr207", "instructor sees the code of their class only");
await asKeep(I, (x) => x(`select public.instructor_set_code('astr207','new-code-1')`));
ok(await fails(() => as(I, (x) => x(`select public.instructor_set_code('erth209','hack123')`))), "instructor cannot change another class's code");
ok(await fails(() => as(I, (x) => x(`select public.admin_set_blocked($1,true)`, [A]))), "instructor cannot block (admin only)");
await asKeep(I, (x) => x(`select public.instructor_remove_student($1,'astr207')`, [A]));
ok((await as(A, (x) => x(`select class_id from public.class_access`))).rows.length === 0, "instructor can remove a student from their class");
ok(await fails(() => as(I, (x) => x(`select public.instructor_remove_student($1,'erth209')`, [B]))), "instructor cannot remove students from other classes");
await asKeep(I, (x) => x(`select public.set_class_exam('astr207','Midterm','2026-11-02')`));
ok((await as(I, (x) => x(`select exam_name from public.class_settings`))).rows[0].exam_name === "Midterm", "instructor sets an exam date");
await q(`insert into public.class_access(user_id,class_id) values ($1,'astr207') on conflict do nothing`, [A]);
ok((await as(A, (x) => x(`select exam_date::text d from public.class_settings`))).rows[0].d === "2026-11-02", "class members can read the exam date");
ok((await as(B, (x) => x(`select * from public.class_settings`))).rows.length === 0, "other classes cannot read it");

// protected content
await asKeep(ADMIN, (x) => x(`insert into public.lecture_content(lecture_id,class_id,body) values ('motion','astr207','{"t":1}'),('minerals','erth209','{"t":2}')`));
ok((await as(A, (x) => x(`select lecture_id from public.lecture_content`))).rows.map((r) => r.lecture_id).join() === "motion", "a member reads only their class's lectures");
ok((await as(C, (x) => x(`select lecture_id from public.lecture_content`))).rows.length === 0, "a student who joined no class reads no lectures");
ok(await fails(() => as(A, (x) => x(`insert into public.lecture_content(lecture_id,class_id,body) values ('x','astr207','{}')`))), "students cannot write content");
ok((await as(I, (x) => x(`select lecture_id from public.lecture_content`))).rows.map((r) => r.lecture_id).join() === "motion", "an instructor reads their class's lectures");
ok((await as(ADMIN, (x) => x(`select lecture_id from public.lecture_content`))).rows.length === 2, "the admin reads all content");

// audit, feedback, errors, domains
ok((await as(ADMIN, (x) => x(`select action from public.admin_audit`))).rows.length >= 4, "admin actions are logged");
ok((await as(A, (x) => x(`select * from public.admin_audit`))).rows.length === 0, "students cannot read the audit log");
await asKeep(A, (x) => x(`select public.submit_feedback('astr207', 5, 'Great')`));
ok((await as(I, (x) => x(`select message from public.feedback`))).rows.length === 1 && (await as(B, (x) => x(`select * from public.feedback`))).rows.length === 0, "feedback is visible to the class instructor, not to other students");
await asKeep(A, (x) => x(`select public.log_client_error('boom','stack','/x')`));
ok((await as(ADMIN, (x) => x(`select * from public.client_errors`))).rows.length === 1 && (await as(A, (x) => x(`select * from public.client_errors`))).rows.length === 0, "error reports reach the admin only");
await asKeep(ADMIN, (x) => x(`select public.admin_set_domains('school.ca, uni.ca')`));
ok(await fails(() => mk("x@gmail.com", "X")), "sign-ups are blocked for emails outside the allowed domains");
ok(!!(await mk("y@uni.ca", "Y")), "sign-ups from allowed domains work");
ok((await as(A, (x) => x(`select public.admin_get_domains() d`))).rows[0].d === null, "students cannot read the allowed-domain list");
await asKeep(ADMIN, (x) => x(`select public.admin_set_domains('')`));
ok(!!(await mk("z@gmail.com", "Z")), "an empty list allows everyone again");

// delete my account
const D = await mk("d@school.ca", "Dee");
await asKeep(D, (x) => x(`select public.delete_my_account()`));
ok((await q(`select count(*) n from auth.users where id=$1`, [D])).rows[0].n === "0", "a student can delete their own account");
ok(await fails(() => asKeep(ADMIN, (x) => x(`select public.delete_my_account()`))), "the admin account cannot be deleted by the self-service button");

console.log(`\n${pass} passed, ${fail} failed`);
await admin.end(); await server.stop(); rmSync(dir, { recursive: true, force: true });
process.exit(fail ? 1 : 0);
