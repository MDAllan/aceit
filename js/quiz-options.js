const SPECIAL_OPTION = /\b(?:all|none)\s+of\s+(?:the\s+)?(?:above|these)\b/i;
const LETTER_REFERENCE = /\b(?:both\s+)?[A-E](?:\s*(?:and|or|&|,)\s*[A-E])+\b|\b(?:[A-E]\s+only|only\s+[A-E])\b/i;

export function prepareOptions(question, random = Math.random) {
  const options = (question.options || []).map((text, index) => ({ id: `${question.id || "question"}:${index}`, text, index }));
  if (options.some((option) => LETTER_REFERENCE.test(option.text))) {
    return { options, answerIndex: options.findIndex((option) => option.index === question.answer) };
  }

  const special = options.filter((option) => SPECIAL_OPTION.test(option.text));
  const regular = options.filter((option) => !SPECIAL_OPTION.test(option.text));
  for (let i = regular.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [regular[i], regular[j]] = [regular[j], regular[i]];
  }
  const presented = [...regular, ...special];
  return { options: presented, answerIndex: presented.findIndex((option) => option.index === question.answer) };
}
