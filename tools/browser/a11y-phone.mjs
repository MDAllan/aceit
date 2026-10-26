// Accessibility scan (axe-core, WCAG 2.x A and AA) of the phone screens added in the 2026-10 redesign: login and sign-up, the legal pages,
// Customer Service, glossary, profile with badges and popups, the review popup, the Terms gate, challenges. 375px wide, light and dark.
import { launch, SHOTS } from "./common.mjs";
import { fakeSupabase, seedSession } from "./fake.mjs";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const b = await launch();
let bad = 0;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const UID = "11111111-1111-1111-1111-111111111111";
const soon = new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10);
const klass = (o = {}) => ({ class_id: "k1", course_id: "astr207", name: "ASTR 207 Section 1", term: "Fall 2026", school_id: "s1", school_name: "Alpha University", role: "student", exam_name: "Midterm", exam_date: soon, archived: false, ...o });
const prof = (o = {}) => ({ id: UID, email: "sam@alpha.ca", display_name: "Sam", is_admin: false, blocked: false, access_ok: true, terms_version: "1.0", privacy_version: "1.0", ...o });

async function scan(p, name, scheme) {
  await p.evaluate(axeSource);
  const res = await p.evaluate(() => axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] }, resultTypes: ["violations"] }).then((r) => r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, sample: v.nodes.slice(0, 3).map((n) => (n.target || []).join(" ") + " :: " + (n.failureSummary || "").split("\n").slice(1, 3).join(" ")) }))));
  const serious = res.filter((v) => v.impact === "serious" || v.impact === "critical");
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (serious.length || overflow > 0) bad++;
  console.log((serious.length || overflow > 0 ? "FAIL " : "PASS ") + `${name} (${scheme})` + (overflow > 0 ? `  horizontal overflow ${overflow}px` : "") + (res.length ? `  ${res.length} issue types: ` + res.map((v) => `${v.id}[${v.impact}] x${v.nodes}`).join(", ") : ""));
  for (const v of serious) console.log("   " + v.id + ": " + v.help + "\n     " + v.sample.join("\n     "));
  if (serious.length) await p.screenshot({ path: SHOTS + `/a11yphone_${scheme}_${name.replace(/\W+/g, "_")}.png` });
}
const click = (p, text, sel = "button") => p.evaluate((t, s) => { const el = [...document.querySelectorAll(s)].find((x) => x.textContent.trim() === t); if (!el) throw new Error("no element: " + t); el.click(); }, text, sel);

for (const scheme of ["light", "dark"]) {
  const mk = async (db, session) => {
    const ctx = await b.createBrowserContext(), p = await ctx.newPage();
    await p.setViewport({ width: 375, height: 812, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    await p.emulateMediaFeatures([{ name: "prefers-color-scheme", value: scheme }, { name: "prefers-reduced-motion", value: "reduce" }]);
    if (db) { if (session) await seedSession(p, UID, db.profile.email); await fakeSupabase(p, db); }
    p.ctx = ctx; return p;
  };
  const open = async (p, url, ms = 900) => { await p.goto("http://localhost:8765" + url, { waitUntil: "networkidle0" }); if (url.includes("#")) await p.reload({ waitUntil: "networkidle0" }); await wait(ms); };

  /* the local preview (no login): public pages and the student screens */
  {
    const p = await mk();
    await open(p, "/");
    await scan(p, "login", scheme);
    await click(p, "New here? Sign up"); await scan(p, "sign up with the agreement checkbox", scheme);
    for (const [name, url] of [["terms of service", "/#/terms"], ["privacy policy", "/#/privacy"], ["home", "/?demo#/"], ["a class", "/?demo#/s/biol305"], ["glossary", "/?demo#/glossary"], ["cards with the swipe rows", "/?demo#/cards"],
      ["practice", "/?demo#/practice"], ["progress", "/?demo#/progress"], ["search", "/?demo#/search"], ["profile with badges", "/?demo#/profile"], ["customer service", "/?demo#/help"], ["forgot password", "/?demo#/help/password"],
      ["account hacked", "/?demo#/help/hacked"], ["change email", "/?demo#/help/email"], ["delete my account", "/?demo#/help/delete"], ["ask a question", "/?demo#/help/question"],
      ["a challenge link", "/?demo#/play/biobasics/blitz?s=7&n=10&by=Madi"], ["a bad game link", "/?demo#/play/biobasics/nope"]]) { await open(p, url); await scan(p, name, scheme); }
    await open(p, "/?demo#/s/biol305"); await p.evaluate(() => { location.hash = "#/glossary"; }); await wait(500);
    await p.evaluate(() => document.querySelector(".gl > button").click()); await wait(300); await scan(p, "glossary with an open term", scheme);
    await open(p, "/?demo#/profile"); await p.evaluate(() => document.querySelector(".bdg-tile").click()); await wait(400); await scan(p, "a badge popup", scheme);
    await p.keyboard.press("Escape");
    await open(p, "/?demo&role=admin#/profile"); await p.evaluate(() => [...document.querySelectorAll("#admin-tools summary")].forEach((s) => s.click())); await wait(600); await scan(p, "admin tools open (inbox, instructors)", scheme);
    await p.ctx.close();
  }
  /* a signed-in student on the pretend database: the Terms gate, Home with a message, the review popup */
  {
    const db = { v2: true, profile: prof({ terms_version: null, privacy_version: null }), classes: [klass()], roles: [], rpc: { accept_terms: () => null } };
    const p = await mk(db, true); await open(p, "/"); await scan(p, "the Terms gate", scheme); await p.ctx.close();
  }
  {
    const db = { v2: true, profile: prof(), classes: [klass()], roles: [] };
    const p = await mk(db, true); await open(p, "/"); await scan(p, "Home with an exam message", scheme); await p.ctx.close();
  }
  {
    const db = { v2: true, profile: prof(), classes: [klass()], roles: [], progress: { cards: {}, quiz: {}, read: {}, games: {}, days: {}, prefs: { firstSeen: "2020-01-01" }, sr: {}, stats: {} } };
    const p = await mk(db, true); await open(p, "/", 4500); await scan(p, "the review popup", scheme); await p.ctx.close();
  }
}
await b.close(); process.exit(bad ? 1 : 0);
