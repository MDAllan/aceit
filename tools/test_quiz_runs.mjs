const memory = {};
globalThis.localStorage = {
  getItem: (key) => memory[key] ?? null,
  setItem: (key, value) => { memory[key] = String(value); },
  removeItem: (key) => { delete memory[key]; },
};
globalThis.location = { hostname: "example.org", search: "", hash: "", pathname: "/", origin: "https://example.org" };
globalThis.addEventListener = () => {};

const S = await import("../js/store.js");
let fails = 0;
const ok = (condition, message) => {
  if (!condition) {
    fails++;
    console.error("FAIL:", message);
  }
};

const active = {
  title: "Practice exam",
  courseId: "biol305",
  questionIds: ["q1", "q2"],
  answers: { q1: 2 },
  index: 0,
  completed: false,
};
S.saveQuizRun("practice:biol305:all:2", active);
const stored = S.quizRun("practice:biol305:all:2");
ok(stored?.answers.q1 === 2 && stored.questionIds.join(",") === "q1,q2" && !stored.completed,
  "submitted answers and question order are saved for an unfinished run");
ok(JSON.parse(memory["erth209:progress:v1"]).quizRuns["practice:biol305:all:2"].answers.q1 === 2,
  "quiz runs persist in the existing local progress record");

const older = { ...active, updatedAt: "2026-01-01T00:00:00.000Z" };
const newer = { ...active, answers: { q1: 1 }, updatedAt: "2026-02-01T00:00:00.000Z" };
const merged = S.mergeProgress({ quizRuns: { run: older } }, { quizRuns: { run: newer, other: active } });
ok(merged.quizRuns.run.answers.q1 === 1 && merged.quizRuns.other.questionIds.length === 2,
  "the latest version of each in-progress run wins when local and cloud progress merge");
const completed = S.mergeProgress({ quizRuns: { run: { ...newer, completed: true, updatedAt: "2026-03-01T00:00:00.000Z" } } }, { quizRuns: { run: newer } });
ok(completed.quizRuns.run.completed, "completion status survives progress synchronization");

if (fails) process.exit(1);
console.log("quiz run tests passed");
