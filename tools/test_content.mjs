// Unit tests for what instructors add to their classes: the rules for each kind of item, pasting many questions or cards at once,
// and how the items are merged into the study screens. Run: node tools/test_content.mjs
import { problem, tidy, summary, text, MARK, KINDS } from "../js/itemrules.js";
import { parseQuestions, parseCards } from "../js/bulk.js";
import { buildExtras, mark, isMarked, lectureId, itemId } from "../js/classcontent.js";
let fails = 0, n = 0;
const ok = (c, msg) => { n++; if (!c) { fails++; console.error("FAIL:", msg); } };
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), msg + "  got " + JSON.stringify(a));

// ---- the rules ----
const Q = { q: "What is the capital of France?", options: ["Berlin", "Paris", "Rome"], answer: 1, why: "Paris has been the capital for centuries." };
ok(problem("question", Q) === null, "a normal question is fine");
ok(problem("question", { ...Q, why: undefined }) === null || problem("question", (({ why, ...r }) => r)(Q)) === null, "the explanation is optional");
ok(problem("question", { ...Q, options: ["Yes", "No"], answer: 0 }) === null, "two options (true / false) are allowed");
ok(problem("question", { ...Q, options: ["a", "b", "c", "d", "e"], answer: 4 }) === null, "five options are allowed");
ok(problem("question", { ...Q, options: ["only one"], answer: 0 }) !== null, "one option is not enough");
ok(problem("question", { ...Q, options: ["a", "b", "c", "d", "e", "f"] }) !== null, "six options are too many");
ok(problem("question", { ...Q, answer: 3 }) !== null && problem("question", { ...Q, answer: -1 }) !== null && problem("question", { ...Q, answer: 1.5 }) !== null && problem("question", { ...Q, answer: "1" }) !== null, "the answer must be a whole number that points at an option");
ok(problem("question", { ...Q, options: ["Paris", " paris ", "Rome"] }) !== null, "options that differ only by capitals or spaces are the same");
ok(problem("question", { ...Q, q: "?" }) !== null && problem("question", { ...Q, q: "x".repeat(701) }) !== null, "the question length is checked");
ok(problem("question", { ...Q, extra: 1 }) !== null, "unknown fields are refused");
ok(problem("question", { ...Q, img: { path: "p/abcdefgh.webp", alt: "A map" } }) === null, "a picture with a description is fine");
ok(problem("question", { ...Q, img: { path: "p/abcdefgh.webp", alt: "" } }) !== null, "a picture needs a description");
ok(problem("question", { ...Q, q: "bad\u0001text" }) !== null && problem("question", { ...Q, q: "bad" + MARK + "text" }) !== null, "control characters and the reserved marker are refused");
ok(problem("card", { front: "Term", back: "Meaning" }) === null && problem("card", { front: "", back: "x" }) !== null && problem("card", { front: "x", back: "y".repeat(801) }) !== null, "flashcards");
ok(problem("card", { front: "Term", back: "Meaning", short: "z".repeat(101) }) !== null, "the short version is limited");
ok(problem("note", { title: "Plate boundaries", bullets: ["Divergent", "Convergent"] }) === null && problem("note", { title: "Only a title" }) === null && problem("note", { title: "x", bullets: Array(16).fill("p") }) !== null, "notes");
ok(problem("lecture", { title: "Week 1", chapter: "Ch 1", icon: "\u{1F4D8}", intro: "Welcome" }) === null && problem("lecture", { title: "" }) !== null, "lectures");
ok(problem("announcement", { title: "Midterm moved", text: "Now on Friday.", until: "2026-11-02" }) === null && problem("announcement", { title: "x", until: "2026-13-45" }) !== null && problem("announcement", { title: "x", until: "tomorrow" }) !== null, "announcements need a real date");
ok(problem("question", null) !== null && problem("question", [1]) !== null && problem("nope", {}) !== null, "nonsense is refused");
ok(KINDS.length === 5, "five kinds of item");
ok(text("hi", 2, 2) && !text("  hi  ", 2, 2) && !text("   ", 1, 5) && text("\u{1F600}\u{1F600}", 2, 2), "text length counts characters, not code units, and the ends must already be trimmed");

// tidy() prepares what an editor collected
eq(tidy("card", { front: "  A ", back: " B  ", short: "   " }), { front: "A", back: "B" }, "tidy trims and drops empty optional fields");
eq(tidy("note", { title: " T ", bullets: [" a ", "", "  "] }), { title: "T", bullets: ["a"] }, "tidy drops empty points");
eq(tidy("question", { q: " Q? ", options: [" a ", "b"], answer: 1, why: "" }), { q: "Q?", options: ["a", "b"], answer: 1 }, "tidy keeps the answer index");
ok(problem("note", tidy("note", { title: "T", bullets: ["p"], img: { path: "abc/defghijk.webp", alt: " a map " } })) === null, "tidy output passes the rules");
// pasted text often carries invisible characters: tidy takes them out instead of making the instructor hunt for them
{
  const ch = (c) => String.fromCharCode(c), pasted = "Pla" + ch(0x200b) + "te " + ch(0x202e) + "tectonics" + ch(0xfeff) + ch(0x2028) + "second line";
  eq(tidy("card", { front: pasted, back: "B" }).front, "Plate tectonics" + ch(10) + "second line", "tidy removes zero-width and direction characters and turns line separators into new lines");
  ok(problem("card", tidy("card", { front: pasted, back: "B" })) === null, "...so pasted text passes the rules");
  ok(problem("card", { front: pasted, back: "B" }) !== null, "but the rules still refuse such characters when they get that far");
  ok(problem("card", { front: " leading", back: "B" }) !== null && problem("card", { front: "trailing" + ch(10), back: "B" }) !== null, "text with untrimmed ends is refused");
  ok(problem("card", { front: "a" + ch(0x200d) + "b", back: "B" }) === null && problem("card", { front: "caf" + ch(0xe9) + " " + String.fromCodePoint(0x1f469, 0x200d, 0x1f52c), back: "B" }) === null, "joiners, accents and emoji sequences are fine");
}
ok(summary("question", Q).startsWith("What is the capital") && summary("card", { front: "Term\nsecond line" }) === "Term" && summary("note", { title: "x".repeat(200) }).length === 90, "list summaries");

// ---- pasting many questions ----
const pasted = `1. What is the capital of France?
a) Berlin
b) Paris *
c) Rome
Why: Paris has been the capital since 987.

2. Which of these is a planet?
A. The Sun
B. Mars
C. The Moon
Answer: B

3) Is water wet? (true or false)
a) True
b) False
c) It depends *
d) Both
`;
const pq = parseQuestions(pasted);
ok(pq.errors.length === 0 && pq.items.length === 3, "three questions are read: " + JSON.stringify(pq.errors));
eq(pq.items[0], { q: "What is the capital of France?", options: ["Berlin", "Paris", "Rome"], answer: 1, why: "Paris has been the capital since 987." }, "question 1 with a star and an explanation");
eq(pq.items[1], { q: "Which of these is a planet?", options: ["The Sun", "Mars", "The Moon"], answer: 1 }, "question 2 with an Answer line");
ok(pq.items[2].answer === 2 && pq.items[2].options.length === 4, "question 3: star on the third option");
ok(pq.items.every((it) => problem("question", it) === null), "every pasted question passes the rules");
const bad = parseQuestions("Only a question\n\nWhat?\na) one\nb) two\n\nWhat?\na) one *\nb) two *\n\nWhat is it?\na) x\nb) y\nAnswer: z");
ok(bad.items.length === 0 && bad.errors.length === 4, "problems are reported per question: " + bad.errors.map((e) => e.message).join(" | "));
eq(parseQuestions("A long question\nthat runs on\na) yes\n   and more\nb) no *").items[0], { q: "A long question\nthat runs on", options: ["yes and more", "no"], answer: 1 }, "multi-line question and option");
ok(parseQuestions("").items.length === 0 && parseQuestions(null).errors.length === 0, "empty input is fine");

// ---- pasting many cards ----
const pc = parseCards("Igneous\tRock from cooled magma\nMetamorphic | Rock changed by heat and pressure\n\nbad line\n | only back\nfront only |");
eq(pc.items, [{ front: "Igneous", back: "Rock from cooled magma" }, { front: "Metamorphic", back: "Rock changed by heat and pressure" }], "cards are read from tabs and bars");
ok(pc.errors.length === 3, "bad lines are reported: " + pc.errors.map((e) => e.message).join(" | "));

// ---- merging into the study screens ----
const cls = [{ class_id: "k1", course_id: "astr207", name: "ASTR 207 Section 1", role: "student" }, { class_id: "k2", course_id: "erth209", name: "ERTH 209 Evening", role: "teacher" }, { class_id: "k3", course_id: "erth209", name: "Whole school", role: "manager" }];
const L1 = "11111111-1111-4111-8111-111111111111", L2 = "22222222-2222-4222-8222-222222222222";
const row = (id, class_id, kind, lecture_ref, status, body, position = 1) => ({ id, class_id, kind, lecture_ref, status, body, position, author_name: "Dr. Rivera", updated_at: "2026-10-18T10:00:00Z" });
const items = [
  row(L1, "k1", "lecture", null, "published", { title: "Week 1 review", icon: "\u{1F9EA}" }),
  row("a0000001-0000-4000-8000-000000000001", "k1", "note", L1, "published", { title: "Start here", bullets: ["In **lecture** one we met the textbook."] }),
  row("a0000001-0000-4000-8000-000000000002", "k1", "note", L1, "published", { title: "A picture", bullets: ["See it"], img: { path: "k1/abcdefgh.webp", alt: "A diagram" } }, 2),
  row("a0000001-0000-4000-8000-000000000003", "k1", "card", L1, "published", { front: "Speed", back: "Distance over time" }),
  row("a0000001-0000-4000-8000-000000000004", "k1", "question", L1, "published", Q),
  row("a0000001-0000-4000-8000-000000000005", "k1", "question", "motion", "published", { ...Q, q: "An extra question about motion?" }),
  row("a0000001-0000-4000-8000-000000000006", "k1", "card", "motion", "draft", { front: "Draft card", back: "Not yet" }),
  row("a0000001-0000-4000-8000-000000000007", "k1", "announcement", null, "published", { title: "Midterm moved", text: "Friday", until: "2026-12-01" }),
  row("a0000001-0000-4000-8000-000000000008", "k1", "announcement", null, "published", { title: "Old news", until: "2026-01-01" }),
  row("a0000001-0000-4000-8000-000000000009", "k1", "announcement", null, "draft", { title: "Secret plan" }),
  row(L2, "k2", "lecture", null, "draft", { title: "Draft lecture" }),
  row("b0000001-0000-4000-8000-000000000001", "k2", "note", L2, "published", { title: "Inside a draft lecture" }),
  row("b0000001-0000-4000-8000-000000000002", "k2", "question", "plates", "review", { ...Q, q: "Waiting for approval?" }),
  row("c0000001-0000-4000-8000-000000000001", "k3", "question", "plates", "published", { ...Q, q: "A class the person only manages" }),
  row("d0000001-0000-4000-8000-000000000001", "k9", "question", "motion", "published", { ...Q, q: "A class the person is not in" }),
];
const asStudent = buildExtras(items, cls.slice(0, 1), { today: "2026-10-18" });
ok(asStudent.lectures.length === 1 && asStudent.lectures[0].id === lectureId(L1) && asStudent.lectures[0].subject === "astr207" && asStudent.lectures[0].custom, "a student gets the published own lecture");
const lec = asStudent.lectures[0];
ok(lec.sections.length === 2 && lec.cards.length === 1 && lec.quiz.length === 1 && lec._full, "its notes, card and question are inside");
ok(isMarked(lec.title) && isMarked(lec.sections[0].title) && isMarked(lec.sections[0].bullets[0]) && isMarked(lec.cards[0].back) && isMarked(lec.quiz[0].q) && lec.quiz[0].options.every(isMarked), "text written by an instructor carries the marker");
ok(lec.sections[0].bullets[0] === MARK + "In **lecture** one we met the textbook.", "the words are kept exactly as written");
ok(lec.sections[1].steps?.[0]?.img?.path === "k1/abcdefgh.webp" && lec.sections[1].bullets.length === 0 && lec.sections[1].steps[0].bullets.length === 1, "a note with a picture becomes one box: picture and its points");
ok(lec.sections[0].id === itemId("a0000001-0000-4000-8000-000000000001") && /^cx[0-9a-f]{10}$/.test(lec.sections[0].id) && /^c[0-9a-f]{12}$/.test(lec.id), "ids are stable and cannot clash with the course's own");
ok(new Set(items.filter((i) => i.kind !== "lecture").map((i) => itemId(i.id))).size === items.filter((i) => i.kind !== "lecture").length && lectureId(L1) !== lectureId(L2), "ids of different items differ, even when the ids only differ at one end");
ok(lec.chapter === MARK + "ASTR 207 Section 1" && lec.icon === "\u{1F9EA}", "the label defaults to the class name");
ok(asStudent.extra.motion.quiz.length === 1 && asStudent.extra.motion.cards.length === 0, "extra questions for a course lecture are kept apart; drafts are hidden from students");
ok(asStudent.announcements.length === 1 && asStudent.announcements[0].title === MARK + "Midterm moved" && asStudent.announcements[0].by === "Dr. Rivera", "only current, published announcements");
ok(!asStudent.extra.plates && !asStudent.extra.undefined, "other classes' items do not appear");
const asTeacher = buildExtras(items, cls, { today: "2026-10-18", showDrafts: true });
ok(asTeacher.lectures.length === 2 && asTeacher.lectures.some((l) => l.draft && l.title === MARK + "Draft lecture" && l.sections.length === 1), "an instructor also sees drafts of a class they teach, flagged");
ok(asTeacher.extra.plates.quiz.length === 1 && asTeacher.extra.plates.quiz[0].draft && !asTeacher.extra.plates.quiz.some((q) => q.q.includes("only manages")), "...including items waiting for approval, but not a class they only manage");
ok(asTeacher.extra.motion.cards.length === 0, "...and not drafts of a class where they are a student");
const hidden = buildExtras(items, cls.slice(1, 2), { today: "2026-10-18" });
ok(hidden.lectures.length === 0 && !hidden.extra.plates, "without showDrafts an instructor sees what students see");
ok(buildExtras([], cls).lectures.length === 0 && buildExtras(items, []).lectures.length === 0, "nothing in, nothing out");
ok(mark("") === "" && mark(undefined) === undefined && isMarked(mark("x")) && !isMarked("x"), "marker helpers");

if (fails) { console.error(`${fails} of ${n} checks failed`); process.exit(1); }
console.log(`all ${n} content checks passed`);
