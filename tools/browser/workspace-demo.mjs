import { launch, SHOTS } from "./common.mjs";
const b = await launch();
const p = await b.newPage(); const errs = [];
p.on("pageerror", e => errs.push("PAGEERR " + e.message)); p.on("console", m => { if (m.type() === "error") errs.push("CONSOLE " + m.text().slice(0, 200)); });
p.on("dialog", d => d.accept("x")); // confirm() boxes
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true });
await p.emulateMediaFeatures([{ name: "prefers-color-scheme", value: process.env.SCHEME || "light" }]);
const wait = ms => new Promise(r => setTimeout(r, ms));
const txt = () => p.evaluate(() => document.querySelector("#view").innerText);
const overflow = () => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const open = async (role, hash) => { await p.goto(`http://localhost:8765/?demo&role=${role}${hash}`, { waitUntil: "networkidle0" }); await wait(900); };
const click = (sel, text) => p.evaluate((sel, text) => { const el = [...document.querySelectorAll(sel)].find(x => !text || x.textContent.includes(text)); if (!el) return false; el.click(); return true; }, sel, text);
let bad = 0;
const chk = (name, ok, extra = "") => { if (!ok) bad++; console.log((ok ? "PASS " : "FAIL ") + name + (extra ? "  " + extra : "")); };

/* ---------- platform admin ---------- */
await open("admin", "#/work");
let t = await txt();
chk("admin lands on Schools", /Platform/.test(t) && /Alpha University/.test(t) && /Beta College/.test(t) && /ACEIT Direct/.test(t));
chk("admin tabs", ["Schools", "Admins", "People", "Content", "Settings", "Activity"].every(x => t.includes(x)));
chk("admin tiles", /Schools/.test(t) && /Active this week/.test(t));
chk("bottom nav says Platform", await p.evaluate(() => document.querySelector(".nav").innerText.includes("Platform")));
chk("no horizontal overflow (admin schools)", (await overflow()) <= 0, "overflow=" + await overflow());
await p.screenshot({ path: SHOTS + "/w_admin_schools.png" });

await click("button.card.rowcard", "Alpha University"); await wait(900);
t = await txt();
chk("school page opens", /Alpha University/.test(t) && /ASTR 207 Section 1/.test(t) && /ERTH 209 Section 2/.test(t), await p.evaluate(() => location.hash));
chk("school tabs for admin", ["Classes", "Instructors", "Settings", "Activity"].every(x => t.includes(x)));
chk("no horizontal overflow (school)", (await overflow()) <= 0, "overflow=" + await overflow());
await p.screenshot({ path: SHOTS + "/w_admin_school.png" });

// open a class, check roster, expand a student
await click("button.card.rowcard", "ASTR 207 Section 1"); await wait(1500);
t = await txt();
chk("class page", /Join code/.test(t) && /Students \(11\)/.test(t) && /Class insights/.test(t) && /Exam date/.test(t), await p.evaluate(() => location.hash));
chk("code shown", /K7QM-2WXP/.test(t));
chk("no horizontal overflow (class)", (await overflow()) <= 0, "overflow=" + await overflow());
await p.screenshot({ path: SHOTS + "/w_admin_class.png", fullPage: true });
await p.evaluate(() => document.querySelector("details.person > summary").click()); await wait(700);
t = await txt();
chk("student detail shows lectures", /Read \d+\/\d+/.test(t) && /Remove from class/.test(t) && /Block/.test(t) && /Delete account/.test(t));
await p.screenshot({ path: SHOTS + "/w_admin_student.png" });
// hardest questions loaded
await wait(300); t = await txt();
chk("hardest questions list", /Hardest questions/.test(t) && /% correct/.test(t));
// change code to a custom one
await p.evaluate(() => { const i = document.querySelector("input[aria-label='New join code']"); i.value = "ABC12"; });
await click("button", "Save"); await wait(200);
t = await txt(); // too short -> toast, code unchanged
chk("short code refused", /K7QM-2WXP/.test(t));
await p.evaluate(() => { const i = document.querySelector("input[aria-label='New join code']"); i.value = "COSMOS-77"; });
// click the Save button right after the code input
await p.evaluate(() => { const i = document.querySelector("input[aria-label='New join code']"); i.nextElementSibling.click(); }); await wait(1200);
t = await txt(); chk("custom code saved", /COSMOS-77/.test(t));
// duplicate code refused (code of another class)
await p.evaluate(() => { const i = document.querySelector("input[aria-label='New join code']"); i.value = "madi@77"; i.nextElementSibling.click(); }); await wait(500);
chk("duplicate code toast", await p.evaluate(() => /already used/.test(document.querySelector("#toast").textContent)));
// exam date
await p.evaluate(() => { const i = document.querySelector("input[aria-label='Exam date']"); i.value = "2026-12-01"; i.parentElement.querySelector("button").click(); }); await wait(500);
chk("exam saved toast", await p.evaluate(() => /Exam date saved/.test(document.querySelector("#toast").textContent)));
// class settings (manager+)
chk("class settings panel for admin", await p.evaluate(() => [...document.querySelectorAll("summary")].some(s => s.textContent.includes("Class settings"))));
chk("instructors card for admin", /Instructors of this class/.test(await txt()));
// invite an instructor to the class: existing account
await p.evaluate(() => { const i = [...document.querySelectorAll("input[aria-label='Email address']")].pop(); i.value = "casey.ng@beta.ca"; });
await p.evaluate(() => [...document.querySelectorAll("button")].find(x => x.textContent.includes("Invite instructor")).click()); await wait(1200);
t = await txt(); chk("existing person added as instructor", /Casey Ng/.test(t));
// invite new person: shows copyable message
await p.evaluate(() => { const i = [...document.querySelectorAll("input[aria-label='Email address']")].pop(); i.value = "brand.new@alpha.ca"; });
await p.evaluate(() => [...document.querySelectorAll("button")].find(x => x.textContent.includes("Invite instructor")).click()); await wait(800);
t = await txt(); chk("new person gets an invite message", /Invite saved for brand.new@alpha.ca/.test(t) && /Copy message/.test(t));
await p.screenshot({ path: SHOTS + "/w_admin_invite.png", fullPage: true });

// people tab on the school
await p.evaluate(() => { location.hash = "#/work/school/sch-a/people"; }); await wait(1200);
t = await txt(); chk("people tab", /Instructors/.test(t) && /Rivera/.test(t) && /Pending invites/.test(t) && /new.instructor@alpha.ca/.test(t) && /School managers/.test(t) && /Invite manager/.test(t));
chk("no horizontal overflow (people)", (await overflow()) <= 0, "overflow=" + await overflow());
await p.screenshot({ path: SHOTS + "/w_admin_people.png", fullPage: true });
// settings tab
await p.evaluate(() => { location.hash = "#/work/school/sch-a/settings"; }); await wait(900);
t = await txt(); chk("school settings tab", /School details/.test(t) && /Courses this school may use/.test(t));
// activity tab
await p.evaluate(() => { location.hash = "#/work/school/sch-a/activity"; }); await wait(900);
t = await txt(); chk("school activity tab", /Recent changes/.test(t) && /create class/.test(t));
// new school
await p.evaluate(() => { location.hash = "#/work/schools"; }); await wait(900);
await p.evaluate(() => { [...document.querySelectorAll("summary")].find(s => s.textContent.includes("New school")).click(); }); await wait(200);
await p.evaluate(() => { document.querySelector("input[aria-label='School name']").value = "Gamma Institute"; });
await p.evaluate(() => [...document.querySelectorAll("button")].find(x => x.textContent.includes("Create school")).click()); await wait(1500);
t = await txt(); chk("new school created and opened", /Gamma Institute/.test(t), await p.evaluate(() => location.hash));
await p.screenshot({ path: SHOTS + "/w_admin_newschool.png" });
// admins page
await p.evaluate(() => { location.hash = "#/work/admins"; }); await wait(900);
t = await txt(); chk("admins page", /Platform admins/.test(t) && /you@alpha.ca/.test(t) && /Add admin/.test(t));
// last admin cannot be removed
await p.evaluate(() => document.querySelector("button[aria-label^='Remove admin']").click()); await wait(500);
chk("last admin guarded", await p.evaluate(() => /last admin/.test(document.querySelector("#toast").textContent)));
// copy a class for a new term: same course, instructors carried over, new code
await open("admin", "#/work/class/k-a1"); await wait(900);
await p.evaluate(() => [...document.querySelectorAll("summary")].find((s) => s.textContent.includes("Class settings")).click()); await wait(200);
await click("button", "Copy for a new term"); await wait(1500);
t = await txt(); chk("class copied for a new term", /Students \(0\)/.test(t) && /Join code/.test(t) && /Rivera/.test(t) && !/K7QM-2WXP/.test(t), await p.evaluate(() => location.hash));
// delete a school that leaves (the default school has no such button)
await open("admin", "#/work/school/sch-b/settings"); await wait(700);
t = await txt(); chk("delete-school card is there", /Delete this school/.test(t) && /Also delete the accounts of students/.test(t));
await p.evaluate(() => { document.querySelector("input[aria-label='Type the school name to confirm']").value = "wrong name"; });
await click("button", "Delete this school"); await wait(400);
chk("wrong confirmation is refused", await p.evaluate(() => /exactly/.test(document.querySelector("#toast").textContent)) && /Beta College/.test(await txt()));
await p.evaluate(() => { document.querySelector("input[aria-label='Type the school name to confirm']").value = "Beta College"; });
await click("button", "Delete this school"); await wait(1500);
t = await txt(); chk("school deleted and gone from the list", /Alpha University/.test(t) && !/Beta College/.test(t) && /ACEIT Direct/.test(t), await p.evaluate(() => location.hash));
await open("admin", "#/work/school/00000000-0000-0000-0000-000000000001/settings"); await wait(700);
chk("the default school cannot be deleted from the screen", !/Delete this school/.test(await txt()));
// people finder
await p.evaluate(() => { location.hash = "#/work/people"; }); await wait(700);
await p.type("input[type=search]", "noah"); await wait(600);
t = await txt(); chk("people finder", /Noah Singh/.test(t) && /Block/.test(t) && /Delete account/.test(t));
// content + settings + activity
await p.evaluate(() => { location.hash = "#/work/content"; }); await wait(800); t = await txt(); chk("content page", /Protect lecture content/.test(t));
await p.evaluate(() => { location.hash = "#/work/settings"; }); await wait(900); t = await txt(); chk("settings page", /Confirm email/.test(t) && /Allowed email domains/.test(t));
await p.screenshot({ path: SHOTS + "/w_admin_settings.png", fullPage: true });
await p.evaluate(() => { location.hash = "#/work/activity"; }); await wait(800); t = await txt(); chk("activity page", /Recent changes/.test(t) && /Error reports/.test(t));

/* ---------- school manager ---------- */
await open("manager", "#/work");
t = await txt();
chk("manager lands on own school", /Alpha University/.test(t) && !/Beta College/.test(t) && !/ACEIT Direct/.test(t) && /ASTR 207 Section 1/.test(t));
chk("manager has no platform tabs", !/Admins|Content/.test(await p.evaluate(() => document.querySelector(".ws-tabs")?.innerText || "")));
chk("manager has no Settings tab", !/Settings/.test(t));
chk("manager sees New class", /New class/.test(t));
chk("bottom nav says School", await p.evaluate(() => document.querySelector(".nav").innerText.includes("School")));
await p.screenshot({ path: SHOTS + "/w_mgr_school.png", fullPage: true });
await p.evaluate(() => { [...document.querySelectorAll("summary")].find(s => s.textContent.includes("New class")).click(); });
await p.evaluate(() => { document.querySelector("input[aria-label='Class name']").value = "ASTR 207 Spring"; document.querySelector("input[aria-label='Term']").value = "Spring 2027"; });
await p.evaluate(() => [...document.querySelectorAll("button")].find(x => x.textContent.includes("Create class")).click()); await wait(1500);
t = await txt(); chk("manager creates a class", /ASTR 207 Spring/.test(t) && /Join code/.test(t) && /Students \(0\)/.test(t) && /No students yet/.test(t), await p.evaluate(() => location.hash));
await p.screenshot({ path: SHOTS + "/w_mgr_newclass.png", fullPage: true });
// manager cannot open another school's page
await p.goto("http://localhost:8765/?demo&role=manager#/work/school/sch-b", { waitUntil: "networkidle0" }); await wait(900);
t = await txt(); chk("manager blocked from other school", !/Beta College/.test(t) || /don't have access/.test(t));
await p.goto("http://localhost:8765/?demo&role=manager#/work/schools", { waitUntil: "networkidle0" }); await wait(900);
t = await txt(); chk("manager cannot open platform pages", !/Platform admins|Beta College/.test(t));

/* ---------- instructor ---------- */
await open("instructor", "#/work");
t = await txt();
chk("instructor lands on My classes", /My classes/.test(t) && /ASTR 207 Section 1/.test(t) && /ERTH 209 Section 2/.test(t) && !/ASTR 207 Evening/.test(t) && !/Beta/.test(t));
chk("bottom nav says Teaching", await p.evaluate(() => document.querySelector(".nav").innerText.includes("Teaching")));
chk("no horizontal overflow (instructor)", (await overflow()) <= 0, "overflow=" + await overflow());
await p.screenshot({ path: SHOTS + "/w_inst_home.png", fullPage: true });
await click("button.card.rowcard", "ASTR 207 Section 1"); await wait(1500);
t = await txt();
chk("instructor class page", /Join code/.test(t) && /Students \(11\)/.test(t));
chk("instructor has no class settings", !(await p.evaluate(() => [...document.querySelectorAll("summary")].some(s => s.textContent.includes("Class settings")))));
chk("instructor has no instructor-management card", !/Instructors of this class/.test(t));
await p.evaluate(() => document.querySelector("details.person > summary").click()); await wait(600);
t = await txt(); chk("instructor can remove a student but not block/delete", /Remove from class/.test(t) && !/Delete account/.test(t) && !/\bBlock\b/.test(t));
await p.screenshot({ path: SHOTS + "/w_inst_class.png", fullPage: true });
// CSV content (call the download function path by intercepting Blob)
const csvInfo = await p.evaluate(() => new Promise((res) => { const orig = URL.createObjectURL; URL.createObjectURL = (b) => { b.arrayBuffer().then(buf => { const u = new Uint8Array(buf); res({ bom: u[0] === 0xEF && u[1] === 0xBB && u[2] === 0xBF, text: new TextDecoder().decode(u.slice(3)) }); }); return orig.call(URL, b); }; [...document.querySelectorAll("button")].find(x => x.textContent.includes("Download CSV")).click(); }));
chk("csv has BOM, header and 11 rows", csvInfo.bom && csvInfo.text.startsWith('"Name","Email"') && csvInfo.text.split("\r\n").length === 12, "lines=" + csvInfo.text.split("\r\n").length);
// another instructor's class is not reachable
await p.goto("http://localhost:8765/?demo&role=instructor#/work/class/k-b1", { waitUntil: "networkidle0" }); await wait(1000);
t = await txt(); chk("other school's class refused", /not found|don't have access/.test(t));

/* ---------- desktop width ---------- */
await p.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
await open("admin", "#/work/class/k-a1"); await wait(800);
await p.screenshot({ path: SHOTS + "/w_desktop_class.png", fullPage: true });
chk("no horizontal overflow (desktop)", (await overflow()) <= 0);

console.log(errs.length ? "ERRORS:\n" + errs.join("\n") : "no browser errors"); await b.close(); process.exit(bad || errs.length ? 1 : 0);
