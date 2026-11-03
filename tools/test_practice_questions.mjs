import { balancedQuestionSample } from "../js/practice-questions.js";

let seed = 305;
const random = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 0x100000000;
};
const shuffle = (items) => {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};
const questions = ["unit-a", "unit-b"].flatMap((lec) => Array.from({ length: 30 }, (_, i) => ({ id: `${lec}-${i}`, lec })));
const selected = balancedQuestionSample(questions, 20, shuffle);
const count = (lec) => selected.filter((question) => question.lec === lec).length;
if (selected.length !== 20 || count("unit-a") !== 10 || count("unit-b") !== 10) {
  console.error("FAIL: 20-question practice samples are not balanced across selected units", count("unit-a"), count("unit-b"));
  process.exit(1);
}
const eightUnits = Array.from({ length: 8 }, (_, unit) => Array.from({ length: 30 }, (_, i) => ({ id: `${unit}-${i}`, lec: `unit-${unit}`, options: [] }))).flat();
const required = eightUnits.find((question) => question.id === "0-29");
required.options = ["A only", "Both A and B"];
const cumulative = balancedQuestionSample(eightUnits, 24, shuffle, (question) => question.options.includes("Both A and B"));
if (cumulative.length !== 24 || Array.from({ length: 8 }, (_, unit) => cumulative.filter((question) => question.lec === `unit-${unit}`).length).some((amount) => amount !== 3) || !cumulative.includes(required)) {
  console.error("FAIL: cumulative practice does not take three questions from each of eight units");
  process.exit(1);
}
console.log("practice question tests passed");
