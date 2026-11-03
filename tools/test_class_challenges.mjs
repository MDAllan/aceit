import { readFile } from "node:fs/promises";

const courses = {
  erth209: {
    count: 14,
    testId: "second-midterm",
    ids: ["def-31", "def-32", "def-33", "def-34", "eq-25", "str-26", "bio-24", "eq-26", "eq-27", "mm-17", "mm-18", "mm-19", "eq-28", "str-27"],
    volcanic: {
      count: 16,
      testId: "volcanic-eruptions",
      ids: ["ign-26", "ign-27", "ign-28", "ign-29", "ign-30", "ign-31", "ign-32", "ign-33", "ign-34", "ign-35", "ign-36", "ign-37", "ign-38", "ign-39", "ign-40", "ign-41"],
    },
  },
  astr207: {
    count: 12,
    testId: "challenge",
    ids: ["ts-40", "mo-49", "cv-30", "cv-31", "gr-50", "gr-51", "li-33", "li-34", "ma-44", "ma-45", "tel-25", "pln-25"],
  },
};

let fails = 0;
const ok = (condition, message) => {
  if (!condition) {
    fails++;
    console.error("FAIL:", message);
  }
};

for (const [courseId, expected] of Object.entries(courses)) {
  const subject = JSON.parse(await readFile(new URL("../content/subjects.json", import.meta.url), "utf8"))
    .find((item) => item.id === courseId);
  const questions = new Map();
  for (const lectureId of subject.lectures) {
    const lecture = JSON.parse(await readFile(new URL(`../content/${lectureId}.json`, import.meta.url), "utf8"));
    for (const question of lecture.quiz) questions.set(question.id, question);
  }
  const exam = JSON.parse(await readFile(new URL(`../content/exams-${courseId}.json`, import.meta.url), "utf8"));
  const test = exam.tests.find((item) => item.id === expected.testId);
  ok(test?.questionIds?.length === expected.count, `${courseId}: challenge test has ${expected.count} selected questions`);
  ok(JSON.stringify(test?.questionIds) === JSON.stringify(expected.ids), `${courseId}: challenge questions stay in the intended exam order`);
  for (const id of expected.ids) {
    const question = questions.get(id);
    ok(!!question, `${courseId}: ${id} is available in its course quiz pool`);
    if (!question) continue;
    ok(question.options.length === 5 && Number.isInteger(question.answer) &&
      question.answer >= 0 && question.answer < question.options.length && question.why?.length > 20,
    `${courseId}: ${id} has a valid answer and a useful explanation`);
  }
  if (expected.volcanic) {
    const volcanic = expected.volcanic;
    const test = exam.tests.find((item) => item.id === volcanic.testId);
    ok(test?.questionIds?.length === volcanic.count, `${courseId}: volcanic practice has ${volcanic.count} selected questions`);
    ok(JSON.stringify(test?.questionIds) === JSON.stringify(volcanic.ids), `${courseId}: volcanic questions stay in the intended exam order`);
    ok(new Set(volcanic.ids).size === volcanic.count, `${courseId}: volcanic practice question IDs are unique`);
    for (const id of volcanic.ids) {
      const question = questions.get(id);
      ok(!!question, `${courseId}: ${id} is available in its course quiz pool`);
      if (!question) continue;
      ok(question.options.length === 5 && Number.isInteger(question.answer) &&
        question.answer >= 0 && question.answer < question.options.length && question.why?.length > 20,
      `${courseId}: ${id} has a valid answer and a useful explanation`);
    }
  }
}

if (fails) process.exit(1);
console.log("Earth and astronomy challenge tests passed");
