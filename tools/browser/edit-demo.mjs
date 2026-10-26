// Admin edit mode in the local preview (/?demo&role=admin, no database): the edit controls are absent for everyone else and when edit mode is off;
// with it on the admin edits notes, pictures, questions, flashcards and glossary terms where they are shown, deletes with a confirmation,
// sees the change history and undoes a change. Phone width (375 px), light and dark, with an axe accessibility scan of the edit screens.
// Needs: npm i --no-save puppeteer-core axe-core
import { launch, SHOTS } from "./common.mjs";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const PNG = path.join(mkdtempSync(path.join(tmpdir(), "aceit-")), "pic.png");
writeFileSync(PNG, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64"));

const b = await launch();
const errs = [];
let bad = 0, passed = 0;
const chk = (name, ok, extra = "") => { if (!ok) bad++; else passed++; console.log((ok ? "PASS " : "FAIL ") + name + (extra ? "  " + extra : "")); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const HOME = "http://localhost:8765/";

// a fresh browser profile each time (nothing leaks from one scenario to the next); prefs: what to put in localStorage first
async function newPage(url, prefs = {}, scheme = "light") {
  const ctx = await b.createBrowserContext(), p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push("PAGEERR " + e.message));
  p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errs.push("CONSOLE " + m.text().slice(0, 200)); });
  await p.setViewport({ width: 375, height: 800, deviceScaleFactor: 1, isMobile: true });
  await p.emulateMediaFeatures([{ name: "prefers-color-scheme", value: scheme }, { name: "prefers-reduced-motion", value: "reduce" }]); // reduced motion: nothing half-faded while it is scanned
  await p.evaluateOnNewDocument((prefs) => { try { for (const [k, v] of Object.entries(prefs)) localStorage.setItem("erth209:" + k, v); } catch {} }, prefs);
  await p.goto(HOME + url, { waitUntil: "networkidle0" }); await wait(700);
  p.ctx = ctx;
  return p;
}
const txt = (p, sel = "body") => p.evaluate((sel) => document.querySelector(sel)?.innerText || "", sel);
const count = (p, sel) => p.evaluate((sel) => document.querySelectorAll(sel).length, sel);
const overflow = (p) => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const hash = async (p, h) => { await p.evaluate((h) => { location.hash = h; }, h); await wait(900); };
// clicks the first element matching sel (whose text includes `text`), as a real tap would (scrolled into view first)
async function tap(p, sel, text) {
  const ok = await p.evaluate((sel, text) => { const el = [...document.querySelectorAll(sel)].find((x) => !text || x.textContent.includes(text)); if (!el) return false; el.scrollIntoView({ block: "center" }); el.setAttribute("data-tap", "1"); return true; }, sel, text);
  if (!ok) return false;
  await (await p.$("[data-tap='1']")).click(); await p.evaluate(() => document.querySelector("[data-tap='1']")?.removeAttribute("data-tap")); await wait(250); return true;
}
// puts text into a field the way typing does (the page listens to "input")
const fill = (p, sel, value, nth = 0) => p.evaluate((sel, value, nth) => { const el = document.querySelectorAll(sel)[nth]; el.focus(); el.value = value; el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); }, sel, value, nth);
const toast = (p) => p.evaluate(() => document.querySelector("#toast").textContent);
const sheet = (p) => p.evaluate(() => document.querySelector(".mdl-card")?.innerText || "");
async function scan(p, name) {
  await p.evaluate(() => window.scrollTo(0, 0)); await wait(150); // the sticky bars must not sit on top of the page content being scanned
  await p.evaluate(axeSource);
  const res = await p.evaluate(() => axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] }, resultTypes: ["violations"] }).then((r) => r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, sample: v.nodes.slice(0, 3).map((n) => n.target.join(" ") + " :: " + (n.failureSummary || "").split("\n").slice(1, 3).join(" ").slice(0, 180)) }))));
  const serious = res.filter((v) => v.impact === "serious" || v.impact === "critical");
  chk("axe: " + name, !serious.length, res.length ? `${res.length} issue types: ` + res.map((v) => `${v.id}[${v.impact}] x${v.nodes}`).join(", ") : "");
  for (const v of serious) console.log("   " + v.id + ": " + v.help + "\n     " + v.sample.join("\n     "));
  if (serious.length) await p.screenshot({ path: SHOTS + `/edit_axe_${name.replace(/\W+/g, "_")}.png` });
}
const demoBody = (p, lid) => p.evaluate(async (lid) => { const D = await import("/js/demo.js"); return D.lectureBody(lid); }, lid); // what the pretend database holds

const EDIT_UI = ".ed-text,.ed-bar,.ed-panel,.ed-cardtools,.ed-iconbtn,.ed-glossbar,.ed-addpic,.ed-pagetools,.ed-inline";
const NOTES = "#/l/deformation/notes", QUIZ = "#/l/deformation/quiz", CARDS = "#/l/deformation/cards";

/* ---------- 1. nobody else sees anything of it ---------- */
{
  const ONE = { edit: "1", cls: "erth209" };
  for (const [who, url, prefs] of [["a student", "?demo", ONE], ["an instructor", "?demo&role=instructor", ONE], ["the admin with edit mode off", "?demo&role=admin", { cls: "erth209" }], ["the admin viewing as a student", "?demo&role=admin", { ...ONE, student: "1" }]]) {
    const p = await newPage(url + NOTES, prefs);
    for (const [name, h] of [["notes", NOTES], ["cards", CARDS], ["quiz", QUIZ], ["glossary", "#/glossary"], ["progress", "#/progress"]]) {
      await hash(p, h);
      chk(`${who}: no edit controls on ${name}`, (await count(p, EDIT_UI)) === 0, "found " + (await count(p, EDIT_UI)));
    }
    await hash(p, NOTES);
    chk(`${who}: no editable pictures or edit pill`, (await count(p, ".figbtn[aria-label='Edit picture']")) === 0 && (await count(p, ".editpill")) === (who.startsWith("the admin with") ? 1 : 0));
    chk(`${who}: the edit stylesheet is not even loaded`, (await count(p, "link[href$='edit.css']")) === 0);
    chk(`${who}: pictures still open the viewer`, (await count(p, ".figbtn[aria-label='Enlarge picture']")) > 0);
    await p.ctx.close();
  }
}

/* ---------- 2. the admin, edit mode on ---------- */
const p = await newPage("?demo&role=admin" + NOTES, { edit: "1", cls: "erth209" });
await wait(300);
chk("the edit pill shows as on", (await count(p, ".editpill.on")) === 1);
chk("toolbar says Editing mode on, with Add point, Add picture, History and Done", await p.evaluate(() => { const t = document.querySelector(".ed-bar")?.innerText || ""; return /Editing mode on/.test(t) && /Add point/.test(t) && /Add picture/.test(t) && /History/.test(t) && /Done/.test(t); }));
chk("edit stylesheet is loaded now", (await count(p, "link[href$='edit.css']")) === 1 && await p.evaluate(() => getComputedStyle(document.querySelector(".ed-bar")).borderLeftWidth === "6px"));
chk("every editable text is a button with a name", await p.evaluate(() => { const els = [...document.querySelectorAll(".ed-text")]; return els.length >= 8 && els.every((e) => e.getAttribute("role") === "button" && e.tabIndex === 0 && /^Edit: /.test(e.getAttribute("aria-label"))); }));
chk("editable text and edit buttons are at least 44 px tall", await p.evaluate(() => [...document.querySelectorAll(".ed-text,.ed-iconbtn,.ed-btn")].filter((e) => e.offsetParent && e.getBoundingClientRect().height < 43.5).length === 0), await p.evaluate(() => [...document.querySelectorAll(".ed-text,.ed-iconbtn,.ed-btn")].filter((e) => e.offsetParent && e.getBoundingClientRect().height < 43.5).map((e) => e.className + ":" + Math.round(e.getBoundingClientRect().height)).join(" ")));
chk("no horizontal overflow (notes)", (await overflow(p)) <= 0, "overflow=" + await overflow(p));
await p.screenshot({ path: SHOTS + "/edit_notes.png" });
await scan(p, "notes in edit mode (light)");

// -- edit a point
const B1 = ".ed-step li .ed-text";
const original = await txt(p, B1);
await tap(p, B1);
chk("tapping a point opens an editor with Save and Cancel, focus inside it", await p.evaluate(() => { const i = document.querySelector(".ed-inline"); return !!i && document.activeElement === i.querySelector("textarea") && /Save/.test(i.innerText) && /Cancel/.test(i.innerText) && /Editing: /.test(i.innerText); }));
chk("the editor starts with the current text (the **marks** included)", (await p.evaluate(() => document.querySelector(".ed-inline textarea").value)).includes("**undeformed**"));
chk("the text being edited is hidden while the editor is open", await p.evaluate(() => document.querySelector(".ed-step li .ed-text").hidden));
await scan(p, "inline editor open (light)");
chk("no horizontal overflow (inline editor)", (await overflow(p)) <= 0);
await fill(p, ".ed-inline textarea", "   ");
await tap(p, ".ed-inline button", "Save");
chk("an empty point is refused with a message under the field", await p.evaluate(() => /cannot be empty/.test(document.querySelector(".ed-inline .ed-msg").textContent) && document.querySelector(".ed-inline textarea").getAttribute("aria-invalid") === "true"));
await fill(p, ".ed-inline textarea", "Wrong " + "x".repeat(1600));
await tap(p, ".ed-inline button", "Save");
chk("a point that is too long is refused with the limit", await p.evaluate(() => /1500/.test(document.querySelector(".ed-inline .ed-msg").textContent)));
await p.keyboard.press("Escape"); await wait(200);
chk("Escape cancels: the editor closes and the text is unchanged", (await count(p, ".ed-inline")) === 0 && (await txt(p, B1)) === original);
await p.focus(B1); await p.keyboard.press("Enter"); await wait(200);
chk("Enter on a focused text opens the editor (keyboard)", (await count(p, ".ed-inline")) === 1);
await tap(p, ".ed-inline button", "Cancel");
chk("Cancel closes it and puts focus back on the text", (await count(p, ".ed-inline")) === 0 && await p.evaluate(() => document.activeElement?.classList.contains("ed-text")));
await tap(p, B1);
await fill(p, ".ed-inline textarea", "A **new** point about *edit mode*");
await tap(p, ".ed-inline button", "Save"); await wait(300);
chk("saving shows the new text in place, with the bold and italic marks drawn", await p.evaluate(() => { const e = document.querySelector(".ed-step li .ed-text"); return e.textContent === "A new point about edit mode" && !!e.querySelector("span.term") && !!e.querySelector("em"); }));
chk("a toast says it was saved", /Saved/.test(await toast(p)), await toast(p));
chk("the pretend database holds the new text", (await demoBody(p, "deformation")).sections[0].steps[0].bullets[0] === "A **new** point about *edit mode*");
chk("text is never inserted as HTML", await (async () => {
  await tap(p, B1); await fill(p, ".ed-inline textarea", "<img src=x onerror=alert(1)> and <b>bold</b>"); await tap(p, ".ed-inline button", "Save"); await wait(300);
  return (await count(p, ".ed-step li .ed-text img, .ed-step li .ed-text b")) === 0 && (await txt(p, B1)).includes("<img src=x");
})());

// -- add a point, move it, delete it
const before = await count(p, ".ed-step li");
await tap(p, ".ed-step .ed-add", "Add a point"); await wait(200);
chk("Add a point opens a sheet with an empty field", /Add a point/.test(await sheet(p)) && (await p.evaluate(() => document.querySelector(".mdl-card textarea").value)) === "");
await tap(p, ".mdl-card button", "Add point");
chk("an empty new point is refused", /cannot be empty/.test(await sheet(p)));
await fill(p, ".mdl-card textarea", "A point added by the test");
await tap(p, ".mdl-card button", "Add point"); await wait(500);
chk("the new point is in the step", (await count(p, ".ed-step li")) === before + 1 && (await txt(p, ".ed-step")).includes("A point added by the test"));
const last = before; // index of the new point
await p.evaluate((i) => document.querySelectorAll(".ed-step li")[i].querySelector(".ed-iconbtn[aria-label^='Move up']").click(), last); await wait(500);
chk("Move up puts the new point one place higher", (await p.evaluate(() => [...document.querySelectorAll(".ed-step li .ed-text")].map((e) => e.textContent.includes("A point added by the test")))).indexOf(true) === last - 1);
chk("the first point has no Move up and the last no Move down", await p.evaluate(() => { const li = [...document.querySelectorAll(".ed-step li")]; return li[0].querySelector("[aria-label^='Move up']").disabled && li[li.length - 1].querySelector("[aria-label^='Move down']").disabled; }));
await p.evaluate((i) => document.querySelectorAll(".ed-step li")[i].querySelector(".ed-iconbtn[aria-label^='Delete']").click(), last - 1); await wait(400);
chk("Delete asks first: a dialog with Cancel focused", await p.evaluate(() => { const d = document.querySelector(".mdl-card[role=alertdialog]"); return !!d && document.activeElement?.textContent === "Cancel" && /Delete this point/.test(d.innerText) && /Change history/.test(d.innerText); }));
await scan(p, "delete confirmation (light)");
await tap(p, ".mdl-card button", "Cancel");
chk("Cancel keeps the point", (await count(p, ".ed-step li")) === before + 1 && (await count(p, ".mdl")) === 0);
await p.evaluate((i) => document.querySelectorAll(".ed-step li")[i].querySelector(".ed-iconbtn[aria-label^='Delete']").click(), last - 1); await wait(400);
await p.keyboard.press("Escape"); await wait(200);
chk("Escape closes the dialog without deleting", (await count(p, ".mdl")) === 0 && (await count(p, ".ed-step li")) === before + 1);
await p.evaluate((i) => document.querySelectorAll(".ed-step li")[i].querySelector(".ed-iconbtn[aria-label^='Delete']").click(), last - 1); await wait(400);
await tap(p, ".mdl-card button", "Delete"); await wait(500);
chk("Delete removes the point", (await count(p, ".ed-step li")) === before && !(await txt(p, ".ed-step")).includes("A point added by the test"));

// -- the topic title, the introduction and a box
await tap(p, ".page h2 .ed-text"); await fill(p, ".ed-inline textarea", "Deformation basics (edited)"); await tap(p, ".ed-inline button", "Save"); await wait(500);
chk("the topic title can be edited (and the topic list follows)", (await txt(p, ".page h2")).includes("Deformation basics (edited)") && (await p.evaluate(() => document.querySelector("select[aria-label='Jump to topic']").options[0].textContent)).includes("(edited)"));
await tap(p, ".ed-intro .ed-text"); await fill(p, ".ed-inline textarea", "A new introduction."); await tap(p, ".ed-inline button", "Save"); await wait(400);
chk("the introduction can be edited", (await txt(p, ".ed-intro")).includes("A new introduction."));
chk("boxes are open in edit mode and their texts are editable", await p.evaluate(() => { const a = document.querySelectorAll(".acc.open .ed-text"); return a.length === 0 ? "none" : true; }) === true || (await count(p, ".acc")) === 0);

// -- pictures: replace, change the description, remove, add
const picBefore = await p.evaluate(() => document.querySelector(".fig img")?.getAttribute("alt"));
chk("the picture opens the editor instead of the viewer, with a pencil", await p.evaluate(() => { const f = document.querySelector(".figbtn"); return f.getAttribute("aria-label") === "Edit picture" && /Edit/.test(f.innerText); }));
await tap(p, ".figbtn"); await wait(300);
chk("tapping a picture opens a dialog with the current picture, a file chooser and its description", await p.evaluate(() => { const d = document.querySelector(".mdl-card"); return /Picture/.test(d.innerText) && !!d.querySelector("input[type=file]") && d.querySelector(".ed-prev img") && /Remove picture/.test(d.innerText) && document.querySelector(".mdl-card input[type=text], .mdl-card input:not([type])").value.length > 10; }));
chk("the dialog accepts images only", await p.evaluate(() => /image\/png/.test(document.querySelector(".mdl-card input[type=file]").accept)));
await scan(p, "picture dialog (light)");
await (await p.$(".mdl-card input[type=file]")).uploadFile(PNG); await wait(900);
chk("a chosen picture is previewed before saving", await p.evaluate(() => !!document.querySelector(".mdl-card .ed-prev img[alt='The picture you chose']")));
await fill(p, ".mdl-card input:not([type=file]):not([type=radio])", "");
await tap(p, ".mdl-card button", "Save picture");
chk("a picture needs a description", /cannot be empty/.test(await sheet(p)));
await fill(p, ".mdl-card input:not([type=file]):not([type=radio])", "A tiny test picture");
await tap(p, ".mdl-card button", "Save picture"); await wait(900);
chk("the new picture replaces the old one (a blob address in the preview, with its new description)", await p.evaluate(() => { const i = document.querySelector(".fig img"); return !!i && /^blob:/.test(i.src) && i.alt === "A tiny test picture"; }), await p.evaluate(() => document.querySelector(".fig img")?.src.slice(0, 40)));
chk("the pretend database holds the picture as { path, bucket: course, alt } in the course folder", await (async () => { const im = (await demoBody(p, "deformation")).sections[0].steps[0].img; return /^erth209\/[a-f0-9]{24}\.webp$/.test(im.path) && im.bucket === "course" && im.alt === "A tiny test picture" && !("src" in im); })());
await tap(p, ".figbtn"); await wait(300);
await fill(p, ".mdl-card input:not([type=file]):not([type=radio])", "A changed description");
await tap(p, ".mdl-card button", "Save picture"); await wait(500);
chk("only the description can be changed without a new file", (await p.evaluate(() => document.querySelector(".fig img").alt)) === "A changed description");
await tap(p, ".figbtn"); await tap(p, ".mdl-card button", "Remove picture"); await wait(300);
chk("Remove asks first (Cancel focused)", await p.evaluate(() => document.querySelector(".mdl-card[role=alertdialog]") && document.activeElement?.textContent === "Cancel"));
await tap(p, ".mdl-card button", "Delete"); await wait(600);
chk("the picture is removed and the step offers Add a picture", (await count(p, ".fig")) === 0 && (await count(p, ".ed-addpic")) === 1 && (await txt(p, ".ed-addpic")).includes("Add a picture"));
await scan(p, "a step without a picture (light)");
await tap(p, ".ed-addpic button");
await (await p.$(".mdl-card input[type=file]")).uploadFile(PNG); await wait(900);
await fill(p, ".mdl-card input:not([type=file]):not([type=radio])", "Picture added again");
await tap(p, ".mdl-card button", "Save picture"); await wait(900);
chk("a picture can be added to a step that has none", await p.evaluate(() => { const i = document.querySelector(".fig img"); return !!i && i.alt === "Picture added again"; }));
chk("pictures that are not images are refused", await (async () => {
  const TXT = path.join(path.dirname(PNG), "notes.txt"); writeFileSync(TXT, "hello");
  await tap(p, ".figbtn"); await (await p.$(".mdl-card input[type=file]")).uploadFile(TXT); await wait(500);
  const msg = await sheet(p); await tap(p, ".mdl-card button", "Cancel"); return /Choose a JPG, PNG, WebP or GIF/.test(msg) || /could not be read/.test(msg);
})());

// -- add a picture step and a topic, delete a topic
const topicsBefore = await p.evaluate(() => document.querySelector("select[aria-label='Jump to topic']").options.length);
const stepsBefore = await p.evaluate(() => document.querySelectorAll(".stepper .dots i").length);
await tap(p, ".ed-bar button", "Add picture"); await wait(300);
chk("Add picture (toolbar) opens a form: title, picture, first point", /Add a picture step/.test(await sheet(p)) && /Step title/.test(await sheet(p)));
await tap(p, ".mdl-card button", "Add step");
chk("it needs a title and a picture", /cannot be empty/.test(await sheet(p)) && /Choose a picture/.test(await sheet(p)));
await fill(p, ".mdl-card input[type=text], .mdl-card input:not([type])", "A step made by the test");
await (await p.$(".mdl-card input[type=file]")).uploadFile(PNG); await wait(900);
await p.evaluate(() => { const alt = [...document.querySelectorAll(".mdl-card input")].filter((i) => i.type !== "file")[1]; alt.value = "Step picture"; alt.dispatchEvent(new Event("input", { bubbles: true })); });
await tap(p, ".mdl-card button", "Add step"); await wait(900);
chk("a picture step was added to the topic", (await p.evaluate(() => document.querySelectorAll(".stepper .dots i").length)) === stepsBefore + 1);
await tap(p, ".ed-pagetools button", "Add a topic"); await fill(p, ".mdl-card input", "A topic made by the test"); await tap(p, ".mdl-card button", "Add topic"); await wait(900);
chk("a topic was added after this one and is open", (await txt(p, ".page h2")).includes("A topic made by the test") && (await p.evaluate(() => document.querySelector("select[aria-label='Jump to topic']").options.length)) === topicsBefore + 1);
await tap(p, ".ed-pagetools button", "Delete this topic"); await wait(300);
chk("deleting a topic asks first", await p.evaluate(() => !!document.querySelector(".mdl-card[role=alertdialog]") && /Delete this topic/.test(document.querySelector(".mdl-card").innerText)));
await tap(p, ".mdl-card button", "Delete"); await wait(900);
chk("the topic is deleted", (await p.evaluate(() => document.querySelector("select[aria-label='Jump to topic']").options.length)) === topicsBefore && !(await txt(p, "#view")).includes("A topic made by the test"));

/* ---------- questions ---------- */
await hash(p, QUIZ);
const qBefore = await count(p, ".ed-list > li");
chk("Quiz tab: the Edit questions list is above the quiz menu, every question has Edit and Delete", qBefore === 30 && await p.evaluate(() => { const items = [...document.querySelectorAll(".ed-list > li")]; return items.every((li) => li.querySelector("[aria-label^='Edit question']") && li.querySelector("[aria-label^='Delete question']")) && !!document.querySelector(".ed-panel").compareDocumentPosition(document.querySelector("button.btn")) ; }));
chk("the list says how many", /Edit questions \(30\)/.test(await txt(p, ".ed-panel summary")));
chk("no horizontal overflow (quiz list)", (await overflow(p)) <= 0, "overflow=" + await overflow(p));
await scan(p, "quiz tab with the question list (light)");
await tap(p, ".ed-bar button", "Add question"); await wait(300);
chk("Add question opens a sheet with 4 empty options, the first marked correct", await p.evaluate(() => { const r = [...document.querySelectorAll(".mdl-card input[type=radio]")]; return r.length === 4 && r[0].checked && document.querySelectorAll(".mdl-card input[type=text]").length === 4; }));
chk("every field has a label and every icon button a name", await p.evaluate(() => [...document.querySelectorAll(".mdl-card input,.mdl-card textarea,.mdl-card select")].every((e) => e.type === "hidden" || e.getAttribute("aria-label") || (e.id && document.querySelector(`label[for='${e.id}']`)))));
await scan(p, "add question sheet (light)");
await tap(p, ".mdl-card button", "Add question");
chk("saving an empty question shows messages under the fields, not alerts", await p.evaluate(() => { const m = [...document.querySelectorAll(".mdl-card .ed-msg")].map((x) => x.textContent).filter(Boolean).join(" | "); return /cannot be empty/.test(m) && /at least 2 answer options/.test(m); }), await p.evaluate(() => [...document.querySelectorAll(".mdl-card .ed-msg")].map((x) => x.textContent).filter(Boolean).join(" | ")));
chk("the first field with a problem has the focus and aria-invalid", await p.evaluate(() => document.activeElement?.getAttribute("aria-invalid") === "true"));
await scan(p, "add question sheet with messages (light)");
await fill(p, ".mdl-card textarea", "Which kind of stress squeezes rock together from both sides?", 0);
await fill(p, ".mdl-card input[type=text]", "Compression", 0); await fill(p, ".mdl-card input[type=text]", "Tension", 1); await fill(p, ".mdl-card input[type=text]", "Compression", 2);
await tap(p, ".mdl-card button", "Add question");
chk("two options that are the same are refused", await p.evaluate(() => /same as option A/.test(document.querySelector(".mdl-card").innerText)));
await fill(p, ".mdl-card input[type=text]", "Shear", 2);
await p.evaluate(() => document.querySelectorAll(".mdl-card input[type=radio]")[1].click());
await fill(p, ".mdl-card textarea", "Tension pulls rock apart; compression squeezes it.", 1);
await p.evaluate(() => { const s = document.querySelector(".mdl-card select"); s.value = s.options[2].value; s.dispatchEvent(new Event("change", { bubbles: true })); });
await tap(p, ".mdl-card button", "Add question"); await wait(900);
chk("the new question is in the list", (await count(p, ".ed-list > li")) === 31 && /Edit questions \(31\)/.test(await txt(p, ".ed-panel summary")) && (await txt(p, ".ed-list > li:last-child")).includes("squeezes rock together"));
chk("the blank fourth option was dropped; the answer index followed the chosen option", await (async () => { const q = (await demoBody(p, "deformation")).quiz.at(-1); return q.options.length === 3 && q.answer === 1 && /^def-a[0-9a-z]+$/.test(q.id) && !!q.topic && q.why.startsWith("Tension"); })());
chk("the question shows its topic in the list", await p.evaluate(() => !!document.querySelector(".ed-list > li:last-child .ed-topic")));
const newId = (await demoBody(p, "deformation")).quiz.at(-1).id;
await tap(p, ".ed-list > li:last-child [aria-label^='Edit question']"); await wait(300);
chk("Edit opens the same form filled in", await p.evaluate(() => document.querySelector(".mdl-card textarea").value.startsWith("Which kind of stress") && document.querySelectorAll(".mdl-card input[type=radio]")[1].checked));
await fill(p, ".mdl-card textarea", "Which stress squeezes rock together?", 0);
await p.evaluate(() => { const s = document.querySelector(".mdl-card select"); s.value = ""; s.dispatchEvent(new Event("change", { bubbles: true })); });
await tap(p, ".mdl-card button", "Save question"); await wait(900);
chk("an edited question keeps its id and changes its text and topic", await (async () => { const q = (await demoBody(p, "deformation")).quiz.at(-1); return q.id === newId && q.q === "Which stress squeezes rock together?" && !("topic" in q); })());
await tap(p, ".ed-list > li:last-child [aria-label^='Delete question']"); await wait(300);
chk("deleting a question asks first, Cancel is focused", await p.evaluate(() => document.querySelector(".mdl-card[role=alertdialog]") && document.activeElement?.textContent === "Cancel" && /Delete this question/.test(document.querySelector(".mdl-card").innerText)));
await tap(p, ".mdl-card button", "Cancel");
chk("Cancel keeps the question", (await count(p, ".ed-list > li")) === 31);
await tap(p, ".ed-list > li:last-child [aria-label^='Delete question']"); await tap(p, ".mdl-card button", "Delete"); await wait(900);
chk("the question is deleted", (await count(p, ".ed-list > li")) === 30 && !(await demoBody(p, "deformation")).quiz.some((q) => q.id === newId));
chk("the quiz itself still runs", await (async () => { await tap(p, "button.btn", "Start quiz"); await wait(300); const ok = (await count(p, ".opt")) >= 4; await hash(p, QUIZ); return ok; })());

/* ---------- flashcards ---------- */
await hash(p, CARDS);
const knownTxt = await txt(p, ".src");
chk("Cards tab: Edit card and Delete card under the card, and Add flashcard on the toolbar", (await count(p, ".ed-cardtools button")) === 2 && (await txt(p, ".ed-bar")).includes("Add flashcard"));
chk("no horizontal overflow (cards)", (await overflow(p)) <= 0);
await scan(p, "cards tab (light)");
await tap(p, ".ed-bar button", "Add flashcard"); await wait(300);
await tap(p, ".mdl-card button", "Add flashcard");
chk("a flashcard needs a front and a back (messages under the fields)", await p.evaluate(() => /front of the card cannot be empty/.test(document.querySelector(".mdl-card").innerText) && /back of the card cannot be empty/.test(document.querySelector(".mdl-card").innerText)));
await fill(p, ".mdl-card textarea", "Zzyzx", 0);
chk("the form says a term also shows in the glossary", /also shows in the glossary/.test(await sheet(p)));
await fill(p, ".mdl-card textarea", "What is Zzyzx?", 0);
chk("and says when a front is not a glossary term", /stays a flashcard only/.test(await sheet(p)));
await fill(p, ".mdl-card textarea", "A place in the Mojave desert.", 1);
await tap(p, ".mdl-card button", "Add flashcard"); await wait(900);
chk("the new flashcard is added (one more card in the deck)", (await txt(p, ".src")).includes("of 41 known") && (knownTxt.includes("of 40 known")), knownTxt + " -> " + (await txt(p, ".src")));
chk("a question-shaped front is kept out of the glossary (gloss:false)", (await demoBody(p, "deformation")).cards.at(-1).gloss === false);
chk("its id is new and its short version was made", await (async () => { const c = (await demoBody(p, "deformation")).cards.at(-1); return /^def-a[0-9a-z]+$/.test(c.id) && c.short === "A place in the Mojave desert."; })());
await tap(p, "button[aria-label='Next card']");
chk("edit the second card (Stress): its front becomes a question, so it leaves the glossary and says so", await (async () => {
  await tap(p, ".ed-cardtools button", "Edit card"); await wait(300);
  const first = await p.evaluate(() => document.querySelector(".mdl-card textarea").value);
  await fill(p, ".mdl-card textarea", "What is stress?", 0); await tap(p, ".mdl-card button", "Save flashcard"); await wait(700);
  const note = await p.evaluate(() => document.querySelector(".mdl-card")?.innerText || "");
  const card = (await demoBody(p, "deformation")).cards[1];
  if (await count(p, ".mdl")) await tap(p, ".mdl-card button", "OK");
  return first === "Stress" && /Saved as a flashcard only/.test(note) && /no longer a glossary term/.test(note) && card.gloss === false && card.front === "What is stress?";
})());
await tap(p, ".ed-cardtools button", "Delete card"); await wait(300);
chk("deleting a flashcard asks first", await p.evaluate(() => !!document.querySelector(".mdl-card[role=alertdialog]") && document.activeElement?.textContent === "Cancel"));
await tap(p, ".mdl-card button", "Delete"); await wait(900);
chk("the flashcard is deleted", (await txt(p, ".src")).includes("of 40 known") && (await demoBody(p, "deformation")).cards.length === 40);

/* ---------- the glossary ---------- */
await hash(p, "#/glossary");
const termsBefore = await count(p, ".acc.gl");
chk("Glossary: an Add term button", (await count(p, ".ed-glossbar button")) === 1 && /Add term/.test(await txt(p, ".ed-glossbar")));
await tap(p, ".ed-glossbar button"); await wait(300);
chk("the Add term form has Save switched off while empty", await p.evaluate(() => [...document.querySelectorAll(".mdl-card button")].find((x) => /Add term/.test(x.textContent)).disabled));
await fill(p, ".mdl-card input", "What is osmosis?"); await wait(100);
chk("What is osmosis? is rejected: the reason shows next to the field and Save stays off", await p.evaluate(() => /question/i.test(document.querySelector(".ed-field .ed-msg").textContent) && [...document.querySelectorAll(".mdl-card button")].find((x) => /Add term/.test(x.textContent)).disabled), await p.evaluate(() => document.querySelector(".ed-field .ed-msg").textContent));
await fill(p, ".mdl-card textarea", "How water moves across a membrane.");
chk("even with a meaning, a rejected term cannot be saved", await p.evaluate(() => [...document.querySelectorAll(".mdl-card button")].find((x) => /Add term/.test(x.textContent)).disabled));
await scan(p, "add term form, term rejected (light)");
await fill(p, ".mdl-card input", "Osmosis"); await wait(100);
chk("Osmosis is accepted: the message goes and Save is on", await p.evaluate(() => document.querySelector(".ed-field .ed-msg").textContent === "" && ![...document.querySelectorAll(".mdl-card button")].find((x) => /Add term/.test(x.textContent)).disabled));
chk("a term needs a meaning", await (async () => { await fill(p, ".mdl-card textarea", ""); const dis = await p.evaluate(() => [...document.querySelectorAll(".mdl-card button")].find((x) => /Add term/.test(x.textContent)).disabled); await fill(p, ".mdl-card textarea", "How water moves across a membrane."); return dis; })());
chk("a lecture can be chosen for where the new card goes", await p.evaluate(() => { const s = document.querySelector(".mdl-card select"); return !!s && s.options.length === 10; }));
await tap(p, ".mdl-card button", "Add term"); await wait(900);
chk("Osmosis is in the glossary", (await p.evaluate(() => [...document.querySelectorAll(".acc.gl .term-t")].map((e) => e.textContent))).includes("Osmosis") && (await count(p, ".acc.gl")) === termsBefore + 1);
chk("the term is a card with gloss:true in the chosen lecture", await (async () => { const l = await demoBody(p, "interior"); const c = l.cards.find((x) => x.front === "Osmosis"); return !!c && c.gloss === true && c.back === "How water moves across a membrane." && !!c.short; })());
chk("the same term cannot be added twice", await (async () => { await tap(p, ".ed-glossbar button"); await fill(p, ".mdl-card input", "osmosis"); await fill(p, ".mdl-card textarea", "x"); await wait(100); const m = await p.evaluate(() => document.querySelector(".ed-field .ed-msg").textContent); await tap(p, ".mdl-card button", "Cancel"); return /already in the glossary/.test(m); })());
await tap(p, ".acc.gl > button", "Osmosis"); await wait(200);
chk("an open term shows Edit term and Delete term", await p.evaluate(() => { const o = [...document.querySelectorAll(".acc.gl")].find((a) => /Osmosis/.test(a.querySelector(".term-t").textContent)); return !!o.querySelector("[aria-label='Edit term: Osmosis']") && !!o.querySelector("[aria-label='Delete term: Osmosis']"); }));
await scan(p, "glossary with an open term in edit mode (light)");
await p.evaluate(() => document.querySelector("[aria-label='Edit term: Osmosis']").click()); await wait(300);
await fill(p, ".mdl-card textarea", "Water moving through a membrane from low to high solute concentration.");
await tap(p, ".mdl-card button", "Save term"); await wait(900);
chk("a term can be edited", (await demoBody(p, "interior")).cards.find((x) => x.front === "Osmosis").back.startsWith("Water moving through"));
await tap(p, ".acc.gl > button", "Osmosis"); await p.evaluate(() => document.querySelector("[aria-label='Delete term: Osmosis']").click()); await wait(300);
chk("deleting a term offers Remove from glossary only, with Cancel focused", await p.evaluate(() => { const d = document.querySelector(".mdl-card[role=alertdialog]"); return !!d && /Remove from glossary only/.test(d.innerText) && document.activeElement?.textContent === "Cancel"; }));
await scan(p, "delete term dialog (light)");
await tap(p, ".mdl-card button", "Remove from glossary only"); await wait(900);
chk("Remove from glossary only hides the term but keeps the card (gloss:false)", !(await p.evaluate(() => [...document.querySelectorAll(".acc.gl .term-t")].map((e) => e.textContent))).includes("Osmosis") && (await demoBody(p, "interior")).cards.find((x) => x.front === "Osmosis")?.gloss === false);
await tap(p, ".ed-glossbar button"); await fill(p, ".mdl-card input", "Diffusion"); await fill(p, ".mdl-card textarea", "Spreading out of particles."); await tap(p, ".mdl-card button", "Add term"); await wait(900);
await tap(p, ".acc.gl > button", "Diffusion"); await p.evaluate(() => document.querySelector("[aria-label='Delete term: Diffusion']").click()); await wait(300);
await tap(p, ".mdl-card button", "Delete"); await wait(900);
chk("Delete removes the term and its card", !(await p.evaluate(() => [...document.querySelectorAll(".acc.gl .term-t")].map((e) => e.textContent))).includes("Diffusion") && !(await demoBody(p, "interior")).cards.some((x) => x.front === "Diffusion"));
chk("no horizontal overflow (glossary)", (await overflow(p)) <= 0);

/* ---------- history and undo ---------- */
await hash(p, NOTES);
await tap(p, B1); await fill(p, ".ed-inline textarea", "Text before the undo test"); await tap(p, ".ed-inline button", "Save"); await wait(500);
await tap(p, B1); await fill(p, ".ed-inline textarea", "Text that will be undone"); await tap(p, ".ed-inline button", "Save"); await wait(500);
await tap(p, ".ed-bar button", "History"); await wait(600);
chk("History lists the changes: who, when and what, newest first", await p.evaluate(() => { const rows = [...document.querySelectorAll(".ed-hrow")]; return rows.length >= 10 && /Edited a point: .*Text that will be undone/.test(rows[0].innerText) && /you@alpha\.ca/.test(rows[0].innerText); }), await p.evaluate(() => document.querySelector(".ed-hrow")?.innerText.replace(/\n/g, " | ")));
chk("history shows the earlier kinds of change too", await p.evaluate(() => { const t = document.querySelector(".mdl-card").innerText; return /Added a question/.test(t) && /Deleted a question/.test(t) && /Replaced a picture/.test(t) && /Added a flashcard/.test(t) && /Removed a picture/.test(t) && /Edited a flashcard/.test(t) && /Deleted a flashcard/.test(t); }));
chk("every Undo button names its change", await p.evaluate(() => [...document.querySelectorAll(".ed-hrow button")].every((x) => /^Undo: /.test(x.getAttribute("aria-label")))));
chk("no horizontal overflow (history)", (await overflow(p)) <= 0);
await scan(p, "change history (light)");
await tap(p, ".ed-hrow button"); await wait(1200);
chk("Undo puts the previous text back on the page behind", (await txt(p, B1)) === "Text before the undo test", await txt(p, B1));
chk("the pretend database holds the earlier text again", (await demoBody(p, "deformation")).sections[0].steps[0].bullets[0] === "Text before the undo test");
chk("the history shows the undo, and the undone change is marked and cannot be undone again", await p.evaluate(() => { const rows = [...document.querySelectorAll(".ed-hrow")]; return /Undid: Edited a point: .*Text that will be undone/.test(rows[0].innerText) && !rows[0].querySelector("button").disabled && /Undone/.test(rows[1].innerText) && rows[1].querySelector("button").disabled; }));
await tap(p, ".ed-hrow button"); await wait(1200);
chk("an undo can itself be undone (redo)", (await txt(p, B1)) === "Text that will be undone", await txt(p, B1));
await tap(p, ".mdl-card button", "Close");
chk("Close shuts the history", (await count(p, ".mdl")) === 0);

/* ---------- the last topic cannot be deleted ---------- */
await hash(p, "#/l/fossils/notes"); await wait(500);
let guard = 0;
while ((await p.evaluate(() => document.querySelector("select[aria-label='Jump to topic']").options.length)) > 2 && guard++ < 14) { await tap(p, ".ed-pagetools button", "Delete this topic"); await tap(p, ".mdl-card button", "Delete"); await wait(700); }
const optsLeft = await p.evaluate(() => document.querySelector("select[aria-label='Jump to topic']").options.length);
chk("topics can be deleted down to one (at-a-glance page aside)", optsLeft <= 2, "left=" + optsLeft);
if (optsLeft === 2) { await tap(p, ".ed-pagetools button", "Delete this topic"); await tap(p, ".mdl-card button", "Delete"); await wait(700); }
chk("the last topic cannot be deleted: the button is off and says why", await p.evaluate(() => { const b = [...document.querySelectorAll(".ed-pagetools button")].find((x) => /Delete this topic/.test(x.textContent)); return !!b && b.disabled && /at least one topic/.test(document.querySelector(".ed-pagetools").innerText); }));
chk("the lecture still has one topic in the database", (await demoBody(p, "fossils")).sections.length === 1);

/* ---------- Done, student view, and dark mode ---------- */
await hash(p, NOTES); await wait(300);
await p.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }, { name: "prefers-reduced-motion", value: "reduce" }]); await wait(300);
await scan(p, "notes in edit mode (dark)");
await tap(p, ".ed-step li .ed-text"); await scan(p, "inline editor open (dark)"); await tap(p, ".ed-inline button", "Cancel");
await tap(p, ".figbtn"); await wait(300); await scan(p, "picture dialog (dark)"); await tap(p, ".mdl-card button", "Cancel");
await tap(p, ".ed-bar button", "History"); await wait(600); await scan(p, "change history (dark)"); await tap(p, ".mdl-card button", "Close");
await hash(p, QUIZ); await scan(p, "quiz tab with the question list (dark)");
await tap(p, ".ed-bar button", "Add question"); await wait(300); await tap(p, ".mdl-card button", "Add question"); await scan(p, "add question sheet with messages (dark)"); await tap(p, ".mdl-card button", "Cancel");
await hash(p, CARDS); await scan(p, "cards tab (dark)");
await hash(p, "#/glossary"); await tap(p, ".ed-glossbar button"); await fill(p, ".mdl-card input", "What is it?"); await scan(p, "add term form, term rejected (dark)"); await tap(p, ".mdl-card button", "Cancel");
await p.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }, { name: "prefers-reduced-motion", value: "reduce" }]);
await hash(p, NOTES);
await tap(p, ".ed-bar button", "Done"); await wait(700);
chk("Done switches edit mode off and every control goes", (await count(p, EDIT_UI)) === 0 && (await count(p, ".editpill.on")) === 0 && await p.evaluate(() => localStorage.getItem("erth209:edit") === "0"));
chk("with edit mode off a picture opens the viewer again", (await count(p, ".figbtn[aria-label='Enlarge picture']")) > 0);
chk("what the admin changed is what the page shows now (the edited topic title)", (await txt(p, ".page h2")).includes("Deformation basics (edited)"));
chk("the edit pill turns it back on", await (async () => { await tap(p, ".editpill"); await wait(700); return (await count(p, ".ed-bar")) === 1; })());
chk("view as a student hides edit mode again", await (async () => { await p.evaluate(() => localStorage.setItem("erth209:student", "1")); await p.evaluate(() => location.reload()); await wait(1500); return (await count(p, EDIT_UI)) === 0; })());

await p.ctx.close(); await b.close();
console.log(`${passed} checks passed`);
if (errs.length) { console.log("ERRORS"); console.log(errs.join("\n")); bad++; }
process.exit(bad ? 1 : 0);
