export function speedQuestions(cards) {
  const unique = [], fronts = new Set(), descriptions = new Set();
  for (const card of cards || []) {
    if (!card || typeof card.front !== "string" || fronts.has(card.front) || !(card.short || card.back)) continue;
    const description = String(card.short || card.back).trim().toLowerCase();
    if (descriptions.has(description)) continue;
    fronts.add(card.front);
    descriptions.add(description);
    unique.push(card);
  }
  return unique.map((card, index) => {
    const distractors = unique.filter((_, i) => i !== index).slice(0, 3);
    return {
      q: "Which term best matches this description? " + (card.short || card.back),
      options: [card, ...distractors].map((choice) => choice.front),
      answer: 0,
    };
  }).filter((question) => question.options.length === 4);
}
