import { createReviewPool, uniquePairs } from "../js/game-pool.js";

let fails = 0;
const ok = (condition, message) => {
  if (!condition) {
    fails++;
    console.error("FAIL:", message);
  }
};

const cards = Array.from({ length: 18 }, (_, i) => ({ id: `card-${i}` }));
const pool = createReviewPool();
const rounds = [pool.draw(cards, 6), pool.draw(cards, 6), pool.draw(cards, 6)];
for (let i = 0; i < rounds.length; i++) {
  ok(rounds[i].length === 6, `round ${i + 1} has six cards`);
  for (let j = 0; j < i; j++) {
    ok(!rounds[i].some((card) => rounds[j].some((prior) => prior.id === card.id)), `round ${i + 1} avoids cards from round ${j + 1}`);
  }
}
ok(new Set(rounds.flat().map((card) => card.id)).size === cards.length, "three Play Again rounds use the full pool before repeating");

const missed = rounds[0][0];
pool.markMissed(missed.id);
const review = pool.draw(cards, 6);
ok(review.some((card) => card.id === missed.id), "missed cards return for review before the full pool resets");

const shortPool = pool.draw(cards.slice(0, 3), 6);
ok(shortPool.length === 3, "small topics produce the largest valid round");
const resetRound = pool.draw(cards, 6);
ok(resetRound.length === 6 && new Set(resetRound.map((card) => card.id)).size === 6, "the used pool resets without duplicate cards inside a round");
ok(uniquePairs([
  { id: "a", front: "Ca²⁺", short: "Binds troponin" },
  { id: "b", front: "Ca²⁺ elsewhere", short: "Binds troponin" },
  { id: "c", front: "Type II alveolar cells", short: "Secrete surfactant" },
]).length === 2, "duplicate terms or meanings are excluded from matching boards");

if (fails) process.exit(1);
console.log("game pool tests passed");
