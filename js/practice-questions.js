export function balancedQuestionSample(questions, count, shuffle, required = () => false) {
  const groups = new Map();
  for (const question of questions) {
    const key = question.lec || "";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(question);
  }

  const keys = shuffle([...groups.keys()]);
  const queues = new Map(keys.map((key) => [key, shuffle(groups.get(key).slice())]));
  const selected = [];
  while (selected.length < count) {
    let added = false;
    for (const key of keys) {
      const question = queues.get(key).pop();
      if (!question) continue;
      selected.push(question);
      added = true;
      if (selected.length === count) break;
    }
    if (!added) break;
  }
  const requiredQuestion = questions.find(required);
  if (requiredQuestion && selected.length && !selected.includes(requiredQuestion)) {
    const sameLecture = selected.findIndex((question) => question.lec === requiredQuestion.lec);
    if (sameLecture >= 0) selected[sameLecture] = requiredQuestion;
  }
  return shuffle(selected);
}
