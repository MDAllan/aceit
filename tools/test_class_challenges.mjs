import { readFile } from "node:fs/promises";

const courses = {
  erth209: {
    count: 14,
    testId: "second-midterm",
    ids: ["def-31", "def-32", "def-33", "def-34", "eq-25", "str-26", "bio-24", "eq-26", "eq-27", "mm-17", "mm-18", "mm-19", "eq-28", "str-27"],
    volcanic: {
      lectureId: "volcanic-eruptions",
      count: 16,
      testId: "volcanic-eruptions",
      ids: ["vol-1", "vol-2", "vol-3", "vol-4", "vol-5", "vol-6", "vol-7", "vol-8", "vol-9", "vol-10", "vol-11", "vol-12", "vol-13", "vol-14", "vol-15", "vol-16"],
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
    const lecture = JSON.parse(await readFile(new URL(`../content/${volcanic.lectureId}.json`, import.meta.url), "utf8"));
    const test = exam.tests.find((item) => item.id === volcanic.testId);
    ok(subject.lectures.includes(volcanic.lectureId), `${courseId}: volcanic eruptions is a course unit`);
    ok(lecture.learningObjectives.length >= 5, `${courseId}: volcanic unit has learning objectives`);
    ok(lecture.sections.length >= 6 && lecture.sections.every((section) => section.steps?.length),
      `${courseId}: volcanic unit has structured study notes`);
    ok(lecture.cards.length >= 15, `${courseId}: volcanic unit has enough cards for games`);
    ok(["match", "memory", "blitz", "guess", "speed"].every((game) => lecture.games.includes(game)),
      `${courseId}: volcanic unit offers the card-based study games`);
    ok(lecture.quiz.length === volcanic.count, `${courseId}: volcanic unit includes its chapter quiz`);
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
