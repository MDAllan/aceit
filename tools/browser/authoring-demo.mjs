// Instructors and school managers adding their own content, in the local preview with sample data (no database).
import { launch, SHOTS } from "./common.mjs";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
const b = await launch();
const p = await b.newPage(); const errs = [];
p.on("pageerror", (e) => errs.push("PAGEERR " + e.message)); p.on("console", (m) => { if (m.type() === "error") errs.push("CONSOLE " + m.text().slice(0, 200)); });
p.on("dialog", (d) => d.accept("Winter 2027"));
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true });
await p.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let bad = 0; const chk = (name, ok, extra = "") => { if (!ok) bad++; console.log((ok ? "PASS " : "FAIL ") + name + (extra ? "  " + extra : "")); };
const txt = () => p.evaluate(() => document.querySelector("#view").innerText);
const open = async (role, hash) => { await p.goto(`http://localhost:8765/?demo&role=${role}#/work${hash}`, { waitUntil: "networkidle0" }); await wait(900); };
const click = (sel, text) => p.evaluate((sel, text) => { const el = [...document.querySelectorAll(sel)].find((x) => !text || x.textContent.trim().includes(text)); if (el) el.click(); return !!el; }, sel, text);
const set = (sel, value) => p.evaluate((sel, value) => { const el = document.querySelector(sel); el.value = value; el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); }, sel, value);
const toastText = () => p.evaluate(() => document.querySelector("#toast").textContent);
const png = path.join(mkdtempSync(path.join(tmpdir(), "aceit-")), "tiny.png");
writeFileSync(png, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64"));
const L1 = "00000001-0000-4000-8000-000000000000"; // the sample lecture "Week 1 review"
const K = "#/work/class/k-a1/content";

/* ---------- an instructor (the sample school wants approval) ---------- */
await open("instructor", "/class/k-a1");
let t = await txt();
chk("the class page links to the class content", /Class content/.test(t) && /Manage class content/.test(t) && /published/.test(t));
await open("instructor", "/class/k-a1/content"); t = await txt();
chk("overview: counts, announcements, lectures, course lectures", /Class content/.test(t) && /Published/.test(t) && /Waiting for approval/.test(t) && /Midterm moved to Friday/.test(t) && /Week 1 review/.test(t) && /Add to the course's lectures/.test(t) && /Copy from another class/.test(t));
chk("the approval rule is explained to the instructor", /asks a manager to approve/.test(t));
chk("no horizontal overflow (overview)", await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));

// an announcement, saved as a draft
await click("button", "New announcement"); await wait(500);
await set("input[aria-label='Announcement title']", "Lab moved to room 12"); await set("textarea[aria-label='Message']", "Same time, new room.");
await click("button", "Save as draft"); await wait(1200); t = await txt();
chk("a new announcement is saved as a draft", /Lab moved to room 12/.test(t) && /Draft/.test(t), await p.evaluate(() => location.hash));
await click("button", "New announcement"); await wait(500);
await click("button", "Save as draft"); await wait(400);
chk("an announcement without a title is refused with a message", /Give the announcement a title/.test(await txt()));

// questions: the rules, then a good one
await open("instructor", `/class/k-a1/content/edit/question/new/${L1}`); await wait(300);
await set("textarea[aria-label='Question']", "Which is the largest planet?"); await set("input[aria-label='Option A']", "Mars");
await click("button", "Save as draft"); await wait(500); t = await txt();
chk("a question with one option is refused", /Use 2 to 5 answer options/.test(t));
await set("input[aria-label='Option B']", "Jupiter"); await set("input[aria-label='Option C']", "Venus");
await p.evaluate(() => document.querySelector("input[aria-label='Option B is the correct answer']").click());
await set("textarea[aria-label='Explanation']", "Jupiter is bigger than all the other planets together.");
await click("button", "Preview"); await wait(300); t = await txt();
chk("the preview shows how it looks", /Which is the largest planet\?/.test(t) && /Jupiter/.test(t) && /Explanation:/.test(t) && await p.evaluate(() => !!document.querySelector(".opt.ok")));
await click("button", "Save as draft"); await wait(1300); t = await txt();
chk("the question is saved and listed under the lecture as a draft", /Which is the largest planet\?/.test(t) && /Questions \(3\)/.test(t), await p.evaluate(() => location.hash));
// no option marked correct on an empty one
await open("instructor", `/class/k-a1/content/edit/question/new/${L1}`);
await set("textarea[aria-label='Question']", "Pick the right answer"); await set("input[aria-label='Option A']", "One"); await set("input[aria-label='Option B']", "Two");
await p.evaluate(() => document.querySelector("input[aria-label='Option C is the correct answer']").click());
await click("button", "Save as draft"); await wait(500);
chk("marking an empty option as correct is refused", /Mark which option is correct/.test(await txt()));
// edit an existing item
await open("instructor", "/class/k-a1/content/lecture/" + L1); await wait(500);
await p.evaluate(() => document.querySelector("button[aria-label^='Edit:']").click()); await wait(600);
chk("editing opens the item with its text", await p.evaluate(() => /Start here/.test(document.querySelector("input[aria-label='Note title']")?.value || "")));
await set("input[aria-label='Note title']", "Start here (updated)"); await click("button", "Save changes"); await wait(1200);
chk("the edit is saved", /Start here \(updated\)/.test(await txt()));

// a note with a picture
await open("instructor", `/class/k-a1/content/edit/note/new/${L1}`); await wait(300);
await set("input[aria-label='Note title']", "A diagram"); await set("textarea[aria-label='Points']", "First point\nSecond point");
const input = await p.$("input[type=file]"); await input.uploadFile(png); await wait(900);
chk("a chosen picture is shown, with a description box", await p.evaluate(() => !!document.querySelector("img[alt='The picture you chose']") && !!document.querySelector("input[aria-label='Picture description']") && !document.querySelector("input[aria-label='Picture description']").closest(".field").hidden));
await click("button", "Save as draft"); await wait(700);
chk("a picture without a description is refused", /needs a description/.test(await txt()));
await set("input[aria-label='Picture description']", "A tiny test picture");
await click("button", "Preview"); await wait(400);
chk("the preview shows the picture", await p.evaluate(() => !!document.querySelector("#view .card img")));
await click("button", "Save as draft"); await wait(1500); t = await txt();
chk("the note is saved with its picture", /A diagram/.test(t) && /picture/.test(t), await p.evaluate(() => location.hash));

// flashcards and a lecture of its own
await open("instructor", `/class/k-a1/content/edit/card/new/${L1}`);
await set("input[aria-label='Front of the card']", "Acceleration"); await set("textarea[aria-label='Back of the card']", "How quickly velocity changes");
await click("button", "Save as draft"); await wait(1200);
chk("a flashcard is added", /Acceleration/.test(await txt()));
await open("instructor", "/class/k-a1/content/edit/lecture/new"); await wait(300);
await set("input[aria-label='Lecture title']", "Week 2 rockets");
await p.evaluate(() => document.querySelectorAll("button[role=radio]")[3].click());
await click("button", "Save as draft"); await wait(1400); t = await txt();
chk("a new lecture opens on its own page, ready for content", /Week 2 rockets/.test(t) && /Notes \(0\)/.test(t) && /Add a flashcard/.test(t), await p.evaluate(() => location.hash));

// publishing: this school wants approval
await open("instructor", "/class/k-a1/content/lecture/" + L1); await wait(400);
chk("a draft can be submitted for approval", await click("button", "Submit for approval"));
await wait(900); t = await txt();
chk("it then waits for approval", /Waiting for approval/.test(t));

// pasting many questions and cards
await open("instructor", "/class/k-a1/content/bulk/questions/" + L1); await wait(300);
await set("textarea", "1. First pasted question?\na) Yes *\nb) No\nWhy: Because.\n\n2. Second pasted question?\na) Red\nb) Blue\nc) Green\nAnswer: c\n\n3. Broken one\na) only");
await click("button", "Check"); await wait(300); t = await txt();
chk("pasted questions are checked: two are ready, one needs fixing", /2 questions ready/.test(t) && /Question 3/.test(t) && /Some lines need fixing/.test(t));
await click("button", "Add 2 questions as drafts"); await wait(1800); t = await txt();
chk("the pasted questions are added as drafts", /First pasted question\?/.test(t) && /Second pasted question\?/.test(t) && /Questions \(5\)/.test(t), (t.match(/Questions \(\d+\)/) || [""])[0]);
await open("instructor", "/class/k-a1/content/bulk/cards/" + L1);
await set("textarea", "Force\tA push or a pull\nMass | Amount of matter\nbad line");
await click("button", "Check"); await wait(300); t = await txt();
chk("pasted flashcards are checked", /2 flashcards ready/.test(t) && /Line 3/.test(t));
await click("button", "Add 2 flashcards as drafts"); await wait(1500);
chk("the pasted flashcards are added", /Force/.test(await txt()) && /Flashcards \(5\)/.test(await txt()));

// order and delete
await open("instructor", "/class/k-a1/content/lecture/" + L1); await wait(400);
const firstBefore = await p.evaluate(() => document.querySelectorAll(".itemrow b")[2]?.textContent);
await p.evaluate(() => { const down = [...document.querySelectorAll("button[aria-label^='Move down']")][0]; down.click(); }); await wait(1100);
chk("an item moves down", await p.evaluate(() => document.querySelectorAll(".itemrow b").length > 0), firstBefore);
const countBefore = await p.evaluate(() => document.querySelectorAll(".itemrow").length);
await p.evaluate(() => [...document.querySelectorAll("button[aria-label^='Delete']")].pop().click()); await wait(1100);
chk("an item is deleted", await p.evaluate(() => document.querySelectorAll(".itemrow").length) === countBefore - 1);

// the study screens show drafts to the instructor, marked
await p.goto("http://localhost:8765/?demo&role=instructor#/s/astr207", { waitUntil: "networkidle0" }); await wait(1000); t = await txt();
chk("the instructor sees the class's own lecture in the list, marked", /Week 1 review/.test(t) && /Added by your instructor/.test(t) && /From your instructor/.test(t) && /Midterm moved to Friday/.test(t));
await p.goto("http://localhost:8765/?demo&role=instructor#/l/motion/quiz", { waitUntil: "networkidle0" }); await wait(900);
chk("an extra question is part of the course lecture's quiz", /31 questions/.test(await txt()), ((await txt()).match(/\d+ questions/) || [""])[0]);

// copy from another class
await open("instructor", "/class/k-a2/content"); await wait(900);
chk("an instructor of two classes can copy content between them", /Copy from another class/.test(await txt()) && await p.evaluate(() => !!document.querySelector("select[aria-label='Copy from this class']")));
await p.evaluate(() => { document.querySelector("select[aria-label='Copy from this class']").value = [...document.querySelector("select[aria-label='Copy from this class']").options].find((o) => /ASTR 207 Section 1/.test(o.textContent)).value; });
await click("button", "Copy here"); await wait(1500); t = await txt();
chk("the copy arrives as drafts", /Week 1 review/.test(t) && /Draft/.test(t));

/* ---------- a school manager reviews and approves ---------- */
await open("manager", "/school/sch-a/approvals"); await wait(800); t = await txt();
chk("the manager sees the approval switch and what is waiting", /Require approval before instructors publish/.test(t) && /Waiting for approval \(1\)/.test(t) && /what keeps planets in orbit/.test(t));
chk("the approval switch is on", await p.evaluate(() => document.querySelector("label.check input").checked));
await click("button", "Preview"); await wait(300);
chk("the manager can preview an item before deciding", /Gravity/.test(await txt()));
await click("button", "Approve"); await wait(1200); t = await txt();
chk("approving removes it from the queue", /Waiting for approval \(0\)/.test(t) && /Nothing is waiting/.test(t));
await p.evaluate(() => document.querySelector("label.check input").click()); await wait(900);
chk("the manager can switch approval off", /publish directly/.test(await toastText()));
await open("manager", "/class/k-a1/content/lecture/" + L1); await wait(900);
await p.evaluate(() => [...document.querySelectorAll("button")].find((x) => /^Publish/.test(x.textContent.trim()) && !/lecture/i.test(x.textContent))?.click()); await wait(1000);
chk("a manager's publish goes straight to students", /^Published/.test(await toastText()) || /Published/.test(await txt()), await toastText());
await p.screenshot({ path: SHOTS + "/authoring_manager.png", fullPage: true });

// copying a class for a new term brings its content along, as drafts
await open("manager", "/class/k-a1"); await wait(900);
await p.evaluate(() => [...document.querySelectorAll("summary")].find((x) => x.textContent.includes("Class settings")).click()); await wait(200);
await click("button", "Copy for a new term"); await wait(1800);
const newHash = await p.evaluate(() => location.hash);
chk("the class is copied for a new term", /#\/work\/class\/k-/.test(newHash) && newHash !== "#/work/class/k-a1" && /Winter 2027/.test(await txt()), newHash);
await click("button", "Manage class content"); await wait(1000); t = await txt();
chk("its content came along as drafts", /Week 1 review/.test(t) && /Draft/.test(t) && !/Midterm moved to Friday/.test(t));
await p.evaluate(() => [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "Open" && x.closest(".itemrow"))?.click()); await wait(900); t = await txt();
chk("...with its notes, cards and questions", /Notes \(2\)/.test(t) && /Flashcards \(/.test(t) && /Questions \(/.test(t));

/* ---------- a platform admin sees it on the class page ---------- */
await open("admin", "/class/k-a1"); await wait(900);
chk("the platform admin reaches the same screens", /Manage class content/.test(await txt()));

console.log(errs.length ? "ERRORS:\n" + [...new Set(errs)].join("\n") : "no browser errors"); await b.close(); process.exit(bad || errs.length ? 1 : 0);
