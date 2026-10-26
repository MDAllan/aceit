// Admin edit mode on the real code path (a pretend Supabase, see fake.mjs): what is sent to the database (function and argument names, the original
// lecture as old_body on the first save only), what the admin sees when a save fails or the upgrade is missing, the history calls, and that a
// student's lecture is checked again after two minutes. The local preview version is edit-demo.mjs.
import { launch, SHOTS } from "./common.mjs";
import { fakeSupabase, seedSession } from "./fake.mjs";
import { readFileSync } from "node:fs";
const b = await launch();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let bad = 0, passed = 0;
const chk = (name, ok, extra = "") => { if (!ok) bad++; else passed++; console.log((ok ? "PASS " : "FAIL ") + name + (extra ? "  " + extra : "")); };
const errs = [];
const UID = "11111111-1111-1111-1111-111111111111";
const prof = (o = {}) => ({ id: UID, email: "madi@aceit.example", display_name: "Madi", is_admin: false, blocked: false, access_ok: true, terms_version: "1.0", privacy_version: "1.0", ...o });
const published = JSON.parse(readFileSync(new URL("../../content/deformation.json", import.meta.url), "utf8"));

async function session(db, prefs, hash) {
  const ctx = await b.createBrowserContext(), p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push("PAGEERR " + e.message));
  p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errs.push("CONSOLE " + m.text().slice(0, 200)); });
  await p.setViewport({ width: 375, height: 800, deviceScaleFactor: 1, isMobile: true });
  await p.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }, { name: "prefers-reduced-motion", value: "reduce" }]);
  await p.evaluateOnNewDocument((prefs) => { try { for (const [k, v] of Object.entries(prefs)) localStorage.setItem("erth209:" + k, v); } catch {} }, prefs);
  await seedSession(p, UID, db.profile.email); await fakeSupabase(p, db);
  await p.goto("http://localhost:8765/" + hash, { waitUntil: "networkidle0" }); await wait(1500);
  p.ctx = ctx; return p;
}
async function tap(p, sel, text) {
  const ok = await p.evaluate((sel, text) => { const el = [...document.querySelectorAll(sel)].find((x) => !text || x.textContent.includes(text)); if (!el) return false; el.scrollIntoView({ block: "center" }); el.setAttribute("data-tap", "1"); return true; }, sel, text);
  if (!ok) return false;
  await (await p.$("[data-tap='1']")).click(); await p.evaluate(() => document.querySelector("[data-tap='1']")?.removeAttribute("data-tap")); await wait(300); return true;
}
const fill = (p, sel, value) => p.evaluate((sel, value) => { const el = document.querySelector(sel); el.focus(); el.value = value; el.dispatchEvent(new Event("input", { bubbles: true })); }, sel, value);
const txt = (p, sel) => p.evaluate((sel) => document.querySelector(sel)?.innerText || "", sel);
const saves = (db) => db.rpcCalls.filter((c) => c.fn === "admin_save_lecture");
const B1 = ".ed-step li .ed-text";
const editBullet = async (p, text) => { await tap(p, B1); await fill(p, ".ed-inline textarea", text); await tap(p, ".ed-inline button", "Save"); await wait(500); };

/* ---------- the admin ---------- */
{
  let n = 100;
  const db = { v2: true, profile: prof({ is_admin: true }), classes: [], roles: [{ role: "admin", school_id: null, school_name: null }], rpc: { admin_save_lecture: () => ++n, admin_content_history: [], admin_undo_content_change: 555 } };
  const p = await session(db, { edit: "1", cls: "erth209" }, "#/l/deformation/notes");
  chk("the admin gets edit mode on the real code path", (await p.evaluate(() => document.querySelectorAll(".ed-bar").length)) === 1 && (await p.evaluate(() => document.querySelectorAll(".ed-text").length)) > 5);
  chk("the lecture was read from the database first and the file after", db.log.some((l) => /GET \/rest\/v1\/lecture_content\?select=body%2Cupdated_at&lecture_id=eq\.deformation/.test(l)));

  await editBullet(p, "First edit sent to the database");
  const first = saves(db)[0];
  chk("one admin_save_lecture call was made", saves(db).length === 1, "calls=" + saves(db).length);
  chk("it sends exactly lid, cid, new_body, old_body and summary", !!first && JSON.stringify(Object.keys(first.body).sort()) === JSON.stringify(["cid", "lid", "new_body", "old_body", "summary"]), first && Object.keys(first.body).join(","));
  chk("lid is the lecture and cid the course", first?.body.lid === "deformation" && first?.body.cid === "erth209");
  chk("new_body is the whole lecture with the change in it", first?.body.new_body.sections[0].steps[0].bullets[0] === "First edit sent to the database" && first.body.new_body.sections.length === published.sections.length && first.body.new_body.cards.length === published.cards.length && first.body.new_body.quiz.length === published.quiz.length);
  chk("old_body is the published lecture, exactly as it was loaded (so the first change can be undone)", JSON.stringify(first?.body.old_body) === JSON.stringify(published));
  chk("summary says what changed", /^Edited a point: .*First edit sent/.test(first?.body.summary || ""), first?.body.summary);
  chk("the admin sees a Saved toast", /Saved/.test(await p.evaluate(() => document.querySelector("#toast").textContent)));
  chk("nothing else of the lecture was changed (only that bullet differs)", await (async () => { const nb = JSON.parse(JSON.stringify(first.body.new_body)); nb.sections[0].steps[0].bullets[0] = published.sections[0].steps[0].bullets[0]; return JSON.stringify(nb) === JSON.stringify(published); })());

  await editBullet(p, "Second edit");
  chk("the second save sends no old_body (the database already holds the lecture)", saves(db).length === 2 && saves(db)[1].body.old_body === null && saves(db)[1].body.new_body.sections[0].steps[0].bullets[0] === "Second edit");

  // a failed save keeps the change on the screen and says so, with a way to retry
  db.rpc.admin_save_lecture = () => ({ __err: "admin only" });
  await editBullet(p, "Third edit that fails");
  chk("a refused save is shown on the toolbar and the text stays on the page", /Not saved/.test(await txt(p, ".ed-status")) && /Only the platform admin/.test(await txt(p, ".ed-status")) && (await txt(p, B1)) === "Third edit that fails", await txt(p, ".ed-status"));
  chk("a Try saving again button appears", await p.evaluate(() => { const b = [...document.querySelectorAll(".ed-bar button")].find((x) => /Try saving again/.test(x.textContent)); return !!b && !b.hidden && b.offsetParent !== null; }));
  chk("the status is announced politely", await p.evaluate(() => document.querySelector(".ed-status").getAttribute("role") === "status"));
  db.rpc.admin_save_lecture = () => ++n;
  await tap(p, ".ed-bar button", "Try saving again"); await wait(600);
  const retry = saves(db).at(-1);
  chk("Try saving again sends the body with the earlier change", retry.body.new_body.sections[0].steps[0].bullets[0] === "Third edit that fails" && retry.body.summary === "Saved earlier changes");
  chk("the warning goes away after a good save", (await txt(p, ".ed-status")) === "" && await p.evaluate(() => [...document.querySelectorAll(".ed-bar button")].find((x) => /Try saving again/.test(x.textContent)).hidden));

  // the database upgrade is missing
  delete db.rpc.admin_save_lecture;
  await editBullet(p, "Fourth edit, no upgrade");
  chk("a missing function says the owner must install supabase/RUN-ME-4.sql", /RUN-ME-4\.sql/.test(await txt(p, ".ed-status")), await txt(p, ".ed-status"));
  db.rpc.admin_save_lecture = () => ++n;

  // two quick saves go one after the other and the later one carries both changes
  const calls0 = saves(db).length;
  await p.evaluate(() => { const els = [...document.querySelectorAll(".ed-step li .ed-text")]; els[1].click(); });
  await wait(100); await fill(p, ".ed-inline textarea", "Quick A"); await p.evaluate(() => [...document.querySelectorAll(".ed-inline button")].find((x) => /Save/.test(x.textContent)).click());
  await p.evaluate(() => { const els = [...document.querySelectorAll(".ed-step li .ed-text")]; els[2].click(); });
  await wait(100); await fill(p, ".ed-inline textarea", "Quick B"); await p.evaluate(() => [...document.querySelectorAll(".ed-inline button")].find((x) => /Save/.test(x.textContent)).click());
  await wait(700);
  const quick = saves(db).slice(calls0);
  chk("two quick edits make two saves, in order, the later one with both changes", quick.length === 2 && quick[0].body.new_body.sections[0].steps[0].bullets[1] === "Quick A" && quick[0].body.new_body.sections[0].steps[0].bullets[2] !== "Quick B" && quick[1].body.new_body.sections[0].steps[0].bullets[1] === "Quick A" && quick[1].body.new_body.sections[0].steps[0].bullets[2] === "Quick B", quick.map((c) => c.body.summary).join(" | "));

  // questions, cards and terms
  await p.evaluate(() => { location.hash = "#/l/deformation/quiz"; }); await wait(900);
  await tap(p, ".ed-bar button", "Add question"); await wait(300);
  await fill(p, ".mdl-card textarea", "Which stress pulls rock apart?");
  await p.evaluate(() => { const t = document.querySelectorAll(".mdl-card input[type=text]"); [["Tension"], ["Compression"], ["Shear"], ["Confining"]].forEach(([v], i) => { t[i].value = v; t[i].dispatchEvent(new Event("input", { bubbles: true })); }); });
  await tap(p, ".mdl-card button", "Add question"); await wait(700);
  const q = saves(db).at(-1).body.new_body.quiz.at(-1);
  chk("a new question is saved with a new id, its options and the correct answer", /^def-a[0-9a-z]+$/.test(q.id) && q.q === "Which stress pulls rock apart?" && q.options.join() === "Tension,Compression,Shear,Confining" && q.answer === 0 && saves(db).at(-1).body.summary.startsWith("Added a question"));
  chk("a student's progress ids are untouched: every old question keeps its id", saves(db).at(-1).body.new_body.quiz.slice(0, published.quiz.length).every((x, i) => x.id === published.quiz[i].id));

  // history: the rows come from admin_content_history and Undo calls admin_undo_content_change with hid
  db.rpc.admin_content_history = [{ id: 555, at: new Date().toISOString(), user_email: "madi@aceit.example", summary: "Added a question: Which stress pulls rock apart?", undone: false }, { id: 554, at: new Date().toISOString(), user_email: "madi@aceit.example", summary: "Edited a point: Quick B", undone: true }];
  await p.evaluate(() => { location.hash = "#/l/deformation/notes"; }); await wait(900);
  await tap(p, ".ed-bar button", "History"); await wait(700);
  const hist = db.rpcCalls.filter((c) => c.fn === "admin_content_history");
  chk("History asks admin_content_history for this lecture (argument lid)", hist.length === 1 && hist[0].body.lid === "deformation", JSON.stringify(hist[0]?.body));
  chk("the rows are listed, the undone one cannot be undone again", await p.evaluate(() => { const r = [...document.querySelectorAll(".ed-hrow")]; return r.length === 2 && /Added a question/.test(r[0].innerText) && !r[0].querySelector("button").disabled && r[1].querySelector("button").disabled && /Undone/.test(r[1].innerText); }));
  await tap(p, ".ed-hrow button"); await wait(900);
  const undo = db.rpcCalls.filter((c) => c.fn === "admin_undo_content_change");
  chk("Undo calls admin_undo_content_change with hid", undo.length === 1 && undo[0].body.hid === 555 && Object.keys(undo[0].body).join() === "hid", JSON.stringify(undo[0]?.body));
  chk("after an undo the lecture is read from the database again", db.log.filter((l) => /GET \/rest\/v1\/lecture_content\?select=body&lecture_id=eq\.deformation/.test(l)).length >= 1);
  await p.ctx.close();
}

/* ---------- a failing database: nothing is lost ---------- */
{
  const db = { v2: true, profile: prof({ is_admin: true }), classes: [], roles: [{ role: "admin" }], rpc: { admin_save_lecture: { __err: "unknown course" } } };
  db.rpc.admin_save_lecture = () => ({ __err: "unknown course" });
  const p = await session(db, { edit: "1", cls: "erth209" }, "#/l/deformation/notes");
  await editBullet(p, "Edit against a database that refuses");
  chk("a refusal from the database is shown in plain words", /does not know this course/.test(await txt(p, ".ed-status")), await txt(p, ".ed-status"));
  await p.ctx.close();
}

/* ---------- a student: the lecture is checked again after two minutes, not before ---------- */
{
  const db = { v2: true, profile: prof(), classes: [{ class_id: "k1", course_id: "erth209", name: "ERTH 209 Section 1", term: "Fall 2026", school_id: "s1", school_name: "Alpha University", role: "student", archived: false }], roles: [] };
  const p = await session(db, { cls: "erth209" }, "#/l/deformation/notes");
  const checks = () => db.log.filter((l) => /GET \/rest\/v1\/lecture_content\?select=updated_at&lecture_id=eq\.deformation/.test(l)).length;
  chk("a student sees no edit controls on the real code path", (await p.evaluate(() => document.querySelectorAll(".ed-bar,.ed-text,.ed-iconbtn,.editpill").length)) === 0 && (await p.evaluate(() => document.querySelectorAll("link[href$='edit.css']").length)) === 0);
  await p.evaluate(() => { location.hash = "#/l/deformation/cards"; }); await wait(700);
  chk("the lecture is not asked for again within two minutes", checks() === 0, "checks=" + checks());
  await p.evaluate(() => { const now = Date.now.bind(Date); Date.now = () => now() + 130000; }); // two minutes and ten seconds later
  await p.evaluate(() => { location.hash = "#/l/deformation/quiz"; }); await wait(900);
  chk("after two minutes the lecture's save time is asked for (a tiny question, not the whole lecture)", checks() === 1, "checks=" + checks());
  chk("the whole lecture is not downloaded again when nothing changed", db.log.filter((l) => /GET \/rest\/v1\/lecture_content\?select=body/.test(l) && /deformation/.test(l)).length === 1);
  await p.evaluate(() => { location.hash = "#/l/deformation/notes"; }); await wait(700);
  chk("and then not again straight away", checks() === 1, "checks=" + checks());
  await p.ctx.close();
}

await b.close();
console.log(`${passed} checks passed`);
if (errs.length) { console.log("ERRORS"); console.log(errs.join("\n")); bad++; }
process.exit(bad ? 1 : 0);
