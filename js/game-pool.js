function shuffle(items) {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function createReviewPool() {
  const used = new Set();
  const missed = new Set();

  return {
    draw(items, size, idOf = (item) => item.id) {
      const available = items.filter((item) => idOf(item) != null);
      const ids = new Set(available.map(idOf));
      for (const id of used) if (!ids.has(id)) used.delete(id);
      for (const id of missed) if (!ids.has(id)) missed.delete(id);

      const review = shuffle(available.filter((item) => missed.has(idOf(item))));
      let fresh = shuffle(available.filter((item) => !used.has(idOf(item)) && !missed.has(idOf(item))));
      if (!review.length && !fresh.length) {
        used.clear();
        fresh = shuffle(available);
      }

      const selected = [...review, ...fresh].slice(0, Math.min(size, available.length));
      for (const item of selected) {
        const id = idOf(item);
        used.add(id);
        missed.delete(id);
      }
      return selected;
    },
    markMissed(id) {
      if (id != null) missed.add(id);
    },
  };
}

export function uniquePairs(cards) {
  const fronts = new Set(), meanings = new Set();
  return (cards || []).filter((card) => {
    if (!card || typeof card.front !== "string" || !(card.short || card.back)) return false;
    const front = card.front.trim().toLowerCase();
    const meaning = String(card.short || card.back).trim().toLowerCase();
    if (!front || !meaning || fronts.has(front) || meanings.has(meaning)) return false;
    fronts.add(front);
    meanings.add(meaning);
    return true;
  });
}
