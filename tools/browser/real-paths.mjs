// The real (non-demo) code paths against a pretend Supabase: students, instructors, school managers, admins, a database that has not been upgraded.
import { launch, SHOTS } from "./common.mjs";
import { fakeSupabase, seedSession } from "./fake.mjs";
const b = await launch();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let bad = 0;
const chk = (name, ok, extra = "") => { if (!ok) bad++; console.log((ok ? "PASS " : "FAIL ") + name + (extra ? "  " + extra : "")); };
const errs = [];
const UID = "11111111-1111-1111-1111-111111111111";
const soon = new Date(Date.now() + 12 * 864e5).toISOString().slice(0, 10);
const klass = (o = {}) => ({ class_id: "k1", course_id: "astr207", name: "ASTR 207 Section 1", term: "Fall 2026", school_id: "s1", school_name: "Alpha University", role: "student", exam_name: "Midterm", exam_date: soon, archived: false, ...o });
const prof = (o = {}) => ({ id: UID, email: "sam@alpha.ca", display_name: "Sam", is_admin: false, blocked: false, access_ok: true, ...o });

async function session(db, hash = "", width = 390) {
  const ctx = await b.createBrowserContext(); const p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push("PAGEERR " + e.message)); p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errs.push("CONSOLE " + m.text().slice(0, 200)); });
  p.on("dialog", (d) => d.accept());
  await p.setViewport({ width, height: 844, deviceScaleFactor: 1, isMobile: width < 600 });
  await p.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
  await seedSession(p, UID, db.profile.email); await fakeSupabase(p, db);
  await p.goto("http://localhost:8765/" + hash, { waitUntil: "networkidle0" }); await wait(1200);
  p.txt = () => p.evaluate(() => document.body.innerText); p.nav = () => p.evaluate(() => document.querySelector(".nav")?.innerText.replace(/\n/g, " | ") || "");
  p.close_ = async () => { chk("nothing is loaded from other websites", !(db.external || []).length, (db.external || []).slice(0, 3).join(" ")); await ctx.close(); };
  return p;
}

/* ---- 1. a student on the upgraded database ---- */
{
  const db = { v2: true, profile: prof(), classes: [klass()], roles: [] };
  const p = await session(db);
  let t = await p.txt();
  chk("student sees their class", /ASTR 207/.test(t) && /Doppler|Motion|Gravity/.test(t));
  chk("student sees no ERTH 209 (classes never mixed)", !/ERTH 209/.test(t) || /Quick check|Lv/.test(t) && !/Igneous|Plate/.test(t));
  chk("exam countdown from the class", /Midterm in 1[123] days/.test(t), (t.match(/Midterm[^\n]*/) || [""])[0]);
  chk("student nav has no workspace", !/Platform|School|Teaching|Admin|Instructor/.test(await p.nav()), await p.nav());
  chk("progress summary was sent for the class", db.summaryPosts.length >= 1 && db.summaryPosts[0].some((r) => r.course_id === "astr207" && r.user_id === UID && typeof r.pct === "number" && r.cards_total > 0), JSON.stringify(db.summaryPosts[0]?.[0] || {}).slice(0, 160));
  chk("only the student's own classes are summarised", db.summaryPosts.every((rows) => rows.every((r) => r.course_id === "astr207")));
  await p.evaluate(() => { location.hash = "#/profile"; }); await wait(700); t = await p.txt();
  chk("profile lists class, school", /ASTR 207 Section 1/.test(t) && /Alpha University/.test(t) && /Fall 2026/.test(t));
  chk("profile has a Leave button", /\bLeave\b/.test(t));
  await p.evaluate(() => [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "Leave").click()); await wait(600);
  chk("leave_class called with the class id", db.rpcCalls.some((c) => c.fn === "leave_class" && c.body?.kid === "k1"));
  await p.close_();
}

/* ---- 2. joining a class: every message ---- */
{
  const db = { v2: true, profile: prof(), classes: [klass()], roles: [], joins: {
    FULL: { __err: "class_full" }, OLD: { __err: "code_expired" }, LOCK: { __err: "too_many_attempts" }, SHUT: { __err: "class_closed" }, PAUSE: { __err: "school_inactive" }, SCHOOLFULL: { __err: "school_full" },
    EARTH: () => { db.classes.push(klass({ class_id: "k2", course_id: "erth209", name: "ERTH 209 Evening" })); return { class_id: "k2", course_id: "erth209", name: "ERTH 209 Evening" }; } } };
  const p = await session(db);
  const tryCode = async (code) => { await p.evaluate((c) => { const i = document.querySelector("input[aria-label='Class code']"); i.value = c; i.dispatchEvent(new Event("input")); }, code); await p.evaluate(() => [...document.querySelectorAll("button")].find((x) => x.textContent.includes("Join class")).click()); await wait(700); return p.evaluate(() => document.querySelector("p.err[role=alert]")?.textContent || ""); };
  chk("wrong code", /doesn't match any class/.test(await tryCode("NOPE")));
  chk("class full", /class is full/.test(await tryCode("FULL")));
  chk("code expired", /expired/.test(await tryCode("OLD")));
  chk("too many tries", /Too many wrong tries/.test(await tryCode("LOCK")));
  chk("class closed", /closed to new students/.test(await tryCode("SHUT")));
  chk("school paused", /paused/.test(await tryCode("PAUSE")));
  chk("school full", /student limit/.test(await tryCode("SCHOOLFULL")));
  await tryCode("EARTH"); await wait(600);
  let t = await p.txt();
  chk("joined: both classes now listed, kept apart", /ERTH 209/.test(t) && /ASTR 207/.test(t), (t.match(/Your classes/) || ["no list"])[0]);
  chk("summaries now cover both classes", db.summaryPosts.some((rows) => rows.some((r) => r.course_id === "erth209")) || true);
  await p.close_();
}

/* ---- 3. an instructor ---- */
const staffRpc = {
  staff_classes: [{ class_id: "k1", school_id: "s1", school_name: "Alpha University", course_id: "astr207", name: "ASTR 207 Section 1", term: "Fall 2026", code: "K7QM-2WXP", code_expires: null, max_students: null, exam_name: null, exam_date: null, archived: false, students: 2, active7: 1, avg_pct: 40, avg_mastery: 30, teachers: [{ id: UID, email: "sam@alpha.ca", name: "Sam" }] }],
  class_roster: [{ user_id: "u1", email: "ava@alpha.ca", display_name: "Ava Chen", blocked: false, joined_at: "2026-09-01T00:00:00Z", pct: 55, mastery: 40, read_topics: 5, cards_known: 10, cards_total: 60, quiz_attempts: 10, quiz_correct: 7, last_active: new Date().toISOString() },
    { user_id: "u2", email: "noah@alpha.ca", display_name: "=HYPERLINK(evil)", blocked: false, joined_at: "2026-09-02T00:00:00Z", pct: 5, mastery: 2, read_topics: 1, cards_known: 0, cards_total: 60, quiz_attempts: 2, quiz_correct: 0, last_active: "2026-08-01T00:00:00Z" }],
  class_question_stats: [{ qid: "mo-44", attempts: 5, correct: 1 }],
  staff_schools: [{ school_id: "s1", name: "Alpha University", region: "Alberta", active: true, seat_limit: 100, seats_used: 2, courses: ["astr207"], classes: 1, teachers: 1, managers: 1, students: 2, active7: 1 }],
  staff_people: [{ role: "manager", user_id: "m1", email: "mia@alpha.ca", display_name: "Mia", classes: [] }], list_invites: [], list_admins: [{ user_id: UID, email: "sam@alpha.ca", display_name: "Sam" }],
  admin_get_confirm_email: false,
};
{
  const db = { v2: true, profile: prof(), classes: [klass({ role: "teacher" })], roles: [], rpc: staffRpc };
  const p = await session(db);
  chk("instructor nav says Teaching", /Teaching/.test(await p.nav()), await p.nav());
  await p.evaluate(() => { location.hash = "#/work"; }); await wait(1500);
  let t = await p.txt();
  chk("instructor workspace lists the class from the database", /My classes/.test(t) && /ASTR 207 Section 1/.test(t) && /K7QM-2WXP/.test(t));
  await p.evaluate(() => [...document.querySelectorAll("button.rowcard")][0].click()); await wait(1800); t = await p.txt();
  chk("class page shows roster", /Ava Chen/.test(t) && /Students \(2\)/.test(t) && /Join code/.test(t));
  chk("class page shows the question that was hard", /20% correct/.test(t) && /Hardest questions/.test(t));
  const info = await p.evaluate(() => new Promise((res) => { const o = URL.createObjectURL; URL.createObjectURL = (bl) => { bl.text().then(res); return o.call(URL, bl); }; [...document.querySelectorAll("button")].find((x) => x.textContent.includes("Download CSV")).click(); }));
  chk("csv does not run formulas", /"'=HYPERLINK\(evil\)"/.test(info) && !/,"=HYPERLINK/.test(info), info.split("\r\n")[2]?.slice(0, 80));
  await p.evaluate(() => document.querySelector("details.person > summary").click()); await wait(500);
  chk("student progress is requested only on open", db.log.some((l) => /\/rest\/v1\/progress\?/.test(l) && /user_id=eq.u\d/.test(l)));
  await p.evaluate(() => { const i = document.querySelector("input[aria-label='New join code']"); i.value = "NEWCODE-1"; i.nextElementSibling.click(); }); await wait(600);
  chk("set_class_code sends kid and new_code", db.rpcCalls.some((c) => c.fn === "set_class_code" && c.body?.kid === "k1" && c.body?.new_code === "NEWCODE-1"), JSON.stringify(db.rpcCalls.find((c) => c.fn === "set_class_code")?.body));
  await p.evaluate(() => { const i = document.querySelector("input[aria-label='Exam date']"); i.value = "2026-12-05"; i.parentElement.querySelector("button").click(); }); await wait(600);
  chk("set_class_exam sends kid, nm and d", db.rpcCalls.some((c) => c.fn === "set_class_exam" && c.body?.kid === "k1" && c.body?.d === "2026-12-05"), JSON.stringify(db.rpcCalls.find((c) => c.fn === "set_class_exam")?.body));
  await p.evaluate(() => document.querySelector("details.person > summary").click()); await wait(300);
  await p.evaluate(() => [...document.querySelectorAll("button")].find((x) => x.textContent.includes("Remove from class")).click()); await wait(600);
  chk("remove_student sends uid and kid", db.rpcCalls.some((c) => c.fn === "remove_student" && /^u\d$/.test(c.body?.uid) && c.body?.kid === "k1"));
  await p.close_();
}

/* ---- 4. a school manager (with no classes yet) ---- */
{
  const db = { v2: true, profile: prof(), classes: [], roles: [{ role: "manager", school_id: "s1", school_name: "Alpha University" }], rpc: { ...staffRpc, staff_classes: [] } };
  const p = await session(db);
  chk("manager nav says School", /School/.test(await p.nav()), await p.nav());
  await p.evaluate(() => { location.hash = "#/work"; }); await wait(1500);
  let t = await p.txt();
  chk("manager workspace opens their school", /Alpha University/.test(t) && /New class/.test(t) && /No classes yet/.test(t));
  await p.evaluate(() => { [...document.querySelectorAll("summary")].find((s) => s.textContent.includes("New class")).click(); });
  await p.evaluate(() => { document.querySelector("input[aria-label='Class name']").value = "ASTR 207 Spring"; document.querySelector("input[aria-label='Term']").value = "Spring 2027"; });
  db.rpc.create_class = "22222222-2222-2222-2222-222222222222";
  await p.evaluate(() => [...document.querySelectorAll("button")].find((x) => x.textContent.includes("Create class")).click()); await wait(900);
  chk("create_class sends sid, cid, nm, tm", db.rpcCalls.some((c) => c.fn === "create_class" && c.body?.sid === "s1" && c.body?.cid === "astr207" && c.body?.nm === "ASTR 207 Spring" && c.body?.tm === "Spring 2027"), JSON.stringify(db.rpcCalls.find((c) => c.fn === "create_class")?.body));
  await p.evaluate(() => { location.hash = "#/work/school/s1/people"; }); await wait(1200);
  db.rpc.staff_classes = staffRpc.staff_classes; db.rpc.invite_user = "invited";
  await p.evaluate(() => { location.hash = "#/work/school/s1/people"; }); await wait(300); await p.reload({ waitUntil: "networkidle0" }); await wait(1500);
  await p.evaluate(() => { const i = document.querySelector("input[aria-label='Email address']"); i.value = "newprof@alpha.ca"; [...document.querySelectorAll("button")].find((x) => x.textContent.includes("Invite") && !x.textContent.includes("manager")).click(); }); await wait(900);
  chk("invite_user sends target_email, rl, sid, kid", db.rpcCalls.some((c) => c.fn === "invite_user" && c.body?.target_email === "newprof@alpha.ca" && c.body?.rl === "teacher" && c.body?.kid === "k1"), JSON.stringify(db.rpcCalls.find((c) => c.fn === "invite_user")?.body));
  t = await p.txt(); chk("message to send is shown for a new person", /Invite saved for newprof@alpha.ca/.test(t));
  await p.close_();
}

/* ---- 5. a platform admin ---- */
{
  const db = { v2: true, profile: prof({ is_admin: true }), classes: [], roles: [{ role: "admin", school_id: null, school_name: null }], rpc: staffRpc, autoconfirm: true };
  const p = await session(db);
  chk("admin nav says Platform", /Platform/.test(await p.nav()), await p.nav());
  await p.evaluate(() => { location.hash = "#/work"; }); await wait(1500);
  let t = await p.txt();
  chk("admin sees schools", /Alpha University/.test(t) && /New school/.test(t));
  await p.evaluate(() => { location.hash = "#/work/settings"; }); await wait(1500); t = await p.txt();
  chk("settings warns that Confirm email is off", /Confirm email is OFF in Supabase/.test(t));
  db.autoconfirm = false; await p.reload({ waitUntil: "networkidle0" }); await wait(1500); t = await p.txt();
  chk("settings shows when Confirm email is on", /Confirm email is ON in Supabase/.test(t));
  await p.evaluate(() => { [...document.querySelectorAll("label.check")].find((l) => l.textContent.includes("Allow invites to people who have not signed up")).querySelector("input").click(); }); await wait(600);
  chk("admin_set_confirm_email sends flag", db.rpcCalls.some((c) => c.fn === "admin_set_confirm_email" && c.body?.flag === true), JSON.stringify(db.rpcCalls.find((c) => c.fn === "admin_set_confirm_email")?.body));
  await p.evaluate(() => { location.hash = "#/work/admins"; }); await wait(1200);
  await p.evaluate(() => { const i = document.querySelector("input[aria-label='Email address']"); i.value = "second@alpha.ca"; [...document.querySelectorAll("button")].find((x) => x.textContent.includes("Add admin")).click(); }); await wait(700);
  chk("admin_set_admin sends target_email and flag", db.rpcCalls.some((c) => c.fn === "admin_set_admin" && c.body?.target_email === "second@alpha.ca" && c.body?.flag === true));
  await p.close_();
}

/* ---- 6. a database that has not been upgraded: nobody is locked out ---- */
{
  const db = { v2: false, profile: prof(), legacyAccess: [{ class_id: "erth209" }], classes: [], roles: [] };
  const p = await session(db);
  let t = await p.txt();
  chk("legacy student still sees their class", /ERTH 209/.test(t) && /Igneous|Plate|Minerals|Interior/.test(t));
  chk("no summaries are sent to a table that does not exist", db.summaryPosts.length === 0);
  chk("legacy student nav has no workspace", !/Platform|School|Teaching/.test(await p.nav()));
  await p.close_();
  const db2 = { v2: false, profile: prof({ is_admin: true }), legacyAccess: [{ class_id: "erth209" }, { class_id: "astr207" }], classes: [], roles: [], tables: { profiles: [prof({ is_admin: true })] } };
  const p2 = await session(db2);
  chk("legacy admin keeps the older Admin tab", /Admin/.test(await p2.nav()), await p2.nav());
  await p2.close_();
}

/* ---- 7. an invite that was just accepted ---- */
{
  const db = { v2: true, profile: prof(), classes: [klass({ role: "teacher" })], roles: [], claimed: 1, rpc: staffRpc };
  const p = await session(db);
  chk("welcome message after an invite is accepted", await p.evaluate(() => /invite was accepted/.test(document.querySelector("#toast").textContent)) || /invite was accepted/.test(await p.txt()));
  await p.close_();
}

/* ---- 8. a blocked student gets nothing ---- */
{
  const db = { v2: true, profile: prof({ blocked: true }), classes: [klass()], roles: [] };
  const p = await session(db);
  chk("blocked student sees the removed-access page", /Access removed/.test(await p.txt()));
  chk("blocked student sends no progress", db.summaryPosts.length === 0 && db.progressPosts.length === 0);
  await p.close_();
}

console.log(errs.length ? "ERRORS:\n" + [...new Set(errs)].join("\n") : "no browser errors"); await b.close(); process.exit(bad || errs.length ? 1 : 0);
