// The glossary rule (terms, vocabulary and names only) and the cleaned course content. Run: node tools/test_glossary.mjs
import { readFileSync } from "node:fs";
import { checkTerm, isTerm, termOf, inGlossary, glossaryFor } from "../js/glossaryrules.js";
let fails = 0;
const ok = (c, msg) => { if (!c) { fails++; console.error("FAIL:", msg); } };

// what is allowed
for (const t of ["Mesoderm", "Metastasis", "Newton", "Rough ER", "Banded iron formation (BIF)", "Wadati-Benioff zones", "K-Pg boundary", "Ka, Ma, Ga", "Kepler's third law"]) ok(isTerm(t), `should be a term: ${t}`);
// what is not: questions, instructions, long phrases, processes, comparisons, empty
for (const t of ["What causes cancer?", "Why do S waves stop at the outer core?", "How cells divide", "When did it happen", "Which layer is the thickest", "Who proved the solid inner core", "Cancer process", "The process", "Mitosis vs meiosis", "Mitosis versus meiosis",
  "Describe osmosis", "Define stress", "List the levels", "Compare flagella and cilia", "Give the classification of humans", "Name three probes", "Is it solid", "A very long entry with many words inside it", "Is this a term?", "", "   ", "Ends with a period."])
  ok(!isTerm(t), `should be rejected: ${JSON.stringify(t)}`);
ok(/question/i.test(checkTerm("What is it?").why), "a question gets a reason that mentions questions");
ok(/words/.test(checkTerm("one two three four five").why), "a long phrase says how many words");
ok(/process/i.test(checkTerm("Cancer process").why), "a process gets a reason that mentions a process");
ok(termOf({ front: "What is osmosis?", term: "Osmosis" }) === "Osmosis", "an explicit term wins over the front");
ok(!inGlossary({ front: "Osmosis", gloss: false }), "gloss:false keeps a card out of the glossary");
ok(!inGlossary({ front: "What is osmosis?" }), "a question front is not listed");

// the real content: every card is either listed with a valid term or explicitly left out
const subjects = JSON.parse(readFileSync(new URL("../content/subjects.json", import.meta.url), "utf8"));
let bad = 0;
for (const sj of subjects) {
  const lecs = sj.lectures.map((id) => JSON.parse(readFileSync(new URL(`../content/${id}.json`, import.meta.url), "utf8")));
  for (const l of lecs) for (const c of l.cards || []) if (c.gloss !== false && !isTerm(termOf(c))) { bad++; console.error(`  not cleaned: ${l.id} / ${c.id}: ${c.front}`); }
  const g = glossaryFor(lecs), terms = g.map((x) => x.term.toLowerCase());
  ok(new Set(terms).size === terms.length, `${sj.id}: a term is listed twice`);
  ok(g.every((x) => isTerm(x.term)), `${sj.id}: every listed term passes the rule`);
  ok(g.length >= 50, `${sj.id}: the glossary should still have a useful number of terms (has ${g.length})`);
  console.log(`${sj.name}: ${g.length} glossary terms`);
}
ok(bad === 0, `${bad} flashcards break the glossary rule and are not marked (run python tools/glossary_cleanup.py)`);
if (fails) { console.error(fails + " glossary check(s) failed"); process.exit(1); }
console.log("all glossary checks passed");
