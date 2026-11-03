import { readFile } from "node:fs/promises";

const files = ["digestive", "respiratory", "cardio"];
const quizzes = new Map();
for (const file of files) {
  const content = JSON.parse(await readFile(new URL(`../content/${file}.json`, import.meta.url), "utf8"));
  for (const question of content.quiz) quizzes.set(question.id, question);
}

const expected = new Map([
  ["gi-31", "Segmentation"],
  ["gi-32", "Parietal cells"],
  ["gi-33", "Bile"],
  ["gi-34", "Chemical digestion"],
  ["gi-35", "identical in every person"],
  ["gi-36", "None of the above"],
  ["rs-31", "both bronchi and bronchioles"],
  ["rs-32", "Both A and B"],
  ["rs-33", "PO₂ of oxygenated blood is higher"],
  ["cs-31", "O+"],
  ["cs-32", "Into the left atrium"],
  ["cs-33", "de novo from blood islands"],
]);
let fails = 0;
for (const [id, answer] of expected) {
  const question = quizzes.get(id);
  const correct = question && question.options[question.answer];
  if (!question || question.options.length !== 6 || !correct.toLowerCase().includes(answer.toLowerCase()) || !question.why) {
    fails++;
    console.error(`FAIL: ${id} is missing, malformed, or has the wrong answer/explanation`);
  }
}
if (quizzes.size < expected.size) {
  fails++;
  console.error("FAIL: expected quiz questions are not all in the biology lecture pools");
}

if (fails) process.exit(1);
console.log("BIOL 305 quiz key tests passed");
