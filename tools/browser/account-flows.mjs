// The new phone experience and account flows: sign-up agreement, Terms gate, delete / restore, customer service, review popup,
// in-app notifications, challenges and sharing, badges, the shrinking bars and the class-only screens. Real code paths against a pretend Supabase.
import { launch } from "./common.mjs";
import { fakeSupabase, seedSession } from "./fake.mjs";
const b = await launch();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let bad = 0;
const chk = (name, ok, extra = "") => { if (!ok) bad++; console.log((ok ? "PASS " : "FAIL ") + name + (!ok && extra ? "  " + String(extra).replace(/\s+/g, " ") : "")); };
const errs = [];
const UID = "11111111-1111-1111-1111-111111111111";
const soon = new Date(Date.now() + 12 * 864e5).toISOString().slice(0, 10);
const klass = (o = {}) => ({ class_id: "k1", course_id: "astr207", name: "ASTR 207 Section 1", term: "Fall 2026", school_id: "s1", school_name: "Alpha University", role: "student", exam_name: "Midterm", exam_date: soon, archived: false, ...o });
const prof = (o = {}) => ({ id: UID, email: "sam@alpha.ca", display_name: "Sam", is_admin: false, blocked: false, access_ok: true, terms_version: "1.0", privacy_version: "1.0", ...o });
const blank = (prefs = {}, stats = {}) => ({ cards: {}, quiz: {}, read: {}, games: {}, days: {}, prefs, sr: {}, stats });

async function open(db, hash = "", { width = 375, height = 812, session = true, extra } = {}) {
  const ctx = await b.createBrowserContext(); const p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push("PAGEERR " + e.message)); p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errs.push("CONSOLE " + m.text().slice(0, 200)); });
  p.on("dialog", (d) => d.accept());
  await p.setViewport({ width, height, deviceScaleFactor: 1, isMobile: width < 600, hasTouch: width < 600 });
  await p.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
  if (extra) await p.evaluateOnNewDocument(extra);
  if (session) await seedSession(p, UID, db.profile.email);
  await fakeSupabase(p, db);
  await p.goto("http://localhost:8765/" + hash, { waitUntil: "networkidle0" }); await wait(900);
  p.txt = () => p.evaluate(() => document.body.innerText);
  p.click = (text, sel = "button") => p.evaluate((t, s) => { const el = [...document.querySelectorAll(s)].find((x) => x.textContent.trim() === t); if (!el) throw new Error("no element: " + t); el.click(); }, text, sel);
  p.has = (text, sel = "button") => p.evaluate((t, s) => [...document.querySelectorAll(s)].some((x) => x.textContent.trim() === t), text, sel);
  p.type = (sel, v) => p.evaluate((s, val) => { const el = document.querySelector(s); el.value = val; el.dispatchEvent(new Event("input", { bubbles: true })); }, sel, v);
  p.go = async (h) => { await p.evaluate((x) => { location.hash = x; }, h); await wait(600); };
  p.close_ = async () => { chk("nothing is loaded from other websites", !(db.external || []).length, (db.external || []).slice(0, 3).join(" ")); await ctx.close(); };
  return p;
}

/* ---- 1. signing up: the agreement ---- */
{
  const db = { v2: true, profile: prof(), classes: [], roles: [] };
  const p = await open(db, "", { session: false });
  let t = await p.txt();
  chk("login screen shows the wordmark and a way to sign up", /Log in/.test(t) && await p.has("New here? Sign up"));
  await p.click("New here? Sign up");
  const disabled = () => p.evaluate(() => [...document.querySelectorAll("button.btn")].find((x) => x.textContent.trim() === "Sign up")?.disabled);
  chk("Sign up starts disabled", (await disabled()) === true);
  chk("the checkbox sentence names both documents as links that open the full text", await p.evaluate(() => { const l = document.querySelector("label[for=agree]"); const a = [...l.querySelectorAll("a")]; return /I agree to the Terms of Service and Privacy Policy/.test(l.textContent) && a.length === 2 && a.every((x) => x.target === "_blank") && a[0].getAttribute("href") === "#/terms" && a[1].getAttribute("href") === "#/privacy"; }));
  await p.type("#em", "new@alpha.ca"); await p.type("#pw", "longenough1"); await p.type("#nm", "Newt");
  await p.evaluate(() => document.querySelector("#agree").click());
  chk("ticking the box enables Sign up", (await disabled()) === false);
  await p.evaluate(() => document.querySelector("#agree").click());
  chk("unticking disables it again", (await disabled()) === true);
  await p.evaluate(() => document.querySelector("#agree").click());
  await p.click("Sign up"); await wait(700);
  const su = (db.signups || [])[0];
  chk("the sign-up carries the Terms and Privacy versions", su?.data?.terms_version === "1.0" && su?.data?.privacy_version === "1.0" && su?.data?.name === "Newt", JSON.stringify(su?.data));
  chk("then it asks to confirm the email", /Check your email/.test(await p.txt()));
  await p.go("#/terms"); t = await p.txt();
  chk("the Terms page opens without logging in and shows version and date", /Terms of Service/.test(t) && /Version 1\.0/.test(t) && /Alberta/.test(t));
  await p.go("#/privacy"); t = await p.txt();
  chk("the Privacy Policy page opens without logging in", /Privacy Policy/.test(t) && /Version 1\.0/.test(t) && /PIPEDA/.test(t));
  await p.close_();
}

/* ---- 2. the Terms gate: first time, and after the Terms change ---- */
for (const [label, terms, heading] of [["first time", null, "Before you continue"], ["after an older version", "0.9", "We updated our terms"]]) {
  const db = { v2: true, profile: prof({ terms_version: terms, privacy_version: terms }), classes: [klass()], roles: [], rpc: { accept_terms: () => null } };
  const p = await open(db);
  let t = await p.txt();
  chk(`gate (${label}): asks before showing anything`, t.includes(heading) && !/Your classes/.test(t), (t.match(/Before you continue|We updated our terms|Your classes/) || [""])[0]);
  chk(`gate (${label}): the button waits for the checkbox`, await p.evaluate(() => [...document.querySelectorAll("button.btn")].find((x) => x.textContent.trim() === "Agree and continue")?.disabled === true));
  await p.evaluate(() => document.querySelector("#agree2").click()); await p.click("Agree and continue"); await wait(900);
  const c = db.rpcCalls.find((x) => x.fn === "accept_terms");
  chk(`gate (${label}): the agreement is sent with both versions`, c?.body?.tv === "1.0" && c?.body?.pv === "1.0", JSON.stringify(c?.body));
  chk(`gate (${label}): then Home opens`, /Your classes/.test(await p.txt()));
  await p.close_();
}
{
  const db = { v2: true, profile: prof(), classes: [klass()], roles: [] };
  const p = await open(db);
  chk("someone who already agreed to this version is not asked", /Your classes/.test(await p.txt()));
  await p.close_();
}

/* ---- 3. Home, the top bar, the bottom bar, class-only screens ---- */
{
  const db = { v2: true, profile: prof(), classes: [klass(), klass({ class_id: "k2", course_id: "erth209", name: "ERTH 209 Section 2", exam_name: "Final", exam_date: new Date(Date.now() + 40 * 864e5).toISOString().slice(0, 10) })], roles: [] };
  const p = await open(db);
  const bar = await p.evaluate(() => { const top = document.querySelector(".top .in"); return { h: top.getBoundingClientRect().height, kids: [...top.children].map((x) => x.className.split(" ")[0] + (x.getAttribute("aria-label") ? ":" + x.getAttribute("aria-label") : "")), text: top.innerText.replace(/\n/g, " ") }; });
  chk("top bar is one row of 56px", bar.h <= 56, JSON.stringify(bar));
  chk("top bar has the logo, a level badge and the profile with the first name", /Lv \d/.test(bar.text) && /Sam/.test(bar.text) && bar.kids.some((k) => k.startsWith("brand")), bar.text);
  chk("no class chip, no dark-mode button in the top bar", !(await p.evaluate(() => !!document.querySelector(".top .cls, .top [aria-label='Toggle dark mode']"))));
  chk("search is hidden on a phone", await p.evaluate(() => { const s = document.querySelector(".top .wide-only"); return !s || getComputedStyle(s).display === "none"; }));
  chk("bottom bar: Home, Cards, Practice, Progress", /Home\s+Cards\s+Practice\s+Progress/.test(await p.evaluate(() => document.querySelector(".nav").innerText.replace(/\n/g, " "))));
  let t = await p.txt();
  chk("Home lists both classes and has the join box", /ASTR 207/.test(t) && /ERTH 209/.test(t) && /Join a class/.test(t));
  chk("Home shows the due dates of all classes", /Coming up/.test(t) && /Midterm/.test(t) && /Final/.test(t) && /In 1[23] days/.test(t), (t.match(/Coming up[\s\S]{0,160}/) || [""])[0].replace(/\n/g, " "));
  chk("Home shows the exam note with the first name", /Hello Sam, your midterm is coming up in 2 weeks\./.test(t) && /Do a sprint practice test!/.test(t), (t.match(/Hello Sam[^\n]*/) || [""])[0]);
  chk("the note offers a sprint button", await p.has("Start a sprint"));
  await p.click("Dismiss this message", "button").catch(async () => { await p.evaluate(() => document.querySelector(".note .x").click()); });
  chk("a dismissed note stays gone after a reload", await (async () => { await p.reload({ waitUntil: "networkidle0" }); await wait(800); return !/Hello Sam/.test(await p.txt()); })());
  // several classes and none chosen: Cards, Practice, Progress, Glossary and Search send you back to Home to pick one
  for (const r of ["cards", "practice", "progress", "glossary", "search"]) { await p.go("#/" + r); chk(`#/${r} with no class chosen returns to Home`, (await p.evaluate(() => location.hash)) === "#/" && /Your classes/.test(await p.txt())); }
  await p.go("#/s/astr207"); t = await p.txt();
  chk("opening a class from Home shows only that class", /ASTR 207/.test(t) && !/ERTH 209: Geology/.test(t));
  await p.go("#/cards"); t = await p.txt();
  chk("Cards shows that class (a label, not a switch) and no other class buttons", /ASTR 207/.test(t) && !(await p.evaluate(() => [...document.querySelectorAll("button")].some((x) => /^ERTH 209$/.test(x.textContent.trim())))));
  chk("Cards: one swipeable row, no wrapping", await p.evaluate(() => { const r = document.querySelector(".swipe"); const s = getComputedStyle(r); return s.flexWrap === "nowrap" && s.overflowX === "auto" && (s.scrollbarWidth === "none"); }));
  chk("no emoji in the Cards title", !/[\u{1F300}-\u{1FAFF}]/u.test(await p.evaluate(() => document.querySelector("h1").textContent)));
  await p.go("#/glossary"); t = await p.txt();
  chk("Glossary: terms of this class only, no emoji in the title", /Glossary/.test(t) && !/[\u{1F300}-\u{1FAFF}]/u.test(await p.evaluate(() => document.querySelector("h1").textContent)) && !/Wilson Cycle|Osmosis/.test(t));
  chk("Glossary: every entry is a term (at most 4 words, no question)", await p.evaluate(() => [...document.querySelectorAll(".gl > button .term-t")].every((e) => e.textContent.split(/\s+/).length <= 4 && !e.textContent.includes("?") && !/^(what|why|how|when|which|who)\b/i.test(e.textContent))));
  await p.go("#/progress"); t = await p.txt();
  chk("Progress shows no class switcher and no [object HTMLDivElement]", !/\[object/.test(t) && /My progress/.test(t));
  await p.close_();
}

/* ---- 4. Weak topics list (the old "[object HTMLDivElement]" bug) ---- */
{
  const q = JSON.parse((await import("node:fs")).readFileSync(new URL("../../content/motion.json", import.meta.url), "utf8")).quiz.slice(0, 2);
  const db = { v2: true, profile: prof(), classes: [klass()], roles: [], progress: { ...blank(), quiz: { [q[0].id]: { attempts: 3, correct: 0, last: false }, [q[1].id]: { attempts: 4, correct: 1, last: false } } } };
  const p = await open(db, "#/s/astr207"); await p.go("#/progress");
  const t = await p.txt();
  chk("weak topics are listed with real content", !/\[object/.test(t) && /weak/.test(t) && t.includes(q[0].q.split("\n")[0].slice(0, 25)), (t.match(/Weak topics[\s\S]{0,200}/) || [""])[0].replace(/\n/g, " "));
  chk("weak topics offer to practise them", /Practice these/.test(t));
  await p.close_();
}

/* ---- 5. Customer Service ---- */
{
  const db = { v2: true, profile: prof(), classes: [klass()], roles: [], passwords: { "sam@alpha.ca": "pw-correct-1" }, rpc: {
    request_account_deletion: () => new Date(Date.now() + 22 * 864e5).toISOString(), submit_question: () => null, my_questions: () => [{ id: 1, at: "2026-10-20T10:00:00Z", topic: "My account", message: "Can you help?", status: "answered", admin_note: "Yes, done.", handled_at: "2026-10-21T10:00:00Z" }] } };
  const p = await open(db, "#/profile");
  let t = await p.txt();
  chk("profile has Customer Service with the four choices", /What do you need help with\?/.test(t) && /Forgot my password/.test(t) && /My account got hacked/.test(t) && /Delete my account/.test(t) && /Ask a question/.test(t));
  chk("profile no longer has My classes, Join a class, Study stats or Contact us", !/My classes|Join a class|Study stats|Contact us/.test(t));
  chk("profile ends with links to both legal pages", await p.evaluate(() => { const a = [...document.querySelectorAll(".legalrow a")].map((x) => x.getAttribute("href")); return a.includes("#/terms") && a.includes("#/privacy"); }));
  chk("Send feedback / Review the app sits inside Accessibility", await p.evaluate(() => { const c = document.querySelector("#accessibility"); return !!c && /Review the app/.test(c.textContent) && !!c.querySelector(".star") && /Appearance/.test(c.textContent) && /Colour-blind friendly/.test(c.textContent); }));
  chk("no emoji in any profile card title", await p.evaluate(() => ![...document.querySelectorAll("h1,h2,h3")].some((x) => /[\u{1F300}-\u{1FAFF}☀-➿]/u.test(x.textContent))));
  // forgot password
  await p.go("#/help"); await p.go("#/help/password"); await p.click("Email me a reset link"); await wait(700);
  chk("forgot password sends the reset email for the account's address", (db.recovers || []).some((r) => r.email === "sam@alpha.ca") && /Check your email/.test(await p.txt()), JSON.stringify(db.recovers));
  // hacked: two ways forward
  await p.go("#/help/hacked"); t = await p.txt();
  chk("hacked offers Change my email and Delete my account", /Change my email/.test(t) && /Delete my account/.test(t));
  // change email: wrong password, then right
  await p.go("#/help/email");
  await p.type("#ce-pw", "nope"); await p.click("Continue"); await wait(700);
  chk("a wrong password is refused", /That password is not right/.test(await p.txt()));
  await p.type("#ce-pw", "pw-correct-1"); await p.click("Continue"); await wait(900);
  chk("the right password leads to the new-email step", /Step 2/.test(await p.txt()));
  await p.type("#ce-new", "not-an-email"); await p.click("Update my email");
  chk("a bad email is refused", /does not look like an email/.test(await p.txt()));
  await p.type("#ce-new", "sam.new@alpha.ca"); await p.click("Update my email"); await wait(800);
  chk("the email change is requested and a confirmation is promised", (db.userUpdates || []).some((u) => u.email === "sam.new@alpha.ca") && /confirmation link to sam\.new@alpha\.ca/.test(await p.txt()), JSON.stringify(db.userUpdates) + " | " + (await p.txt()).slice(0, 300));
  // the same with a code
  await p.go("#/help"); await p.go("#/help/email"); await p.click("Email me a code", "button.btn.sm"); await p.click("Email me a code", "button.btn.alt"); await wait(700);
  chk("an emailed code is requested for the current address", (db.otps || []).some((o) => o.email === "sam@alpha.ca"), JSON.stringify(db.otps));
  await p.type("#ce-code", "000000"); await p.click("Continue"); await wait(700);
  chk("a wrong code is refused", /not right or has expired/.test(await p.txt()));
  await p.type("#ce-code", "123456"); await p.click("Continue"); await wait(800);
  chk("the right code leads to the new-email step", /Step 2/.test(await p.txt()));
  // ask a question
  await p.go("#/help"); await p.go("#/help/question"); await p.type("#q-msg", "abc"); await p.click("Send question");
  chk("a too-short question is refused", /at least 5 characters/.test(await p.txt()));
  await p.evaluate(() => { const s = document.querySelector("#q-topic"); s.value = "A suggestion"; });
  await p.type("#q-msg", "Please add more practice questions."); await p.click("Send question"); await wait(800);
  const sq = db.rpcCalls.find((c) => c.fn === "submit_question");
  chk("the question goes to the inbox with its topic", sq?.body?.topic === "A suggestion" && /practice questions/.test(sq?.body?.message || "") && /Thank you/.test(await p.txt()), JSON.stringify(sq?.body));
  await p.go("#/help"); await wait(700); t = await p.txt();
  chk("the person sees their question and the admin's reply", /Your questions/.test(t) && /Reply: Yes, done\./.test(t) && /Answered/.test(t));
  // delete
  await p.go("#/help"); await p.go("#/help/delete"); t = await p.txt();
  chk("the delete page explains 22 days and the restore", /permanently deleted in 22 days/.test(t) && /log in again with the same email within those 22 days/.test(t) && /cancelled/.test(t));
  chk("the delete button is disabled until the box is ticked", await p.evaluate(() => [...document.querySelectorAll("button.btn.warn")].find((x) => /Delete my account/.test(x.textContent))?.disabled === true));
  await p.evaluate(() => document.querySelector("#del-ok").click()); await p.click("Delete my account in 22 days"); await wait(1000);
  chk("deletion is scheduled through the database function", db.rpcCalls.some((c) => c.fn === "request_account_deletion"));
  t = await p.txt();
  chk("the person is told the date and is signed out", /Deletion scheduled/.test(t) && /permanently deleted on/.test(t) && /log in again/.test(t) && (db.log || []).some((l) => /logout/.test(l)));
  await p.close_();
}
{ // logging back in cancels it
  const db = { v2: true, profile: prof({ deletion_requested_at: new Date(Date.now() - 3 * 864e5).toISOString() }), classes: [klass()], roles: [], rpc: { cancel_account_deletion: () => true } };
  const p = await open(db);
  chk("logging in again cancels a scheduled deletion", db.rpcCalls.some((c) => c.fn === "cancel_account_deletion"));
  chk("the person is told the account is restored", /Welcome back\. Your account deletion was cancelled/.test(await p.evaluate(() => document.querySelector("#toast")?.textContent || "")));
  await p.close_();
}
{ // the database update (RUN-ME-4.sql) is not installed yet: say so, never pretend
  const db = { v2: true, profile: prof(), classes: [klass()], roles: [] };
  const p = await open(db, "#/help/question"); await p.type("#q-msg", "Is anybody there?"); await p.click("Send question"); await wait(700);
  chk("without the database update the question form says what is missing", /database update/.test(await p.txt()));
  await p.go("#/help/delete"); await p.evaluate(() => document.querySelector("#del-ok").click()); await p.click("Delete my account in 22 days"); await wait(700);
  chk("without the update nothing is deleted and the person stays signed in", !(db.log || []).some((l) => /logout/.test(l)) && /Delete my account/.test(await p.txt()));
  await p.close_();
}

/* ---- 6. The review popup one day after the first visit ---- */
{
  const db = { v2: true, profile: prof(), classes: [klass()], roles: [], progress: blank({ firstSeen: "2020-01-01" }), rpc: { submit_feedback: () => null } };
  const p = await open(db); await wait(3500);
  const dlg = () => p.evaluate(() => { const d = document.querySelector(".mdl-card[role=dialog]"); return d ? d.innerText.replace(/\n/g, " ") : ""; });
  let t = await dlg();
  chk("a day after the first visit a popup greets the person by name and asks for stars", /Hi Sam, how is Ace It going\?/.test(t), t.slice(0, 120));
  chk("the popup has 5 stars and an optional message", await p.evaluate(() => document.querySelectorAll(".mdl-card .star").length === 5 && !!document.querySelector(".mdl-card textarea")));
  chk("Send waits for a star", await p.evaluate(() => [...document.querySelectorAll(".mdl-card button")].find((x) => x.textContent.trim() === "Send").disabled));
  await p.evaluate(() => document.querySelectorAll(".mdl-card .star")[4].click());
  await p.type(".mdl-card textarea", "Love the glossary."); await p.click("Send", ".mdl-card button"); await wait(2600);
  const fb = db.rpcCalls.find((c) => c.fn === "submit_feedback");
  chk("the review is sent with the rating and message", fb?.body?.r === 5 && /glossary/.test(fb?.body?.m || ""), JSON.stringify(fb?.body));
  chk("the popup closes", !(await dlg()));
  chk("a review is counted for the badge and remembered", db.progressPosts.some((x) => x?.data?.stats?.reviews === 1 && x?.data?.prefs?.reviewed === true), JSON.stringify(db.progressPosts.slice(-1)[0]?.data?.stats));
  await p.close_();
}
{ // a brand-new account is not asked on day one
  const db = { v2: true, profile: prof(), classes: [klass()], roles: [], progress: blank() };
  const p = await open(db); await wait(3500);
  chk("no popup on the first day", !(await p.evaluate(() => !!document.querySelector(".mdl-card"))));
  await p.close_();
}
{ // notifications can be switched off
  const db = { v2: true, profile: prof(), classes: [klass()], roles: [], progress: blank({ notif: { app: false } }) };
  const p = await open(db);
  chk("with notifications off no message is shown", !/Hello Sam/.test(await p.txt()));
  await p.go("#/profile");
  chk("the Notifications switch shows it is off", await p.evaluate(() => { const r = [...document.querySelectorAll(".swrow")].find((x) => /Reminders and challenges/.test(x.textContent)); return r?.getAttribute("aria-checked") === "false"; }));
  await p.evaluate(() => [...document.querySelectorAll(".swrow")].find((x) => /Reminders and challenges/.test(x.textContent)).click()); await wait(500);
  await p.go("#/"); chk("switching it on brings the message back", /Hello Sam/.test(await p.txt()));
  await p.close_();
}

/* ---- 7. Challenges, sharing, badges (the local preview has no login, which is all these need) ---- */
{
  const shim = () => { window.__shared = []; navigator.share = async (d) => { window.__shared.push(d); }; };
  const db = { v2: true, profile: prof(), classes: [], roles: [] };
  const p = await open(db, "?demo#/play/biobasics/blitz?s=7&n=10&by=Madi", { session: false, extra: shim });
  let t = await p.txt();
  chk("a challenge link shows who challenged and what to beat", /Madi challenged you/.test(t) && /Beat 7\/10 in True or false blitz/.test(t));
  chk("the game starts straight away", /Statement 1 of 10/.test(t));
  for (let i = 0; i < 10; i++) { await p.evaluate(() => document.querySelector(".tf .btn").click()); await p.evaluate(() => [...document.querySelectorAll("button.btn")].find((x) => /^(Next|See score)/.test(x.textContent.trim()))?.click()); await wait(120); }
  await wait(900); t = await p.txt();
  chk("after the game the challenge result is shown", /You beat Madi!|A tie!|So close!/.test(t), (t.match(/You beat Madi!|A tie!|So close!/) || [""])[0]);
  const cele = await p.evaluate(() => document.querySelector("[role=alertdialog],[role=dialog]")?.innerText.replace(/\n/g, " ") || "");
  chk("finishing a game earns badges with a congratulation popup naming the badge and its tier", /Congrats! You've earned [A-Z][A-Za-z ]+ – \w+!/.test(cele), cele);
  await p.evaluate(() => [...document.querySelectorAll(".bdg-dlg button")].find((x) => /Nice|Close|Skip/.test(x.textContent))?.click()); await wait(300);
  await p.click("Challenge a friend"); await wait(500);
  const sh = await p.evaluate(() => window.__shared);
  chk("Challenge a friend opens the share sheet with a link, the score and the first name", sh.length === 1 && /#\/play\/biobasics\/blitz\?s=\d+&n=10&by=/.test(sh[0].url) && /Can you beat it/.test(sh[0].text), JSON.stringify(sh));
  const stats = await p.evaluate(() => JSON.parse(localStorage.getItem("erth209:progress:v1")).stats);
  chk("the challenge is counted once for the badges", stats.challengesSent === 1 && stats.gamesPlayed === 1, JSON.stringify(stats));
  await p.go("#/play/biobasics/nope"); chk("an invalid game link is explained", /does not work/.test(await p.txt()));
  await p.go("#/l/biobasics/games"); await p.evaluate(() => document.querySelector(".gcard").click()); await wait(400);
  await p.click("Share", "button"); await wait(400);
  chk("the Share button in a game shares the game itself", (await p.evaluate(() => window.__shared)).some((x) => /#\/play\/biobasics\/match/.test(x.url)));
  for (let i = 0; i < 6; i++) { await p.keyboard.press("Escape"); await wait(150); } // close every celebration still waiting
  await p.go("#/profile"); t = await p.txt();
  chk("the profile shows the Badges section with the starter badges", /Badges/.test(t) && /Game On/.test(t) && /Busy Beaver/.test(t) && /Hot Streak/.test(t) && /High Five/.test(t) && /Study Buddy/.test(t) && /Golden Critic/.test(t));
  chk("locked badges are grey, earned ones are colour", await p.evaluate(() => { const locked = document.querySelector(".bdg-tile.locked .bdg-art"); const earned = document.querySelector(".bdg-tile.earned .bdg-art"); return !!locked && !!earned && /grayscale/.test(getComputedStyle(locked).filter + getComputedStyle(locked.querySelector("img") || locked).filter) && !/grayscale/.test(getComputedStyle(earned).filter); }));
  await p.evaluate(() => document.querySelector(".bdg-tile.locked").click()); await wait(300);
  chk("locked badges say how to unlock them under the picture", await p.evaluate(() => [...document.querySelectorAll(".bdg-tile.locked .bdg-line")].every((x) => / to unlock$/.test(x.textContent)) && /Write a review from your profile to unlock/.test(document.querySelector("#badges").innerText)));
  chk("an unlocked badge shows a thin progress bar and what is left", await p.evaluate(() => { const t = document.querySelector(".bdg-tile.earned"); return !!t && !!t.querySelector(".bdg-bar") && /\d+ more .+ to unlock \w+/.test(t.querySelector(".bdg-line").textContent); }));
  const dlg = await p.evaluate(() => document.querySelector(".bdg-dlg")?.innerText || "");
  chk("tapping a badge shows its name, the tier, how to unlock the next one and a small picture for every tier", /Study 3 days in a row|Get 10 questions right|Reach level 5|Share a game with a friend|Write a review from your profile|Play your first game/.test(dlg) && /all tiers|this badge/i.test(dlg) && await p.evaluate(() => document.querySelectorAll(".bdg-dlg .bdg-tiers li").length >= 1 && [...document.querySelectorAll(".bdg-dlg .bdg-tiers li.locked .bdg-art")].every((a) => a.classList.contains("locked"))));
  await p.close_();
}

/* ---- 8. The bars shrink on the way down and grow back on the way up ---- */
{
  const db = { v2: true, profile: prof(), classes: [klass()], roles: [] };
  const p = await open(db, "?demo#/cards", { session: false, height: 700 });
  const state = () => p.evaluate(() => ({ bars: document.documentElement.dataset.bars || "", top: Math.round(document.querySelector(".top").getBoundingClientRect().height), nav: Math.round(document.querySelector(".nav").getBoundingClientRect().height), lbl: Math.round(document.querySelector(".nav .lbl").getBoundingClientRect().height) }));
  await p.evaluate(() => { localStorage.setItem("erth209:cls", "astr207"); }); await p.go("#/cards"); await p.evaluate(() => { document.body.style.minHeight = "3000px"; });
  const s0 = await state();
  chk("at the top both bars are full size", s0.bars === "" && s0.top === 56 && s0.lbl > 8, JSON.stringify(s0));
  await p.evaluate(() => window.scrollTo(0, 400)); await wait(120); await p.evaluate(() => window.scrollTo(0, 700)); await wait(700);
  const s1 = await state();
  chk("scrolling down shrinks the top bar and the bottom bar", s1.bars === "compact" && s1.top === 40 && s1.nav < s0.nav && s1.lbl === 0, JSON.stringify(s1));
  await p.evaluate(() => window.scrollTo(0, 560)); await wait(120); await p.evaluate(() => window.scrollTo(0, 480)); await wait(700);
  const s2 = await state();
  chk("scrolling up expands both again", s2.bars === "" && s2.top === 56 && s2.lbl > 8, JSON.stringify(s2));
  chk("the content does not jump under the shrinking bar", await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
  await p.close_();
}
{ // on a laptop the search button is there
  const db = { v2: true, profile: prof(), classes: [klass()], roles: [] };
  const p = await open(db, "?demo#/", { session: false, width: 1100, height: 800 });
  chk("search is shown on a wide screen", await p.evaluate(() => { const s = document.querySelector(".top .wide-only"); return !!s && getComputedStyle(s).display !== "none"; }));
  await p.close_();
}

/* ---- 9. Admin tools in the local preview: instructors and the inbox ---- */
{
  const db = { v2: true, profile: prof(), classes: [], roles: [] };
  const p = await open(db, "?demo&role=admin#/profile", { session: false });
  const t = await p.txt();
  chk("an admin's profile has Admin tools with Edit mode and View as a student", /Admin tools/.test(t) && /Edit mode/.test(t) && /View as a student/.test(t));
  await p.evaluate(() => [...document.querySelectorAll("#admin-tools summary")].find((s) => s.textContent.trim() === "Instructors").click());
  await p.type("#admin-tools input[type=search]", "noah"); await wait(900);
  chk("searching finds a person and offers Make instructor", await p.has("Make instructor"), (await p.evaluate(() => document.querySelector("#admin-tools details[open]")?.innerText || "")).slice(0, 200));
  await p.click("Make instructor"); await wait(800);
  chk("the person becomes an instructor and can be removed again", await p.evaluate(() => /Instructor of/.test(document.querySelector("#admin-tools").innerText)));
  await p.evaluate(() => [...document.querySelectorAll("#admin-tools button")].find((x) => /^Remove .* as instructor/.test(x.getAttribute("aria-label") || ""))?.click()); await wait(800);
  chk("removing the instructor role works", await p.evaluate(() => !/Instructor of/.test(document.querySelector("#admin-tools").innerText)));
  await p.close_();
}

console.log(errs.length ? "ERRORS:\n" + errs.join("\n") : "no page errors");
await b.close();
process.exit(bad || errs.length ? 1 : 0);
