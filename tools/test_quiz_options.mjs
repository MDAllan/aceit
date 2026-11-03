import { readFileSync } from "node:fs";
import { prepareOptions } from "../js/quiz-options.js";

let fails = 0;
const ok = (condition, message) => {
  if (!condition) {
    fails++;
    console.error("FAIL:", message);
  }
};

let seed = 0x3052026;
const random = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 0x100000000;
};

const question = { id: "sample", options: ["Alpha", "Beta", "Gamma", "Delta", "All of the above", "None of the above"], answer: 0 };
const presented = prepareOptions(question, random);
ok(presented.options.slice(-2).map((option) => option.text).join("|") === "All of the above|None of the above", "all/none options stay last");
ok(presented.options[presented.answerIndex].id === "sample:0", "the correct option is located by its stable ID after shuffling");
ok(presented.options.map((option) => option.index).sort().join() === "0,1,2,3,4,5", "all original options remain present");

const letterReferenced = { id: "combo", options: ["A and B", "A only", "B only", "Neither"], answer: 0 };
const fixed = prepareOptions(letterReferenced, random);
ok(fixed.options.map((option) => option.text).join("|") === letterReferenced.options.join("|"), "letter-referenced options keep their original order");
ok(fixed.options[fixed.answerIndex].text === "A and B", "letter-referenced answer remains correct");
const singleLetterReference = { id: "single-letter", options: ["A only", "B only", "C only", "None"], answer: 0 };
ok(prepareOptions(singleLetterReference, random).options.map((option) => option.text).join("|") === singleLetterReference.options.join("|"), "single-letter answer references keep their original order");
const boneQuestion = JSON.parse(readFileSync(new URL("../content/skeletal.json", import.meta.url), "utf8")).quiz.find((q) => q.id === "skl-25");
const boneOptions = prepareOptions(boneQuestion, random);
ok(boneOptions.options.map((option) => option.text).join("|") === boneQuestion.options.join("|"), "BIOL 305 A/B combination options stay attached to their referenced statements");
ok(boneOptions.options[boneOptions.answerIndex].text === "Both A and B", "the BIOL 305 combination answer remains correctly keyed");

const positionCounts = Array(5).fill(0);
for (let run = 0; run < 500; run++) {
  const q = { ...question, id: `distribution-${run}`, options: ["A", "B", "C", "D", "E"], answer: 0 };
  positionCounts[prepareOptions(q, random).answerIndex]++;
}
ok(Math.max(...positionCounts) / positionCounts.reduce((sum, count) => sum + count, 0) < 0.3, "correct options are distributed across answer positions");

const subjects = JSON.parse(readFileSync(new URL("../content/subjects.json", import.meta.url), "utf8"));
for (const subject of subjects) {
  const counts = Array(26).fill(0);
  let total = 0;
  for (const lectureId of subject.lectures) {
    const data = JSON.parse(readFileSync(new URL(`../content/${lectureId}.json`, import.meta.url), "utf8"));
    for (const q of data.quiz || []) {
      const answerIndex = prepareOptions(q, random).answerIndex;
      if (answerIndex >= 0) {
        counts[answerIndex]++;
        total++;
      }
    }
  }
  if (subject.exams) {
    const exams = JSON.parse(readFileSync(new URL(`../content/${subject.exams}.json`, import.meta.url), "utf8"));
    for (const exam of exams.tests || []) for (const q of exam.questions || []) {
      const answerIndex = prepareOptions(q, random).answerIndex;
      if (answerIndex >= 0) {
        counts[answerIndex]++;
        total++;
      }
    }
  }
  const maxShare = Math.max(...counts) / total;
  ok(total > 20 && maxShare < 0.4, `${subject.name}: no single answer letter dominates the shuffled quiz and practice set (${Math.round(maxShare * 100)}%)`);
}

if (fails) process.exit(1);
console.log("quiz option tests passed");
