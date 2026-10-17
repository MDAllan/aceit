// Unit tests for the pure logic: spaced repetition and the number-cruncher generators. Run: node tools/test_logic.mjs
import { readFileSync } from "node:fs";
import { nextState, isDue, dueCards, INTERVALS, MAX_BOX, dayNum } from "../js/srs.js";
let fails = 0;
const ok = (c, msg) => { if (!c) { fails++; console.error("FAIL:", msg); } };

// --- spaced repetition ---
let st = nextState(undefined, true, 100);
ok(st.box === 1 && st.due === 101, "first correct answer -> box 1, due in 1 day");
st = nextState(st, true, 101); ok(st.box === 2 && st.due === 104, "second -> box 2, due in 3 days");
st = nextState(st, true, 104); ok(st.box === 3 && st.due === 111, "third -> box 3, due in 7 days");
st = nextState(st, true, 111); ok(st.box === 4 && st.due === 125, "fourth -> box 4, due in 14 days");
st = nextState(st, true, 125); ok(st.box === 5 && st.due === 155, "fifth -> box 5, due in 30 days");
st = nextState(st, true, 155); ok(st.box === MAX_BOX && st.due === 185, "box never exceeds the maximum");
st = nextState(st, false, 200); ok(st.box === 1 && st.due === 200, "a miss sends the card back to box 1, due today");
ok(!isDue(undefined, 5), "an unseen card is not 'due' (it is new)");
ok(isDue({ box: 2, due: 10 }, 10) && !isDue({ box: 2, due: 11 }, 10), "due on its date, not before");
ok(dueCards([{ id: "a" }, { id: "b" }, { id: "c" }], { a: { box: 1, due: 3 }, b: { box: 3, due: 9 } }, 5).length === 1, "only the overdue card is returned");
ok(INTERVALS.length === MAX_BOX + 1, "one interval per box");
ok(dayNum(Date.UTC(2026, 9, 17, 12), 0) - dayNum(Date.UTC(2026, 9, 16, 12), 0) === 1, "consecutive days differ by 1");
ok(dayNum(Date.UTC(2026, 9, 17, 1), 420) === dayNum(Date.UTC(2026, 9, 16, 12), 0), "local time zone shifts the day boundary");

// --- number cruncher generators ---
const src = readFileSync(new URL("../js/games.js", import.meta.url), "utf8");
const CALC = new Function(src.slice(src.indexOf("/* ---------- generators")) + "; return CALC;")();
for (const id of Object.keys(CALC)) {
  for (let i = 0; i < 400; i++) {
    const g = CALC[id](), all = [g.ans, ...g.wrong];
    ok(new Set(all).size === all.length, `${id}: duplicate options`);
    ok(g.wrong.length >= 3 || id === "gravity-masses", `${id}: needs at least 3 wrong options (got ${g.wrong.length})`);
    ok(typeof g.q === "string" && g.q.length > 20 && g.why.length > 20, `${id}: missing question or explanation`);
  }
}
// spot-check exact answers
const near = (a, b) => Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(b));
const k = CALC.kepler(); const m = k.q.match(/(\d+) AU/); ok(k.ans === `${(+m[1]) ** 1.5} years`, "kepler answer matches p = a^1.5");
const f = CALC.force(); const fm = f.q.match(/a ([\d,.]+) kg object.*of (\d+) m\/s/); ok(fm && f.ans.startsWith(String(+fm[1].replace(/,/g, "") * +fm[2]).replace(/\B(?=(\d{3})+(?!\d))/g, ",")), "force answer is m x a");
if (fails) { console.error(fails + " test(s) failed"); process.exit(1); }
console.log("all logic tests passed");
