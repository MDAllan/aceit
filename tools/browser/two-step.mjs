// Two-step login (authenticator app) against the pretend Supabase.
import { launch, SHOTS } from "./common.mjs";
import { fakeSupabase, seedSession } from "./fake.mjs";
const b = await launch();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let bad = 0;
const chk = (name, ok, extra = "") => { if (!ok) bad++; console.log((ok ? "PASS " : "FAIL ") + name + (extra ? "  " + extra : "")); };
const errs = [];
const UID = "11111111-1111-1111-1111-111111111111";
const klass = (o = {}) => ({ class_id: "k1", course_id: "astr207", name: "ASTR 207 Section 1", term: "Fall 2026", school_id: "s1", school_name: "Alpha University", role: "student", exam_name: null, exam_date: null, archived: false, ...o });
const prof = (o = {}) => ({ id: UID, email: "sam@alpha.ca", display_name: "Sam", is_admin: false, blocked: false, access_ok: true, ...o });
const F1 = { id: "f1", status: "verified", factor_type: "totp", friendly_name: "ACEIT" };

async function session(db, seed, hash = "") {
  db.uid = UID;
  const ctx = await b.createBrowserContext(); const p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push("PAGEERR " + e.message)); p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errs.push("CONSOLE " + m.text().slice(0, 200)); });
  p.on("dialog", (d) => d.accept());
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true });
  await p.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
  await seedSession(p, UID, db.profile.email, seed); await fakeSupabase(p, db);
  await p.goto("http://localhost:8765/" + hash, { waitUntil: "networkidle0" }); await wait(1300);
  p.txt = () => p.evaluate(() => document.body.innerText);
  p.type_ = async (sel, v) => { await p.evaluate((sel, v) => { const i = document.querySelector(sel); i.value = v; i.dispatchEvent(new Event("input")); }, sel, v); };
  p.press = (text) => p.evaluate((t) => [...document.querySelectorAll("button")].find((x) => x.textContent.trim().includes(t)).click(), text);
  p.close_ = async () => { chk("nothing is loaded from other websites", !(db.external || []).length, (db.external || []).slice(0, 3).join(" ")); await ctx.close(); };
  return p;
}

/* 1. an account with an authenticator app is asked for the code after the password */
{
  const db = { v2: true, profile: prof(), classes: [klass()], roles: [], factors: [F1] };
  const p = await session(db, { aal: "aal1", factors: [F1] });
  let t = await p.txt();
  chk("code screen appears", /Two-step login/.test(t) && /6-digit code/.test(t) && !/Doppler|Motion/.test(t));
  chk("progress is not sent before the second step", db.progressPosts.length === 0 && db.summaryPosts.length === 0);
  await p.type_("input[aria-label='6-digit code']", "000000"); await p.press("Verify"); await wait(900);
  t = await p.txt(); chk("wrong code is refused with a clear message", /isn't right/.test(t) && /Two-step login/.test(t));
  await p.type_("input[aria-label='6-digit code']", "123456"); await p.press("Verify"); await wait(1800);
  t = await p.txt(); chk("right code opens the app", /ASTR 207/.test(t) && !/6-digit code/.test(t), t.slice(0, 80).replace(/\n/g, " | "));
  await p.close_();
}

/* 2. staff must set it up when the platform requires it */
{
  const db = { v2: true, profile: prof(), classes: [klass({ role: "teacher" })], roles: [], factors: [], mfaRequired: true };
  const p = await session(db, { aal: "aal1", factors: [] });
  let t = await p.txt();
  chk("staff are asked to set it up", /Set up two-step login/.test(t) && /Set up authenticator app/.test(t));
  await p.press("Set up authenticator app"); await wait(800); t = await p.txt();
  chk("QR code and key are shown", /JBSWY3DPEHPK3PXP/.test(t) && await p.evaluate(() => !!document.querySelector("img[alt^='QR code']")));
  await p.type_("input[aria-label='6-digit code']", "999999"); await p.press("Turn on"); await wait(800);
  chk("wrong code during set-up", /isn't right/.test(await p.txt()));
  await p.type_("input[aria-label='6-digit code']", "123456"); await p.press("Turn on"); await wait(1800); t = await p.txt();
  chk("after set-up the app opens", /ASTR 207/.test(t) && !/Set up two-step login/.test(t), t.slice(0, 60).replace(/\n/g, " | "));
  await p.close_();
}
/* 2b. a student is not forced even when it is required for staff */
{
  const db = { v2: true, profile: prof(), classes: [klass()], roles: [], factors: [], mfaRequired: true };
  const p = await session(db, { aal: "aal1", factors: [] });
  chk("students are not forced to set it up", /ASTR 207/.test(await p.txt()) && !/Set up two-step login/.test(await p.txt()));
  await p.close_();
}

/* 3. the profile card */
{
  const db = { v2: true, profile: prof(), classes: [klass()], roles: [], factors: [] };
  const p = await session(db, { aal: "aal1", factors: [] }, "#/profile");
  let t = await p.txt();
  chk("profile offers two-step login", /Two-step login/.test(t) && /Set up authenticator app/.test(t) && /Optional extra protection/.test(t));
  await p.close_();
  const db2 = { v2: true, profile: prof(), classes: [klass()], roles: [], factors: [F1] };
  const p2 = await session(db2, { aal: "aal2", factors: [F1] }, "#/profile");
  t = await p2.txt(); chk("profile shows it is on", /On\. An authenticator app protects this account/.test(t) && /Turn off/.test(t));
  await p2.press("Turn off"); await wait(900);
  chk("turning it off removes the factor", db2.unenrolled === "f1");
  await p2.close_();
  const db3 = { v2: true, profile: prof(), classes: [klass({ role: "teacher" })], roles: [], factors: [F1], mfaRequired: true };
  const p3 = await session(db3, { aal: "aal2", factors: [F1] }, "#/profile");
  t = await p3.txt(); chk("staff cannot turn it off while it is required", /cannot be turned off/.test(t) && !/Turn off/.test(t));
  await p3.close_();
}

/* 4. the admin's switch */
const staffRpc = { staff_schools: [], list_admins: [], list_invites: [], admin_get_confirm_email: false, admin_set_require_mfa: null };
{
  const db = { v2: true, profile: prof({ is_admin: true }), classes: [], roles: [{ role: "admin" }], factors: [], rpc: staffRpc };
  const p = await session(db, { aal: "aal1", factors: [] }, "#/work/settings");
  let t = await p.txt();
  chk("admin without two-step login cannot switch it on", /Two-step login for staff/.test(t) && /Turn it on for your own account first/.test(t));
  chk("...the checkbox is disabled", await p.evaluate(() => [...document.querySelectorAll("label.check")].find((l) => l.textContent.includes("Require two-step login")).querySelector("input").disabled));
  await p.close_();
  const db2 = { v2: true, profile: prof({ is_admin: true }), classes: [], roles: [{ role: "admin" }], factors: [F1], rpc: staffRpc };
  const p2 = await session(db2, { aal: "aal2", factors: [F1] }, "#/work/settings");
  chk("admin on a two-step session can switch it on", await p2.evaluate(() => !([...document.querySelectorAll("label.check")].find((l) => l.textContent.includes("Require two-step login")).querySelector("input").disabled)));
  await p2.evaluate(() => [...document.querySelectorAll("label.check")].find((l) => l.textContent.includes("Require two-step login")).querySelector("input").click()); await wait(800);
  chk("admin_set_require_mfa sends flag", db2.rpcCalls.some((c) => c.fn === "admin_set_require_mfa" && c.body?.flag === true), JSON.stringify(db2.rpcCalls.find((c) => c.fn === "admin_set_require_mfa")?.body));
  await p2.close_();
}

console.log(errs.length ? "ERRORS:\n" + [...new Set(errs)].join("\n") : "no browser errors"); await b.close(); process.exit(bad || errs.length ? 1 : 0);
