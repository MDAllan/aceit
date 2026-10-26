// Tests for admin edit mode: the rules for what an admin may save and the helpers that need no page (js/editmode-core.js). Run: node tools/test_editmode.mjs
import { readFileSync } from "node:fs";
import * as C from "../js/editmode-core.js";
import { isTerm } from "../js/glossaryrules.js";
let fails = 0, n = 0;
const ok = (c, msg) => { n++; if (!c) { fails++; console.error("FAIL:", msg); } };
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg}: got ${JSON.stringify(a)}, wanted ${JSON.stringify(b)}`);
const throws = (f, msg) => { let t = false; try { f(); } catch { t = true; } ok(t, msg); };

/* ---------- paths ---------- */
const body = () => ({ title: "L", sections: [{ id: "a", steps: [{ title: "s0", bullets: ["x", "y", "z"] }, { title: "s1", bullets: [] }] }, { id: "b" }], cards: [], quiz: [] });
{
  const o = body();
  eq(C.getAt(o, "sections.0.steps.0.bullets.1"), "y", "getAt with a dotted string");
  eq(C.getAt(o, ["sections", 0, "steps", 1, "title"]), "s1", "getAt with an array");
  eq(C.getAt(o, "sections.5.title", "none"), "none", "getAt falls back when the way is missing");
  eq(C.getAt(o, "title.length", "no"), "no", "getAt does not look inside a string");
  C.setAt(o, "sections.0.steps.0.bullets.1", "Y"); eq(o.sections[0].steps[0].bullets, ["x", "Y", "z"], "setAt replaces a value");
  C.setAt(o, "sections.1.boxes.0.text", "boxed"); eq(o.sections[1].boxes, [{ text: "boxed" }], "setAt makes the lists and objects on the way");
  C.setAt(o, ["meta", "n"], 1); eq(o.meta, { n: 1 }, "setAt makes an object for a name");
  eq(C.removeAt(o, "sections.0.steps.0.bullets.0"), "x", "removeAt answers the removed value");
  eq(o.sections[0].steps[0].bullets, ["Y", "z"], "removeAt splices a list entry (no hole)");
  C.removeAt(o, "meta.n"); eq(o.meta, {}, "removeAt deletes a key");
  ok(C.removeAt(o, "sections.9.x") === undefined && C.removeAt(o, "nothing.here") === undefined, "removeAt of a missing place does nothing");
  eq(C.insertAt(o, "sections.0.steps.0.bullets", 1, "mid"), 1, "insertAt answers the index");
  eq(o.sections[0].steps[0].bullets, ["Y", "mid", "z"], "insertAt puts the value in the list");
  C.insertAt(o, "sections.0.steps.0.bullets", 99, "end"); eq(o.sections[0].steps[0].bullets.at(-1), "end", "insertAt clamps to the end");
  C.insertAt(o, "fresh", 0, 1); eq(o.fresh, [1], "insertAt makes a missing list");
  const l = [1, 2, 3, 4];
  ok(C.moveWithin(l, 0, 2) && JSON.stringify(l) === "[2,3,1,4]", "moveWithin moves an entry");
  ok(!C.moveWithin(l, 0, 9) && !C.moveWithin(l, -1, 2) && !C.moveWithin(l, 1, 1), "moveWithin refuses places outside the list");
  throws(() => C.setAt({}, "__proto__.polluted", 1), "setAt refuses __proto__");
  throws(() => C.setAt({}, ["constructor", "prototype", "x"], 1), "setAt refuses constructor and prototype");
  throws(() => C.getAt({}, "a.__proto__"), "getAt refuses __proto__");
  ok(({}).polluted === undefined, "nothing was polluted");
  throws(() => C.setAt({}, "", 1), "setAt needs a path");
}

/* ---------- text ---------- */
{
  ok(C.checkText("  hello  ", { required: true }).value === "hello", "text is trimmed");
  ok(!C.checkText("   ", { required: true }).ok && /empty/.test(C.checkText("", { required: true, name: "The title" }).why), "an empty required text is refused with its name");
  ok(C.checkText("", { required: false }).ok, "an empty optional text is fine");
  ok(!C.checkText("x".repeat(11), { max: 10 }).ok && /10/.test(C.checkText("x".repeat(11), { max: 10 }).why), "too long: refused with the limit");
  ok(C.checkText("x".repeat(10), { max: 10 }).ok, "exactly the limit is fine");
  ok(!C.checkText("ab", { min: 3, required: true }).ok, "too short is refused");
  ok(C.checkText("one" + String.fromCharCode(10) + "two", { multiline: true }).value === "one" + String.fromCharCode(10) + "two", "a multi-line text keeps its line break");
  ok(C.checkText("one" + String.fromCharCode(10) + "two").value === "one two", "a single-line text loses its line break");
  ok(C.checkText("a" + String.fromCharCode(13, 10) + "b", { multiline: true }).value === "a" + String.fromCharCode(10) + "b", "Windows line ends are made the same");
  for (const code of [0, 1, 7, 8, 11, 27, 127, 0x85, 0x200B, 0x200D, 0x202E, 0x2028, 0x2063, 0xFEFF]) ok(!C.checkText("a" + String.fromCodePoint(code) + "b", { multiline: true }).ok, `control or invisible character U+${code.toString(16)} is refused`);
  ok(C.checkText("**bold** and *italic* ok").ok && C.checkText("Caf\u{e9} \u{2013} \u{3b1} \u{4e2d}").ok, "markdown marks and ordinary letters pass");
  ok(C.checkText("<script>alert(1)</script>").value === "<script>alert(1)</script>", "angle brackets are kept as text (the page shows text, never HTML)");
  eq(C.plain("**Stress** is *force*"), "Stress is force", "plain removes the marks");
  ok(C.clip("short", 10) === "short" && C.clip("a long sentence that goes on", 12).length <= 12 && C.clip("a long sentence that goes on", 12).endsWith("..."), "clip shortens with dots");
  ok(C.autoShort("Force per unit area. It is measured in pascals.") === "Force per unit area.", "autoShort takes the first sentence");
  ok(C.autoShort("x".repeat(200)).length <= 60, "autoShort is at most 60 characters");
}

/* ---------- questions ---------- */
const goodQ = () => ({ q: "What is stress?", options: ["force per area", "force per volume", "a kind of strain", "none"], answer: 0, why: "Stress is force per unit area.", topic: "" });
{
  ok(C.checkQuestion(goodQ()).ok, "a good question is accepted");
  const r = C.checkQuestion({ ...goodQ(), topic: "basics" }, { sectionIds: ["basics", "x"] });
  ok(r.ok && r.value.topic === "basics" && r.value.answer === 0, "a topic of the lecture is kept");
  ok(!("topic" in C.checkQuestion(goodQ()).value), "no topic: the field is left out");
  ok(!C.checkQuestion({ ...goodQ(), topic: "nope" }, { sectionIds: ["basics"] }).ok && C.checkQuestion({ ...goodQ(), topic: "nope" }, { sectionIds: ["basics"] }).errors.topic, "a topic that is not in the lecture is refused");
  ok(!C.checkQuestion({ ...goodQ(), topic: "bad id!" }).ok, "a topic that is not an id is refused");
  const bad = (patch, key) => { const x = C.checkQuestion({ ...goodQ(), ...patch }); ok(!x.ok && !!x.errors[key], `question refused (${key}): ${JSON.stringify(patch).slice(0, 70)}`); return x; };
  bad({ q: "" }, "q"); bad({ q: "ab" }, "q"); bad({ q: "x".repeat(701) }, "q"); bad({ q: "What?" + String.fromCharCode(0) }, "q");
  ok(C.checkQuestion({ ...goodQ(), q: "x".repeat(700) }).ok && C.checkQuestion({ ...goodQ(), q: "abc" }).ok, "3 and 700 characters are fine");
  bad({ options: ["only one"], answer: 0 }, "options"); bad({ options: [], answer: 0 }, "options");
  ok(C.checkQuestion({ ...goodQ(), options: ["a", "b"], answer: 1 }).ok, "two options are fine");
  ok(C.checkQuestion({ ...goodQ(), options: ["a", "b", "c", "d", "e"], answer: 4 }).ok, "five options are fine");
  bad({ options: ["a", "b", "c", "d", "e", "f"], answer: 0 }, "options");
  const e = bad({ options: ["a", "", "c", "d"], answer: 0 }, "options"); ok(/empty/.test(e.optionErrs[1]) && e.optionErrs[0] === "", "an empty option is named in the list of option messages");
  const d = bad({ options: ["Same", "same ", "c", "d"], answer: 0 }, "options"); ok(/same as option A/.test(d.optionErrs[1]), "duplicate options (ignoring case and spaces) are refused");
  bad({ options: ["a", "b", "c", "x".repeat(301)], answer: 0 }, "options");
  bad({ answer: 4 }, "answer"); bad({ answer: -1 }, "answer"); bad({ answer: 1.5 }, "answer"); bad({ answer: "1" }, "answer"); bad({ answer: undefined }, "answer");
  bad({ options: ["a", "", "c", "d"], answer: 1 }, "answer");
  bad({ why: "x".repeat(1501) }, "why"); ok(C.checkQuestion({ ...goodQ(), why: "x".repeat(1500) }).ok && C.checkQuestion({ ...goodQ(), why: "" }).ok, "an explanation of 1500 characters, or none, is fine");
  ok(C.checkQuestion({ ...goodQ(), q: "  Why?  ", options: [" a ", "b", "c", "d"] }).value.options[0] === "a", "values come back trimmed");
  ok(!C.checkQuestion(null).ok && !C.checkQuestion({}).ok, "nothing at all is refused without crashing");
}

/* ---------- flashcards ---------- */
{
  const g = C.checkCard({ front: "Stress", back: "Force per unit area.", short: "" });
  ok(g.ok && g.value.short === "Force per unit area.", "a card is accepted and gets a short version from its back");
  ok(C.checkCard({ front: "Stress", back: "b", short: "Force" }).value.short === "Force", "a short version that is given is kept");
  ok(!C.checkCard({ front: "", back: "b" }).ok && C.checkCard({ front: "", back: "b" }).errors.front, "an empty front is refused");
  ok(!C.checkCard({ front: "f", back: "  " }).ok && C.checkCard({ front: "f", back: "  " }).errors.back, "an empty back is refused");
  ok(!C.checkCard({ front: "x".repeat(301), back: "b" }).ok, "a front over 300 characters is refused");
  ok(!C.checkCard({ front: "f", back: "x".repeat(1201) }).ok, "a back over 1200 characters is refused");
  ok(!C.checkCard({ front: "f", back: "b", short: "x".repeat(161) }).ok, "a short version over 160 characters is refused");
  ok(!C.checkCard({ front: "f" + String.fromCharCode(7), back: "b" }).ok, "a control character is refused");
}

/* ---------- glossary entries and what an edit does to a card ----------
{
  const e = (term, definition = "Water moves across a membrane.", ex) => C.checkGlossaryEntry({ term, definition }, ex);
  ok(e("Osmosis").ok, "Osmosis is accepted");
  const q = e("What is osmosis?"); ok(!q.ok && /question/i.test(q.errors.term), "What is osmosis? is rejected, with the reason");
  ok(!e("").ok && !e("Describe osmosis").ok && !e("Mitosis vs meiosis").ok && !e("Cancer process").ok && !e("A very long entry with many words inside it").ok, "questions, instructions, comparisons, processes and long phrases are rejected");
  ok(!e("Ends with a period.").ok, "a sentence is rejected");
  ok(!e("Osmosis", "").ok && e("Osmosis", "").errors.definition && !e("Osmosis", "").errors.term, "the meaning is required");
  ok(!e("Osmosis", "x", ["osmosis"]).ok && /already/.test(e("Osmosis", "x", ["osmosis"]).errors.term), "a term the glossary already has is refused (ignoring case)");
  ok(e("Osmosis", "x", ["Diffusion"]).ok, "another term does not matter");
  for (const t of ["Mesoderm", "Metastasis", "Rough ER", "Kepler's third law"]) ok(e(t).ok === isTerm(t), "same answer as the glossary rule for " + t);
  // editing a card
  const listed = { id: "c1", front: "Stress", back: "Force per area", short: "Force" };
  let r = C.applyCardEdit(listed, { front: "Stress", back: "New back", short: "New" });
  ok(r.card.back === "New back" && r.card.gloss === undefined && r.notice === "", "an edit that keeps the term a term changes nothing else");
  r = C.applyCardEdit(listed, { front: "What is stress?", back: "b", short: "s" });
  ok(r.card.gloss === false && /no longer a glossary term/.test(r.notice) && /question/i.test(r.notice), "a listed card whose front becomes a question stays a flashcard (gloss:false) and says so");
  ok(listed.gloss === undefined && listed.front === "Stress", "the original card object is not changed by applyCardEdit");
  const hidden = { id: "c2", front: "Stress", back: "b", short: "s", gloss: false };
  r = C.applyCardEdit(hidden, { front: "Strain", back: "b", short: "s" });
  ok(r.card.gloss === false && r.notice === "", "a card that was hidden from the glossary stays hidden, without a notice");
  const withTerm = { id: "c3", front: "What are the three types?", term: "Three types", back: "b", short: "s" };
  r = C.applyCardEdit(withTerm, { front: "What are the 3 types?", back: "b", short: "s" });
  ok(r.card.gloss === undefined && r.notice === "", "the explicit term decides, not the front");
  // making one
  const nc = C.newCard({ front: "Osmosis", back: "Movement of water.", short: "" }, "x-a1", { glossary: true });
  ok(nc.id === "x-a1" && nc.gloss === true && nc.short === "Movement of water.", "a glossary card has gloss:true and a short version");
  ok(C.newCard({ front: "Osmosis", back: "b", short: "s" }, "x-a2").gloss === undefined, "a flashcard whose front is a term is listed by default");
  ok(C.newCard({ front: "What is osmosis?", back: "b", short: "s" }, "x-a3").gloss === false, "a flashcard whose front is a question is kept out of the glossary");
}

/* ---------- pictures ---------- */
{
  ok(C.checkAlt("A cliff of layered rock").ok && !C.checkAlt("").ok && !C.checkAlt("  ").ok && /empty/.test(C.checkAlt("").why), "a picture description is required");
  ok(!C.checkAlt("x".repeat(401)).ok && C.checkAlt("x".repeat(400)).ok, "a picture description is at most 400 characters");
  for (const p of ["erth209/abcdef0123456789.webp", "astr207/AB_cd-12.jpg", "biol305/12345678.png"]) ok(C.COURSE_IMAGE_PATH.test(p), "course picture path accepted: " + p);
  for (const p of ["erth209/short.webp", "erth209/abcdef0123456789.gif", "erth209/abcdef0123456789.webp/x", "../abcdef0123456789.webp", "erth209/abcd efgh.webp", "/abcdef0123456789.webp", "a/b/abcdef0123456789.webp", "x".repeat(65) + "/abcdef0123456789.webp"]) ok(!C.COURSE_IMAGE_PATH.test(p), "course picture path refused: " + p);
}

/* ---------- ids: 10,000 of them never collide, and keep the lecture's style ---------- */
{
  const taken = new Set(["def-a1", "def-a2"]), made = new Set();
  for (let i = 0; i < 10000; i++) { const id = C.makeId("def", taken); ok(!taken.has(id), "id is new"); taken.add(id); made.add(id); }
  ok(made.size === 10000, "10,000 ids in a row are all different (same millisecond, same list)");
  ok([...made].every((id) => /^def-a[0-9a-z]{9,}$/.test(id)), "ids look like <prefix>-a<base36 time><random>");
  // even when the random part is stuck, it widens until the id is free
  let calls = 0; const taken2 = new Set();
  const stuck = () => { calls++; return 0.5; };
  const a = C.makeId("p", taken2, { rand: stuck, now: () => 1000 }); taken2.add(a);
  const b = C.makeId("p", taken2, { rand: stuck, now: () => 1000 });
  ok(a !== b && calls > 8, "a stuck random source still gives a different id");
  ok(C.makeId("a b/c!", [], {}).startsWith("abc-a"), "the prefix is made safe");
  ok(C.makeId("", [], {}).startsWith("x-a"), "an empty prefix becomes x");
  eq(C.idPrefix(["def-c1", "def-c2", "other-1"], "fallback"), "def", "the prefix is the most common start of the ids");
  eq(C.idPrefix(["basics", "types"], "deformation"), "deformation", "ids without a dash fall back to the lecture id");
  eq(C.idPrefix([], "my lecture!"), "mylecture", "the fallback is made safe too");
  // the real lectures: a made id never collides with an existing one and the prefix fits
  const subjects = JSON.parse(readFileSync(new URL("../content/subjects.json", import.meta.url), "utf8"));
  let checked = 0;
  for (const sj of subjects) for (const id of sj.lectures) {
    const lec = JSON.parse(readFileSync(new URL(`../content/${id}.json`, import.meta.url), "utf8"));
    for (const key of ["cards", "quiz", "sections"]) {
      const ids = lec[key].map((x) => x.id), p = C.idPrefix(ids, lec.id), fresh = C.makeId(p, ids);
      ok(!ids.includes(fresh) && /^[A-Za-z0-9_-]+$/.test(fresh), `${id}/${key}: a new id is unique and safe`); checked++;
    }
  }
  ok(checked >= 60, "checked the ids of the real lectures");
}

/* ---------- history text ---------- */
{
  ok(C.summaryFor("edit-bullet", "**Stress** is force per area") === "Edited a point: Stress is force per area", "summary names the action and the plain text");
  ok(C.summaryFor("add-question", "What is stress?") === "Added a question: What is stress?", "summary of an added question");
  ok(C.summaryFor("delete-card", "Strain") === "Deleted a flashcard: Strain", "summary of a deleted flashcard");
  ok(C.summaryFor("hide-term", "Strain") === "Removed a term from the glossary: Strain" && C.summaryFor("add-term", "Osmosis") === "Added a glossary term: Osmosis", "summaries of glossary changes");
  ok(C.summaryFor("move-bullet") === "Moved a point" && C.summaryFor("nonsense", "x") === "Edited: x", "no detail: just the action; unknown action: Edited");
  const long = C.summaryFor("edit-bullet", "word ".repeat(200));
  ok(long.length <= 200 && long.endsWith("..."), "a long detail is cut so the summary stays under the database limit of 200");
  ok(!/[\u0000-\u001f]/.test(C.summaryFor("edit-text", "a" + String.fromCharCode(10) + "b" + String.fromCharCode(0))), "control characters do not reach the history");
  ok(C.summaryFor("edit-text", "line one" + String.fromCharCode(10) + "line two") === "Edited: line one line two", "line breaks become spaces");
  const A = { title: "T", sections: [{ id: "s1", title: "One" }], cards: [{ id: "c1", front: "a" }, { id: "c2", front: "b" }], quiz: [{ id: "q1", q: "x" }] };
  const B = JSON.parse(JSON.stringify(A));
  eq(C.describeChange(A, B), "No changes", "describeChange: nothing changed");
  B.quiz.push({ id: "q2", q: "y" }); eq(C.describeChange(A, B), "Added 1 question", "describeChange: one question added");
  B.cards[0].front = "changed"; B.cards.push({ id: "c3" }, { id: "c4" }); ok(/added 2 flashcards/i.test(C.describeChange(A, B)) && /changed 1 flashcard/.test(C.describeChange(A, B)) && /added 1 question/.test(C.describeChange(A, B)), "describeChange: counts with plurals");
  B.sections = []; ok(/deleted 1 topic/i.test(C.describeChange(A, B)), "describeChange: a deleted topic");
  const T = JSON.parse(JSON.stringify(A)); T.intro = "new"; ok(/changed the intro/i.test(C.describeChange(A, T)), "describeChange: the intro");
}

/* ---------- the whole body, before it is sent ---------- */
{
  const good = { sections: [{ id: "a" }, { id: "b" }], cards: [{ id: "c1" }], quiz: [{ id: "q1" }] };
  ok(C.checkBody(good).ok, "a good body is accepted");
  ok(!C.checkBody(null).ok && !C.checkBody([]).ok && !C.checkBody("x").ok, "a body that is not an object is refused");
  ok(!C.checkBody({ ...good, quiz: {} }).ok && /list/.test(C.checkBody({ ...good, quiz: {} }).why), "a part that is not a list is refused");
  ok(!C.checkBody({ ...good, sections: [] }).ok && /at least one topic/.test(C.checkBody({ ...good, sections: [] }).why), "a lecture with no topics is refused");
  ok(!C.checkBody({ cards: [], quiz: [] }).ok, "a lecture without sections is refused");
  ok(!C.checkBody({ ...good, cards: [{ id: "c1" }, { id: "c1" }] }).ok, "two cards with the same id are refused");
  ok(!C.checkBody({ ...good, quiz: [{ q: "no id" }] }).ok, "an item without an id is refused");
  ok(!C.checkBody({ ...good, cards: [{ id: "c1", back: "x".repeat(2000100) }] }).ok && /2 MB/.test(C.checkBody({ ...good, cards: [{ id: "c1", back: "x".repeat(2000100) }] }).why), "a body over 2,000,000 bytes is refused");
  ok(C.checkBody({ ...good, cards: [{ id: "c1", back: "x".repeat(1900000) }] }).ok, "a big body under the limit is fine");
  ok(C.byteSize({ a: "\u{e9}" }) > JSON.stringify({ a: "\u{e9}" }).length - 1, "the size counts bytes, not characters");
  ok(C.canDeleteSection(good).ok && !C.canDeleteSection({ sections: [{ id: "a" }] }).ok && /last one/.test(C.canDeleteSection({ sections: [{ id: "a" }] }).why), "the last topic of a lecture cannot be deleted, and the reason says so");
  ok(!C.canDeleteSection({}).ok, "a body with no topics cannot lose one");
  // every real lecture passes the same check the database makes
  const subjects = JSON.parse(readFileSync(new URL("../content/subjects.json", import.meta.url), "utf8"));
  for (const sj of subjects) for (const id of sj.lectures) ok(C.checkBody(JSON.parse(readFileSync(new URL(`../content/${id}.json`, import.meta.url), "utf8"))).ok, `${id}: the published lecture passes checkBody`);
}

/* ---------- the longest existing course texts fit the limits (editing an existing item never fails only for its length) ---------- */
{
  const subjects = JSON.parse(readFileSync(new URL("../content/subjects.json", import.meta.url), "utf8"));
  let longest = {};
  const see = (k, s) => { if (typeof s === "string") longest[k] = Math.max(longest[k] || 0, s.length); };
  for (const sj of subjects) for (const id of sj.lectures) {
    const l = JSON.parse(readFileSync(new URL(`../content/${id}.json`, import.meta.url), "utf8"));
    see("intro", l.intro);
    for (const s of l.sections) { see("title", s.title); s.bullets.forEach((b) => see("bullet", b)); s.boxes.forEach((b) => see("box", b.text)); for (const st of s.steps || []) { see("title", st.title); st.bullets.forEach((b) => see("bullet", b)); see("alt", st.img?.alt); } }
    for (const c of l.cards) { see("front", c.front); see("back", c.back); see("short", c.short); }
    for (const q of l.quiz) { see("q", q.q); see("why", q.why); q.options.forEach((o) => see("option", o)); see("alt", q.img?.alt); ok(q.options.length <= C.LIMITS.optionsMax, "an existing question has at most 5 options"); }
  }
  for (const [k, lim] of [["intro", C.LIMITS.intro], ["title", C.LIMITS.title], ["bullet", C.LIMITS.bullet], ["box", C.LIMITS.box], ["alt", C.LIMITS.alt], ["front", C.LIMITS.front], ["back", C.LIMITS.back], ["short", C.LIMITS.short], ["q", C.LIMITS.question[1]], ["why", C.LIMITS.why], ["option", C.LIMITS.option]])
    ok(longest[k] <= lim, `existing ${k} texts fit the limit (longest ${longest[k]}, limit ${lim})`);
  // an existing question, edited back to itself, still passes
  const l = JSON.parse(readFileSync(new URL("../content/deformation.json", import.meta.url), "utf8"));
  ok(l.quiz.every((q) => C.checkQuestion({ q: q.q, options: q.options, answer: q.answer, why: q.why }).ok), "every existing question of a lecture still passes checkQuestion unchanged");
  ok(l.cards.every((c) => C.checkCard({ front: c.front, back: c.back, short: c.short }).ok), "every existing card of a lecture still passes checkCard unchanged");
}

if (fails) { console.error(fails + " of " + n + " edit mode check(s) failed"); process.exit(1); }
console.log(`all ${n} edit mode checks passed`);
