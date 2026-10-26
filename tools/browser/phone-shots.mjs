// Walks every student screen at 375px (a small phone) on the pretend database and saves a picture of each, so a person can look at them.
// Also checks the phone layout rules: no sideways scrolling, one-row top bar with the right parts, both bars shrink on scroll down and grow on scroll up,
// the card/practice/glossary tab rows swipe sideways, no class picker inside a class, no object-to-text leaks ("[object ...]") anywhere.
//   python -m http.server 8765    then    node tools/browser/phone-shots.mjs         (pictures: <temp folder>/aceit-shots/phone_*.png)
import { launch, SHOTS } from "./common.mjs";
import { fakeSupabase, seedSession } from "./fake.mjs";
import { readFileSync } from "node:fs";

const b = await launch();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let bad = 0;
const chk = (name, ok, extra = "") => { if (!ok) bad++; console.log((ok ? "PASS " : "FAIL ") + name + (extra ? "  " + extra : "")); };
const UID = "11111111-1111-1111-1111-111111111111";
const soon = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);
const klass = (o = {}) => ({ class_id: "k1", course_id: "astr207", name: "ASTR 207 Section 1", term: "Fall 2026", school_id: "s1", school_name: "Alpha University", role: "student", exam_name: "Midterm", exam_date: soon, archived: false, ...o });
const prof = (o = {}) => ({ id: UID, email: "madi@alpha.ca", display_name: "Madi Ahmed", is_admin: false, blocked: false, access_ok: true, terms_version: "1.0", privacy_version: "1.0", ...o });
const motion = JSON.parse(readFileSync(new URL("../../content/motion.json", import.meta.url), "utf8"));

// some answers: a few weak questions (wrong most of the time), a few strong ones
const quiz = {};
motion.quiz.slice(0, 4).forEach((q) => { quiz[q.id] = { attempts: 5, correct: 1, last: false, conf: "sure" }; });
motion.quiz.slice(4, 9).forEach((q) => { quiz[q.id] = { attempts: 3, correct: 3, last: true }; });
const progress = { cards: {}, quiz, read: { motion: { [motion.sections[0].id]: 1 } }, games: {}, days: {}, prefs: { firstSeen: new Date().toISOString().slice(0, 10), badgeSchema: 2, badgeTiers: { "game-on": 2, "study-buddy": 1, "golden-critic": 1 }, lvl: 2 }, sr: {}, stats: { gamesPlayed: 12, shares: 1, reviews: 1 } };

const errs = [];
async function open(db, hash = "") {
  const ctx = await b.createBrowserContext(), p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push("PAGEERR " + e.message));
  p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errs.push("CONSOLE " + m.text().slice(0, 200)); });
  p.on("dialog", (d) => d.accept());
  await p.setViewport({ width: 375, height: 812, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await p.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }, { name: "prefers-reduced-motion", value: "reduce" }]);
  await seedSession(p, UID, db.profile.email); await fakeSupabase(p, db);
  await p.goto("http://localhost:8765/" + hash, { waitUntil: "networkidle0" }); await wait(1200);
  p.ctx = ctx; return p;
}
const go = async (p, hash, ms = 1100) => { await p.evaluate((h) => { location.hash = h; }, hash); await wait(ms); };
const shot = (p, name, full = false) => p.screenshot({ path: SHOTS + "/phone_" + name + ".png", fullPage: full });
const text = (p) => p.evaluate(() => document.body.innerText);
const overflow = (p) => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const checkScreen = async (p, name) => {
  const o = await overflow(p), t = await text(p);
  chk(`${name}: no sideways scrolling`, o <= 0, o > 0 ? o + "px too wide" : "");
  chk(`${name}: no "[object ...]" text`, !/\[object /.test(t));
  chk(`${name}: no class picker`, await p.evaluate(() => !document.querySelector("select[aria-label*='lass' i], .classpick, .clsel")));
  // no emoji in any title, tab or section header (the greeting "Hi Madi" on Home is the one place an emoji adds meaning)
  const emoji = await p.evaluate(() => [...document.querySelectorAll("h1,h2,h3,.acc>button,.tab,.hero .ctag,.bdg-name,.helpbtn")].filter((x) => !(x.tagName === "H1" && /^Hi /.test(x.textContent))).map((x) => x.textContent.trim()).filter((t) => /\p{Extended_Pictographic}/u.test(t)));
  chk(`${name}: no emoji in titles`, emoji.length === 0, emoji.slice(0, 3).join(" | "));
};

const db = { v2: true, profile: prof(), classes: [klass(), klass({ class_id: "k2", course_id: "biol305", name: "BIOL 305 Section 1", exam_name: "Final", exam_date: new Date(Date.now() + 40 * 864e5).toISOString().slice(0, 10) })], roles: [], progress };
const p = await open(db);

/* ---- Home ---- */
await shot(p, "01_home");
await checkScreen(p, "Home");
const bar = await p.evaluate(() => { const t = document.querySelector("header.top"); const kids = [...t.querySelectorAll(".in > *")].filter((x) => x.offsetParent !== null).map((x) => (x.getAttribute("aria-label") || x.textContent).trim()); return { h: Math.round(t.getBoundingClientRect().height), kids, mids: [...t.querySelectorAll(".in > *")].filter((x) => x.offsetParent !== null && x.getBoundingClientRect().width > 8).map((x) => { const r = x.getBoundingClientRect(); return Math.round(r.top + r.height / 2); }), text: t.innerText.replace(/\s+/g, " ") }; });
console.log("   top bar:", JSON.stringify(bar));
chk("top bar is one row", Math.max(...bar.mids) - Math.min(...bar.mids) <= 6 && bar.h <= 64, `height ${bar.h}, centres ${bar.mids}`);
chk("top bar shows Lv and the first name", /Lv\s*\d+/.test(bar.text) && /Madi/.test(bar.text) && !/Ahmed/.test(bar.text), bar.text);
chk("top bar has no class picker and no dark-mode button", await p.evaluate(() => !document.querySelector("header.top select, header.top [aria-label*='theme' i], header.top [aria-label*='dark' i]")));
chk("Home lists both classes and Join a class", /ASTR 207/.test(await text(p)) && /BIOL 305/.test(await text(p)) && /Join a class/i.test(await text(p)));
chk("Home shows the due dates", /Coming up/.test(await text(p)));
chk("Home shows the study stats", /Level \d+/.test(await text(p)) && /XP/.test(await text(p)));

/* ---- scrolling shrinks both bars ---- */
await p.evaluate(() => { document.body.style.minHeight = "3000px"; });
const sizes = async () => p.evaluate(() => ({ top: Math.round(document.querySelector("header.top").getBoundingClientRect().height), nav: Math.round(document.querySelector("nav.nav").getBoundingClientRect().height), bars: document.documentElement.dataset.bars || "" }));
const s0 = await sizes();
await p.evaluate(() => window.scrollTo(0, 400)); await wait(500); await p.evaluate(() => window.scrollTo(0, 800)); await wait(600);
const s1 = await sizes(); await shot(p, "02_home_scrolled_down");
await p.evaluate(() => window.scrollTo(0, 500)); await wait(600);
const s2 = await sizes();
console.log("   bars:", JSON.stringify({ s0, s1, s2 }));
chk("top bar shrinks on scroll down", s1.top < s0.top, `${s0.top}px -> ${s1.top}px`);
chk("bottom bar shrinks on scroll down", s1.nav < s0.nav, `${s0.nav}px -> ${s1.nav}px`);
chk("both bars grow back on scroll up", s2.top === s0.top && s2.nav === s0.nav, JSON.stringify(s2));
chk("bottom bar sticks to the bottom of the screen", await p.evaluate(() => { const r = document.querySelector("nav.nav").getBoundingClientRect(); return Math.abs(r.bottom - innerHeight) < 2; }));
await p.evaluate(() => window.scrollTo(0, 0));

/* ---- a class ---- */
await go(p, "#/s/astr207"); await shot(p, "03_class"); await checkScreen(p, "Class page");
await go(p, "#/l/motion/notes"); await shot(p, "04_notes"); await checkScreen(p, "Notes");
await go(p, "#/l/motion/cards"); await shot(p, "05_lecture_cards"); await checkScreen(p, "Lecture cards");
await go(p, "#/l/motion/quiz"); await shot(p, "06_quiz_menu"); await checkScreen(p, "Quiz menu");
await go(p, "#/l/motion/games"); await shot(p, "07_games"); await checkScreen(p, "Games");

/* ---- Cards (all lectures): ONE swipeable row ---- */
await go(p, "#/cards"); await shot(p, "08_cards"); await checkScreen(p, "Cards");
const row = await p.evaluate(() => { const r = document.querySelector(".swipe"); const cs = getComputedStyle(r); const kids = [...r.children]; return { ow: cs.overflowX, wrap: cs.flexWrap, snap: cs.scrollSnapType, sb: cs.scrollbarWidth, scrollW: r.scrollWidth, clientW: r.clientWidth, tops: new Set(kids.map((k) => Math.round(k.getBoundingClientRect().top))).size, n: kids.length, snapAlign: kids[0] && getComputedStyle(kids[0]).scrollSnapAlign }; });
console.log("   card tabs row:", JSON.stringify(row));
chk("card tabs are ONE row that scrolls sideways", row.ow === "auto" || row.ow === "scroll", JSON.stringify(row));
chk("card tabs do not wrap", row.wrap === "nowrap" && row.tops === 1 && row.scrollW > row.clientW, JSON.stringify(row));
chk("card tabs snap and hide the scrollbar", /x/.test(row.snap) && row.sb === "none" && row.snapAlign !== "none", JSON.stringify(row));
await go(p, "#/practice"); await shot(p, "09_practice"); await checkScreen(p, "Practice");
await go(p, "#/glossary"); await shot(p, "10_glossary"); await checkScreen(p, "Glossary");
await go(p, "#/search"); await shot(p, "11_search"); await checkScreen(p, "Search");

/* ---- Progress: the weak-topics bug ---- */
await go(p, "#/progress"); await shot(p, "12_progress", true); await checkScreen(p, "Progress");
const t = await text(p);
chk("Progress lists weak topics", /Weak topics/.test(t) && /weak/.test(t) && /Practice these/.test(t));
chk("Progress has no [object HTMLDivElement]", !/object HTML/.test(t));

/* ---- Profile ---- */
await go(p, "#/profile"); await shot(p, "13_profile", true); await checkScreen(p, "Profile");
const pt = await text(p);
chk("Profile has no My classes / Join a class / study stats / Contact us", !/My classes/i.test(pt) && !/Join a class/i.test(pt) && !/Study stats/i.test(pt) && !/Contact us/i.test(pt) && !/@[a-z]+\.[a-z]/i.test(pt.replace(/madi@alpha\.ca/g, "")));
chk("Profile has Badges, Accessibility, Customer Service, Terms and Privacy", ["Badges", "Accessibility", "Customer Service", "Terms of Service", "Privacy Policy"].every((w) => pt.includes(w)));
/* ---- Review stars: yellow, big, no boxes ---- */
await p.evaluate(() => document.querySelector(".stars").scrollIntoView({ block: "center" })); await wait(300);
const st = await p.evaluate(() => { const b = document.querySelector(".star"), cs = getComputedStyle(b), body = getComputedStyle(b.querySelector(".body")); return { w: Math.round(b.getBoundingClientRect().width), border: cs.borderTopWidth, bg: cs.backgroundColor, fill: body.fill }; });
chk("review stars are yellow, at least 48px wide, with no box around them", st.w >= 48 && st.border === "0px" && /rgba\(0, 0, 0, 0\)|transparent/.test(st.bg) && /rgb\(255, 2[0-9]{2}, \d+\)/.test(st.fill), JSON.stringify(st));
await p.evaluate(() => document.querySelectorAll(".star")[3].click()); await wait(300); await shot(p, "13a_stars");
/* ---- Badges ---- */
await p.evaluate(() => document.querySelector("#badges").scrollIntoView()); await wait(300); await shot(p, "13b_badges");
const tiles = await p.evaluate(() => [...document.querySelectorAll(".bdg-tile")].map((t) => ({ name: t.querySelector(".bdg-name").textContent.replace(/^(Locked|Unlocked): /, ""), tier: t.querySelector(".bdg-tier")?.textContent || "", line: t.querySelector(".bdg-line").textContent, locked: t.classList.contains("locked"), gray: /grayscale/.test(getComputedStyle(t.querySelector(".bdg-art")).filter), bar: !!t.querySelector(".bdg-bar") })));
console.log("   badge tiles:", JSON.stringify(tiles));
chk("the six starter badges come first, then the level 2 badges", ["Game On", "Busy Beaver", "Hot Streak", "High Five", "Study Buddy", "Golden Critic"].every((n, i) => tiles[i]?.name === n) && tiles.length > 6);
chk("locked badges are grey and say how to unlock them", tiles.filter((t) => t.locked).length >= 3 && tiles.filter((t) => t.locked).every((t) => t.gray && / to unlock$/.test(t.line) && !t.bar));
chk("an earned badge is in colour with its tier, a progress bar and what is left", tiles.filter((t) => !t.locked && t.bar).every((t) => !t.gray && t.tier && /^\d+ more .* to unlock /.test(t.line)));
chk("Game On at 12 games is Silver, 38 games from Gold", tiles.some((t) => t.name === "Game On" && t.tier === "Silver" && t.line === "38 more games to unlock Gold"));
chk("Study Buddy with 1 share is Bronze, 4 shares from Silver", tiles.some((t) => t.name === "Study Buddy" && t.tier === "Bronze" && t.line === "4 more shares to unlock Silver"));
chk("a single badge that is earned says Max level reached", tiles.some((t) => t.name === "Golden Critic" && t.line === "Max level reached" && !t.tier));
await p.evaluate(() => [...document.querySelectorAll(".bdg-tile")].find((t) => /Study Buddy/.test(t.textContent)).click()); await wait(400); await shot(p, "13c_badge_popup");
const pop = await p.evaluate(() => ({ text: document.querySelector(".bdg-dlg").innerText.replace(/\n+/g, " | "), tiers: [...document.querySelectorAll(".bdg-dlg .bdg-tiers li")].map((li) => ({ n: li.textContent.trim(), grey: /grayscale/.test(getComputedStyle(li.querySelector(".bdg-art")).filter) })) }));
console.log("   popup:", JSON.stringify(pop));
chk("the popup shows the badge name, the current tier and how to unlock the next", /Study Buddy/.test(pop.text) && /Bronze/.test(pop.text) && /Next: Silver/.test(pop.text) && /Share 5 games with friends/.test(pop.text));
chk("the popup has a small picture for each of the 3 tiers: unlocked in colour, locked in grey", pop.tiers.length === 3 && !pop.tiers[0].grey && pop.tiers[1].grey && pop.tiers[2].grey, JSON.stringify(pop.tiers));
await p.keyboard.press("Escape"); await wait(200);
await go(p, "#/help"); await shot(p, "14_help"); await checkScreen(p, "Customer service");
await go(p, "#/help/hacked"); await shot(p, "15_help_hacked");
await go(p, "#/help/delete"); await shot(p, "16_help_delete", true);
await go(p, "#/help/question"); await shot(p, "17_help_question");
await go(p, "#/help/email"); await shot(p, "18_help_email");
await go(p, "#/terms"); await shot(p, "19_terms"); await checkScreen(p, "Terms");
await go(p, "#/privacy"); await shot(p, "20_privacy"); await checkScreen(p, "Privacy");
chk("no script errors", errs.length === 0, errs.slice(0, 3).join(" | "));
await p.ctx.close();

/* ---- the celebration ---- */
{
  const db2 = { v2: true, profile: prof(), classes: [klass()], roles: [], progress: { cards: {}, quiz: {}, read: {}, games: {}, days: {}, prefs: { firstSeen: new Date().toISOString().slice(0, 10), badgeSchema: 2, badgeTiers: {}, lvl: 1 }, sr: {}, stats: { gamesPlayed: 1 } } };
  const q = await open(db2, "#/l/motion/notes");
  await q.evaluate(() => [...document.querySelectorAll("button")].find((x) => x.textContent.trim().startsWith("Next") && !x.disabled).click()); await wait(1600);
  await shot(q, "13d_celebration");
  const cele = await q.evaluate(() => document.querySelector("[role=alertdialog]")?.innerText.replace(/\n+/g, " | ") || "");
  console.log("   celebration:", cele);
  chk("earning a tier shows: Congrats! You've earned [Badge Name] – [Tier]!", /Congrats! You've earned Game On – Bronze!/.test(cele));
  chk("the celebration shows the badge picture", await q.evaluate(() => !!document.querySelector("[role=alertdialog] .bdg-art img, [role=alertdialog] .bdg-art .bdg-ini")));
  await q.ctx.close();
}

/* ---- the admin: Edit mode (the local preview with sample data) ---- */
{
  const adminPage = async (hash, prefs = {}) => {
    const ctx = await b.createBrowserContext(), a = await ctx.newPage();
    await a.setViewport({ width: 375, height: 812, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    await a.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }, { name: "prefers-reduced-motion", value: "reduce" }]);
    await a.evaluateOnNewDocument((prefs) => { try { for (const [k, v] of Object.entries(prefs)) localStorage.setItem("erth209:" + k, v); } catch {} }, { cls: "erth209", ...prefs });
    await a.goto("http://localhost:8765/?demo&role=admin" + hash, { waitUntil: "networkidle0" }); await wait(1000); a.ctx = ctx; return a;
  };
  let a = await adminPage("#/profile");
  await a.evaluate(() => document.querySelector("#admin-tools").scrollIntoView()); await wait(200); await shot(a, "30_admin_tools_edit_off");
  chk("the admin sees the Edit mode switch in the profile", /Edit mode/.test(await text(a)));
  await a.ctx.close();
  a = await adminPage("#/l/deformation/notes", { edit: "1" });
  await shot(a, "31_admin_edit_notes");
  chk("with Edit mode on the admin sees edit tools and the Edit pill", await a.evaluate(() => !!document.querySelector(".editpill.on") && document.querySelectorAll(".ed-text,.ed-bar,.ed-pagetools,.ed-inline").length > 0));
  chk("edit mode does not break the phone layout", (await overflow(a)) <= 0);
  await go(a, "#/l/deformation/quiz"); await shot(a, "32_admin_edit_questions");
  await a.evaluate(() => [...document.querySelectorAll("button")].find((x) => /Add question/i.test(x.textContent))?.click()); await wait(500); await shot(a, "33_admin_add_question");
  chk("Add question opens a form with the question, options, correct answer, explanation and topic", await a.evaluate(() => { const t = document.querySelector(".mdl-card")?.innerText || ""; return /question/i.test(t) && /correct/i.test(t) && /explanation/i.test(t) && /topic/i.test(t); }));
  await a.ctx.close();
  for (const [who, url] of [["a student", "?demo#/l/deformation/notes"], ["an instructor", "?demo&role=instructor#/l/deformation/notes"]]) {
    const ctx = await b.createBrowserContext(), q = await ctx.newPage();
    await q.setViewport({ width: 375, height: 812, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    await q.evaluateOnNewDocument(() => { try { localStorage.setItem("erth209:cls", "erth209"); localStorage.setItem("erth209:edit", "1"); } catch {} });
    await q.goto("http://localhost:8765/" + url, { waitUntil: "networkidle0" }); await wait(900);
    chk(`${who} never sees edit mode, even with the setting forced on`, await q.evaluate(() => !document.querySelector(".editpill, .ed-text, .ed-bar, .ed-pagetools, .ed-inline")));
    await ctx.close();
  }
}

/* ---- signed out ---- */
{
  const ctx = await b.createBrowserContext(), q = await ctx.newPage();
  await q.setViewport({ width: 375, height: 812, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await q.goto("http://localhost:8765/", { waitUntil: "networkidle0" }); await wait(600); await shot(q, "21_login");
  await q.evaluate(() => [...document.querySelectorAll("button")].find((x) => /Sign up/.test(x.textContent)).click()); await wait(300); await shot(q, "22_signup");
  const dis = await q.evaluate(() => [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "Sign up").disabled);
  chk("Sign up button is disabled until the agreement box is ticked", dis === true);
  await q.evaluate(() => document.querySelector("#agree").click()); await wait(100);
  chk("Sign up button is enabled once the box is ticked", await q.evaluate(() => ![...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "Sign up").disabled));
  await ctx.close();
}
console.log(`pictures are in ${SHOTS}`);
await b.close(); process.exit(bad ? 1 : 0);
