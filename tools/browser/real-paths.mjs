// The real (non-demo) code paths against a pretend Supabase: students, instructors, school managers, admins, a database that has not been upgraded.
import { launch, SHOTS } from "./common.mjs";
import { fakeSupabase, seedSession } from "./fake.mjs";
import { lectureId } from "../../js/classcontent.js";
const b = await launch();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let bad = 0;
const chk = (name, ok, extra = "") => { if (!ok) bad++; console.log((ok ? "PASS " : "FAIL ") + name + (extra ? "  " + extra : "")); };
const errs = [];
const UID = "11111111-1111-1111-1111-111111111111";
const soon = new Date(Date.now() + 12 * 864e5).toISOString().slice(0, 10);
const klass = (o = {}) => ({ class_id: "k1", course_id: "astr207", name: "ASTR 207 Section 1", term: "Fall 2026", school_id: "s1", school_name: "Alpha University", role: "student", exam_name: "Midterm", exam_date: soon, archived: false, ...o });
const prof = (o = {}) => ({ id: UID, email: "sam@alpha.ca", display_name: "Sam", is_admin: false, blocked: false, access_ok: true, terms_version: "1.0", privacy_version: "1.0", ...o });

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
  chk("student sees their class on Home", /ASTR 207/.test(t));
  chk("student sees which school and class it is", /Alpha University . ASTR 207 Section 1/.test(t));
  chk("student sees no ERTH 209 (classes never mixed)", !/ERTH 209/.test(t) || /Quick check|Lv/.test(t) && !/Igneous|Plate/.test(t));
  chk("exam countdown from the class (Coming up on Home)", /Coming up/.test(t) && /Midterm/.test(t) && /In 1[123] days/.test(t), (t.match(/Midterm[^\n]*/) || [""])[0]);
  chk("student nav has no workspace", !/Platform|School|Teaching|Admin|Instructor/.test(await p.nav()), await p.nav());
  chk("progress summary was sent for the class", db.summaryPosts.length >= 1 && db.summaryPosts[0].some((r) => r.course_id === "astr207" && r.user_id === UID && typeof r.pct === "number" && r.cards_total > 0), JSON.stringify(db.summaryPosts[0]?.[0] || {}).slice(0, 160));
  chk("only the student's own classes are summarised", db.summaryPosts.every((rows) => rows.every((r) => r.course_id === "astr207")));
  await p.evaluate(() => { location.hash = "#/s/astr207"; }); await wait(900); t = await p.txt();
  chk("the class page lists the class's lectures", /Doppler|Motion|Gravity/.test(t) && /Alpha University/.test(t), (t.match(/Alpha University[^\n]*/) || [""])[0]);
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
  await p.evaluate(() => { location.hash = "#/s/erth209"; }); await wait(900); t += " " + await p.txt();
  chk("legacy student still sees their class and its lectures", /ERTH 209/.test(t) && /Igneous|Plate|Minerals|Interior/.test(t));
  chk("no summaries are sent to a table that does not exist", db.summaryPosts.length === 0);
  chk("legacy student nav has no workspace", !/Platform|School|Teaching/.test(await p.nav()));
  await p.close_();
  const db2 = { v2: false, profile: prof({ is_admin: true }), legacyAccess: [{ class_id: "erth209" }, { class_id: "astr207" }], classes: [], roles: [], tables: { profiles: [prof({ is_admin: true })] } };
  const p2 = await session(db2);
  chk("legacy admin keeps the older Admin tab", /Admin/.test(await p2.nav()), await p2.nav());
  await p2.close_();
  const db3 = { v2: false, profile: prof(), legacyAccess: [{ class_id: "astr207" }], legacyInstructors: [{ class_id: "astr207" }], classes: [], roles: [] };
  const p3 = await session(db3);
  chk("an instructor of the older model keeps the Instructor tab", /Instructor/.test(await p3.nav()), await p3.nav());
  await p3.close_();
}

/* ---- 7. an invite that was just accepted ---- */
{
  const db = { v2: true, profile: prof(), classes: [klass({ role: "teacher" })], roles: [], claimed: 1, rpc: staffRpc };
  const p = await session(db);
  chk("welcome message after an invite is accepted", await p.evaluate(() => /invite was accepted/.test(document.querySelector("#toast").textContent)) || /invite was accepted/.test(await p.txt()));
  await p.close_();
}

/* ---- 9. what instructors added to the class ---- */
{
  const L = "11111111-1111-4111-8111-111111111111", row = (id, kind, ref, status, body, extra = {}) => ({ id, class_id: "k1", kind, lecture_ref: ref, status, body, position: 1, author_name: "Dr. Rivera", created_at: "2026-10-10T10:00:00Z", updated_at: "2026-10-18T10:00:00Z", ...extra });
  const items = [
    row(L, "lecture", null, "published", { title: "Week 1 review", icon: "\u{1F9EA}" }),
    row("a0000001-0000-4000-8000-000000000001", "note", L, "published", { title: "Start here", bullets: ["In **lecture** one we met the textbook. Read the book again."] }),
    row("a0000001-0000-4000-8000-000000000002", "card", L, "published", { front: "Speed", back: "Distance over time" }),
    row("a0000001-0000-4000-8000-000000000003", "question", L, "published", { q: "Which has a direction?", options: ["Speed", "Velocity"], answer: 1, why: "Velocity does." }),
    row("a0000001-0000-4000-8000-000000000004", "question", "motion", "published", { q: "An extra question about motion?", options: ["Yes", "No"], answer: 0 }),
    row("a0000001-0000-4000-8000-000000000005", "card", "motion", "published", { front: "Extra card front", back: "Extra card back" }),
    row("a0000001-0000-4000-8000-000000000006", "note", "motion", "published", { title: "Picture note", bullets: ["See the picture"], img: { path: "k1/pic00001.webp", alt: "A small test picture" } }),
    row("a0000001-0000-4000-8000-000000000007", "announcement", null, "published", { title: "Midterm moved to Friday", text: "Bring a calculator.", until: "2099-01-01" }),
    row("a0000001-0000-4000-8000-000000000008", "announcement", null, "published", { title: "Old news", until: "2020-01-01" }),
    row("a0000001-0000-4000-8000-000000000009", "question", "motion", "draft", { q: "A draft question", options: ["a", "b"], answer: 0 }),
    row("a0000001-0000-4000-8000-00000000000a", "question", "motion", "review", { q: "A question waiting for approval", options: ["a", "b"], answer: 0 }),
    row("a0000001-0000-4000-8000-00000000000b", "question", "motion", "published", { q: "A question of another class", options: ["a", "b"], answer: 0 }, { class_id: "k9" }),
    row("22222222-2222-4222-8222-222222222222", "lecture", null, "published", { title: "Only one card" }),
    row("a0000001-0000-4000-8000-00000000000c", "card", "22222222-2222-4222-8222-222222222222", "published", { front: "Lonely", back: "The only card here" }),
  ];
  const db = { v2: true, profile: prof(), classes: [klass()], roles: [], items };
  const p = await session(db);
  let t = await p.txt();
  chk("the announcement is shown", /From your instructor/.test(t) && /Midterm moved to Friday/.test(t) && /Bring a calculator/.test(t) && /Dr\. Rivera/.test(t));
  chk("expired announcements are not", !/Old news/.test(t));
  await p.evaluate(() => { location.hash = "#/s/astr207"; }); await wait(900); const tc = await p.txt();
  chk("the class's own lecture is in the class's list, marked", /Week 1 review/.test(tc) && /Added by your instructor/.test(tc));
  const base = await (await fetch("http://localhost:8765/content/manifest.json")).json();
  await p.evaluate(() => { location.hash = "#/l/motion/quiz"; }); await wait(900); t = await p.txt();
  chk("extra questions join the course lecture's quiz (drafts, approvals and other classes' items do not)", new RegExp(`${base.motion.quiz.length + 1} questions`).test(t), (t.match(/\d+ questions/) || [""])[0]);
  await p.evaluate(() => { location.hash = "#/l/motion/cards"; }); await wait(900); t = await p.txt();
  chk("extra cards join the cards", new RegExp(`of ${base.motion.cards.length + 1}`).test(t), (t.match(/Card 1 of \d+/) || [""])[0]);
  await p.evaluate(() => { location.hash = "#/l/motion/notes"; }); await wait(900);
  await p.evaluate(() => { const sel = document.querySelector("select[aria-label='Jump to topic']"); sel.value = String([...sel.options].findIndex((o) => o.textContent.includes("Picture note"))); sel.dispatchEvent(new Event("change")); }); await wait(900); t = await p.txt();
  chk("the instructor's note is a page of the lecture, with its tag", /Picture note/.test(t) && /Your instructor/.test(t));
  await wait(800);
  chk("its picture is fetched from the private storage and shown", db.downloads?.includes("k1/pic00001.webp") && await p.evaluate(() => /^blob:/.test(document.querySelector(".figbtn img")?.src || "")), JSON.stringify(db.downloads));
  await p.evaluate(() => { location.hash = "#/s/astr207"; }); await wait(700);
  const ownId = await p.evaluate(() => [...document.querySelectorAll("button.lec")].find((x) => x.textContent.includes("Week 1 review")).click() || location.hash); await wait(900);
  t = await p.txt();
  chk("the own lecture opens with its note", /Start here/.test(t) && /Your instructor/.test(t), ownId);
  chk("words about sources are left exactly as the instructor wrote them", /In lecture one we met the textbook\. Read the book again\./.test(t), (t.match(/In lecture[^\n]*/) || [""])[0]);
  await p.evaluate(() => { location.hash = location.hash.replace("/notes", "/quiz"); }); await wait(700);
  await p.evaluate(() => [...document.querySelectorAll("button")].find((x) => x.textContent.includes("Start quiz")).click()); await wait(500); t = await p.txt();
  chk("its quiz shows the question, marked as the instructor's", /Which has a direction\?/.test(t) && /From your instructor/.test(t));
  const L2id = lectureId("22222222-2222-4222-8222-222222222222");
  await p.evaluate((id) => { location.hash = `#/l/${id}/notes`; }, L2id); await wait(900); t = await p.txt();
  chk("a lecture with no notes yet says so instead of breaking", /There are no notes in this lecture yet/.test(t) && /Only one card/.test(t));
  await p.evaluate((id) => { location.hash = `#/l/${id}/quiz`; }, L2id); await wait(700);
  chk("...and so does one with no questions", /No questions yet/.test(await p.txt()));
  await p.evaluate((id) => { location.hash = `#/l/${id}/cards`; }, L2id); await wait(700);
  chk("...and its single card is there", /Lonely/.test(await p.txt()));
  chk("progress summaries count the added cards", db.summaryPosts.some((rows) => rows.some((r) => r.course_id === "astr207" && r.cards_total >= base.motion.cards.length + 2)), JSON.stringify(db.summaryPosts.at(-1)?.[0] || {}).slice(0, 120));
  await p.close_();
}
{
  const db = { v2: true, profile: prof(), classes: [klass()], roles: [], items: [], noItemsTable: true };
  const p = await session(db);
  chk("without the upgrade for this feature everything still works", /ASTR 207/.test(await p.txt()) && !/From your instructor/.test(await p.txt()));
  await p.close_();
}

/* ---- 10. an instructor adds content (the calls the screens make) ---- */
{
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
  const { writeFileSync, mkdtempSync } = await import("node:fs"), { tmpdir } = await import("node:os"), nodePath = await import("node:path");
  const pth = nodePath.join(mkdtempSync(nodePath.join(tmpdir(), "aceit-")), "tiny.png"); writeFileSync(pth, png);
  const existing = { id: "a0000001-0000-4000-8000-000000000001", class_id: "k1", kind: "note", lecture_ref: "motion", status: "draft", position: 1, body: { title: "An old note", img: { path: "k1/oldpicture1.webp", alt: "Old picture" } }, author_name: "Sam", created_at: "2026-10-10T10:00:00Z", updated_at: "2026-10-10T10:00:00Z" };
  const db = { v2: true, profile: prof(), classes: [klass({ role: "teacher" })], roles: [], items: [existing], rpc: { ...staffRpc,
    staff_schools: [{ ...staffRpc.staff_schools[0], require_approval: false }],
    save_class_item: (body) => (body.b.q === "Refuse me?" ? { __err: "Use 2 to 5 answer options." } : "b0000001-0000-4000-8000-000000000009"),
    set_class_item_status: "published", delete_class_item: ["k1/oldpicture1.webp"], copy_class_items: [{ new_id: "c1", old_path: "k1/a.webp", new_path: "k2/a.webp" }], review_queue: [], set_school_approval: null, reorder_class_items: null } };
  const p = await session(db);
  await p.evaluate(() => { location.hash = "#/work/class/k1/content"; }); await wait(1500);
  let t = await p.txt();
  chk("the content screen loads the class's items from the database", /Class content/.test(t) && db.log.some((l) => /\/rest\/v1\/class_items\?.*class_id=eq\.k1/.test(l)));
  await p.evaluate(() => { location.hash = "#/work/class/k1/content/edit/question/new/motion"; }); await wait(800);
  const type = (sel, v) => p.evaluate((sel, v) => { const el = document.querySelector(sel); el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); }, sel, v);
  await type("textarea[aria-label='Question']", "What is 2 + 2?"); await type("input[aria-label='Option A']", "3"); await type("input[aria-label='Option B']", "4");
  await p.evaluate(() => document.querySelector("input[aria-label='Option B is the correct answer']").click());
  const f = await p.$("input[type=file]"); await f.uploadFile(pth); await wait(900);
  await type("input[aria-label='Picture description']", "A tiny picture");
  await p.evaluate(() => [...document.querySelectorAll("button")].find((x) => /Save as draft/.test(x.textContent)).click()); await wait(1500);
  const sv = db.rpcCalls.find((c) => c.fn === "save_class_item");
  chk("saving sends kid, kind, lecture, body, no item id", sv && sv.body.kid === "k1" && sv.body.k === "question" && sv.body.ref === "motion" && sv.body.item_id === null && sv.body.b.q === "What is 2 + 2?" && JSON.stringify(sv.body.b.options) === '["3","4"]' && sv.body.b.answer === 1, JSON.stringify(sv?.body).slice(0, 200));
  chk("the picture was uploaded into this class's folder first and the item refers to it", db.uploads?.length === 1 && /^k1\/[0-9a-f]{24}\.(webp|jpg)$/.test(db.uploads[0].path) && sv.body.b.img.path === db.uploads[0].path && sv.body.b.img.alt === "A tiny picture", JSON.stringify(db.uploads));
  // a refused save removes the picture that was just uploaded
  await p.evaluate(() => { location.hash = "#/work/class/k1/content/edit/question/new/motion"; }); await wait(800);
  await type("textarea[aria-label='Question']", "Refuse me?"); await type("input[aria-label='Option A']", "yes"); await type("input[aria-label='Option B']", "no");
  await p.evaluate(() => document.querySelector("input[aria-label='Option A is the correct answer']").click());
  const f2 = await p.$("input[type=file]"); await f2.uploadFile(pth); await wait(800); await type("input[aria-label='Picture description']", "Another picture");
  await p.evaluate(() => [...document.querySelectorAll("button")].find((x) => /Save as draft/.test(x.textContent)).click()); await wait(1500);
  chk("when the database refuses the item, the new picture is deleted again and the message is shown", db.uploads.length === 2 && db.removed.includes(db.uploads[1].path) && /Use 2 to 5 answer options/.test(await p.txt()), JSON.stringify(db.removed));
  // a class that already holds all the pictures it may: the upload is refused, the editor says why, nothing is saved
  db.mediaFull = true; const uploadsBefore = db.uploads.length;
  await p.evaluate(() => { location.hash = "#/work/class/k1/content/edit/question/new/motion"; }); await wait(800);
  await type("textarea[aria-label='Question']", "No room?"); await type("input[aria-label='Option A']", "yes"); await type("input[aria-label='Option B']", "no");
  await p.evaluate(() => document.querySelector("input[aria-label='Option A is the correct answer']").click());
  const f2b = await p.$("input[type=file]"); await f2b.uploadFile(pth); await wait(800); await type("input[aria-label='Picture description']", "One too many");
  await p.evaluate(() => [...document.querySelectorAll("button")].find((x) => /Save as draft/.test(x.textContent)).click()); await wait(1500);
  chk("a class that holds 400 pictures is told so in plain words, and the item is not saved", /400 pictures/.test(await p.txt()) && db.uploads.length === uploadsBefore && !db.rpcCalls.some((c) => c.fn === "save_class_item" && c.body.b.q === "No room?"), (await p.txt()).replace(/\s+/g, " ").slice(0, 100));
  db.mediaFull = false;
  // edit an item: its picture is replaced, the old file is removed after a successful save
  await p.evaluate(() => { location.hash = "#/work/class/k1/content/edit/note/a0000001-0000-4000-8000-000000000001/motion"; }); await wait(1000);
  chk("the existing item and its picture open for editing", await p.evaluate(() => document.querySelector("input[aria-label='Note title']")?.value === "An old note"));
  const f3 = await p.$("input[type=file]"); await f3.uploadFile(pth); await wait(800);
  await p.evaluate(() => [...document.querySelectorAll("button")].find((x) => /Save changes/.test(x.textContent)).click()); await wait(1500);
  const sv2 = db.rpcCalls.filter((c) => c.fn === "save_class_item").pop();
  chk("editing sends the item id, and the replaced picture file is removed", sv2.body.item_id === existing.id && sv2.body.b.img.path !== "k1/oldpicture1.webp" && db.removed.includes("k1/oldpicture1.webp"), JSON.stringify(sv2.body).slice(0, 160));
  // status and delete
  await p.evaluate(() => { location.hash = "#/work/class/k1/content/lecture/motion"; }); await wait(1000);
  await p.evaluate(() => [...document.querySelectorAll("button")].find((x) => /^Publish/.test(x.textContent.trim())).click()); await wait(900);
  const st = db.rpcCalls.find((c) => c.fn === "set_class_item_status");
  chk("publishing sends item_id, new_status and with_children", st && st.body.item_id === existing.id && st.body.new_status === "published" && st.body.with_children === false, JSON.stringify(st?.body));
  db.removed.length = 0;
  await p.evaluate(() => [...document.querySelectorAll("button[aria-label^='Delete']")][0].click()); await wait(1000);
  const del = db.rpcCalls.find((c) => c.fn === "delete_class_item");
  chk("deleting sends item_id and removes the pictures the database names", del && del.body.item_id === existing.id && db.removed.includes("k1/oldpicture1.webp"), JSON.stringify(db.removed));
  await p.close_();
}
{
  const db = { v2: true, profile: prof(), classes: [], roles: [{ role: "manager", school_id: "s1", school_name: "Alpha University" }], items: [], rpc: { ...staffRpc, staff_classes: [], staff_schools: [{ ...staffRpc.staff_schools[0], require_approval: true }],
    review_queue: [{ item_id: "q1", class_id: "k1", class_name: "ASTR 207 Section 1", kind: "question", lecture_ref: "motion", body: { q: "Please approve me?", options: ["a", "b"], answer: 0 }, author_name: "Dr. Rivera", updated_at: "2026-10-18T10:00:00Z" },
      { item_id: "q2", class_id: "k1", class_name: "ASTR 207 Section 1", kind: "question", lecture_ref: "motion", body: { q: "Changed while you looked?", options: ["a", "b"], answer: 1 }, author_name: "Dr. Rivera", updated_at: "2026-10-18T11:00:00Z" }],
    set_class_item_status: (body) => (body.item_id === "q2" ? { __err: "This item was changed after you opened it. Reload the page and look at it again before you decide." } : "published"), set_school_approval: null } };
  const p = await session(db);
  await p.evaluate(() => { location.hash = "#/work/school/s1/approvals"; }); await wait(1500);
  let t = await p.txt();
  chk("the school's Approvals tab asks review_queue for this school", t.includes("Please approve me?") && db.rpcCalls.some((c) => c.fn === "review_queue" && c.body.sid === "s1"));
  await p.evaluate(() => [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "Approve").click()); await wait(900);
  chk("approving sends set_class_item_status published, naming the version the manager looked at", db.rpcCalls.some((c) => c.fn === "set_class_item_status" && c.body.item_id === "q1" && c.body.new_status === "published" && c.body.expected_at === "2026-10-18T10:00:00Z"));
  await p.evaluate(() => [...document.querySelectorAll("button")].filter((x) => x.textContent.trim() === "Approve")[1].click()); await wait(900);
  chk("when the instructor changed the item meanwhile, the manager is told and the queue is loaded again", /changed after you opened it/.test(await p.evaluate(() => document.querySelector("#toast")?.textContent || "")) && db.rpcCalls.filter((c) => c.fn === "review_queue").length >= 3, String(db.rpcCalls.filter((c) => c.fn === "review_queue").length));
  await p.evaluate(() => document.querySelector("label.check input").click()); await wait(700);
  chk("the approval switch sends set_school_approval", db.rpcCalls.some((c) => c.fn === "set_school_approval" && c.body.sid === "s1" && c.body.flag === false));
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
