// Accessibility scan (axe-core, WCAG A and AA) of screens that only appear after interaction: a quiz question and its feedback, a flipped
// flashcard, every game, the picture viewer, open forms and expanded rows in the staff screens, the login and two-step screens.
// Needs: npm i --no-save puppeteer-core axe-core
import { launch, SHOTS } from "./common.mjs";
import { fakeSupabase, seedSession } from "./fake.mjs";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const b = await launch();
let bad = 0, scanned = 0;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function scan(p, name) {
  await p.evaluate(axeSource);
  const res = await p.evaluate((TAGS) => axe.run(document, { runOnly: { type: "tag", values: TAGS }, resultTypes: ["violations"] }).then((r) => r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, sample: v.nodes.slice(0, 2).map((n) => n.target.join(" ") + " :: " + (n.failureSummary || "").split("\n").slice(1, 3).join(" ").slice(0, 170)) }))), TAGS);
  const serious = res.filter((v) => v.impact === "serious" || v.impact === "critical");
  scanned++; if (serious.length) bad++;
  console.log((serious.length ? "FAIL " : "PASS ") + name + (res.length ? `  ${res.length} issue types: ` + res.map((v) => `${v.id}[${v.impact}] x${v.nodes}`).join(", ") : ""));
  for (const v of serious) console.log("   " + v.id + ": " + v.help + "\n     " + v.sample.join("\n     "));
  if (serious.length) await p.screenshot({ path: SHOTS + `/a11y_${name.replace(/\W+/g, "_")}.png` });
}
const click = (p, sel, text) => p.evaluate((sel, text) => { const el = [...document.querySelectorAll(sel)].find((x) => !text || x.textContent.includes(text)); if (el) el.click(); return !!el; }, sel, text);
async function page(scheme) {
  const ctx = await b.createBrowserContext(); // a clean browser each time, so a pretend login from one screen cannot leak into the next
  const p = await ctx.newPage(); p.close = () => ctx.close();
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true });
  await p.emulateMediaFeatures([{ name: "prefers-color-scheme", value: scheme }, { name: "prefers-reduced-motion", value: "reduce" }]); // reduced motion: no half-faded text mid-animation to confuse the contrast check
  p.on("dialog", (d) => d.accept());
  return p;
}
const open = async (p, url) => { await p.goto("http://localhost:8765" + url, { waitUntil: "networkidle0" }); await wait(800); };

for (const scheme of ["light", "dark"]) {
  const p = await page(scheme);
  const tag = ` (${scheme})`;
  // quiz: a question, then the feedback after answering
  await open(p, "/?demo#/l/motion/quiz"); await click(p, "button", "Start quiz"); await wait(500); await scan(p, "quiz question" + tag);
  await click(p, ".opt"); await wait(500); await scan(p, "quiz feedback" + tag);
  // a flashcard, flipped
  await open(p, "/?demo#/l/motion/cards"); await click(p, ".fc"); await wait(700); await scan(p, "flashcard flipped" + tag);
  // every game of two lectures
  for (const lec of ["motion", "strat"]) {
    await open(p, `/?demo#/l/${lec}/games`);
    const n = await p.evaluate(() => document.querySelectorAll(".gcard").length);
    for (let i = 0; i < n; i++) {
      await p.evaluate((i) => document.querySelectorAll(".gcard")[i].click(), i); await wait(700);
      const title = await p.evaluate(() => document.querySelector("#view h2, #view h3, #view .q")?.textContent?.slice(0, 24) || "game");
      await scan(p, `game ${lec} #${i + 1} ${title}` + tag);
      await p.evaluate(() => [...document.querySelectorAll("button")].find((x) => x.textContent.includes("All games"))?.click()); await wait(300);
    }
  }
  // the picture viewer
  await open(p, "/?demo#/l/strat/notes"); if (await click(p, ".figbtn")) { await wait(400); await scan(p, "picture viewer" + tag); }
  // staff screens with forms open and a row expanded
  await open(p, "/?demo&role=admin#/work/schools"); await p.evaluate(() => [...document.querySelectorAll("summary")].forEach((s) => s.click())); await wait(300); await scan(p, "new school form" + tag);
  await open(p, "/?demo&role=admin#/work/class/k-a1"); await p.evaluate(() => { document.querySelectorAll("summary").forEach((s) => s.click()); }); await wait(900); await scan(p, "class page, rows expanded" + tag);
  await open(p, "/?demo&role=admin#/work/school/sch-a/settings"); await scan(p, "school settings" + tag);
  await open(p, "/?demo&role=admin#/work/admins"); await scan(p, "admins" + tag);
  await open(p, "/?demo&role=admin#/work/people"); await p.type("input[type=search]", "noah"); await wait(500); await scan(p, "find a person" + tag);
  await open(p, "/?demo&role=admin#/work/activity"); await scan(p, "activity" + tag);
  await open(p, "/?demo&role=admin#/work/content"); await scan(p, "content" + tag);
  await p.close();

  // the login, join and two-step screens (real code path, pretend database)
  const UID = "11111111-1111-1111-1111-111111111111";
  const prof = { id: UID, email: "sam@alpha.ca", display_name: "Sam", is_admin: false, blocked: false, access_ok: true };
  const F1 = { id: "f1", status: "verified", factor_type: "totp" };
  const q = await page(scheme); await fakeSupabase(q, { v2: true, profile: prof, classes: [], roles: [] });
  await q.goto("http://localhost:8765/", { waitUntil: "networkidle0" }); await wait(800); await scan(q, "login" + tag);
  await q.waitForFunction(() => [...document.querySelectorAll("button")].some((x) => x.textContent.includes("Sign up")), { timeout: 10000 }); await q.evaluate(() => [...document.querySelectorAll("button")].find((x) => x.textContent.includes("Sign up")).click()); await wait(300); await scan(q, "sign up" + tag);
  await q.close();
  const r = await page(scheme); const db = { v2: true, profile: prof, classes: [], roles: [], factors: [F1], uid: UID };
  await seedSession(r, UID, prof.email, { aal: "aal1", factors: [F1] }); await fakeSupabase(r, db);
  await r.goto("http://localhost:8765/", { waitUntil: "networkidle0" }); await wait(900); await scan(r, "two-step code screen" + tag);
  await r.close();
  const t = await page(scheme); const db2 = { v2: true, profile: prof, classes: [{ class_id: "k1", course_id: "astr207", name: "ASTR 207", term: "Fall", school_id: "s", school_name: "Alpha University", role: "student", archived: false }], roles: [], factors: [], uid: UID };
  await seedSession(t, UID, prof.email, { aal: "aal1", factors: [] }); await fakeSupabase(t, db2);
  await t.goto("http://localhost:8765/#/profile", { waitUntil: "networkidle0" }); await wait(1000); await scan(t, "profile with classes and two-step card" + tag);
  await t.close();
}
await b.close(); console.log(`${scanned} screens scanned`); process.exit(bad ? 1 : 0);
