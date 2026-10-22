// What may appear in a class glossary: terms, vocabulary and names only. Pure functions (no DOM) so the app, the admin editor and the tests
// all use the same rule. A flashcard stays a flashcard whatever its front says; it is listed in the glossary only when its term passes.
export const MAX_WORDS = 4, MAX_CHARS = 60;
// first words that make an entry a question, an instruction or a phrase instead of a term
const OPENERS = new Set(["what", "why", "how", "when", "where", "which", "who", "whom", "whose", "name", "define", "explain", "describe", "list", "give", "state", "compare", "is", "are", "does", "do", "can", "should", "would", "will"]);

const words = (t) => t.trim().split(/\s+/).filter(Boolean);
// an entry that names a process, an explanation or a comparison is not a term ("Cancer process", "Mitosis vs meiosis")
const PROCESSY = /(?:process|processes|procedure|procedures|steps|stages of|explanation|overview|summary|introduction|comparison|difference|differences)$/i;
const VERSUS = /(?:^|\s)(?:vs[.]?|versus)(?:\s|$)/i;

// { ok: true } or { ok: false, why: "..." } with a reason a person can read
export function checkTerm(raw) {
  const t = String(raw ?? "").replace(/\*\*/g, "").trim();
  if (!t) return { ok: false, why: "Enter a term." };
  if (t.includes("?")) return { ok: false, why: "A glossary entry is a term, not a question. Remove the question mark and use just the word or name." };
  const w = words(t);
  if (OPENERS.has(w[0].toLowerCase().replace(/[^a-z]/g, ""))) return { ok: false, why: `"${w[0]}" starts a question or instruction. A glossary entry is only a term, a piece of vocabulary or a name.` };
  if (w.length > MAX_WORDS) return { ok: false, why: `That is ${w.length} words. A glossary term is at most ${MAX_WORDS} words (for example "Mesoderm", "Metastasis", "Rough ER").` };
  if (t.length > MAX_CHARS) return { ok: false, why: `Keep a glossary term under ${MAX_CHARS} characters.` };
  if (/[.!;:]$/.test(t)) return { ok: false, why: "A glossary term is not a sentence. Remove the punctuation at the end." };
  if (PROCESSY.test(t)) return { ok: false, why: "That names a process or an explanation, not a term. Use the name of the thing itself (for example \"Metastasis\" instead of \"Cancer process\")." };
  if (VERSUS.test(t)) return { ok: false, why: "A comparison is not a term. Add each term on its own." };
  return { ok: true };
}
export const isTerm = (t) => checkTerm(t).ok;

// the word or name a card is listed under: an explicit `term` wins, otherwise the front of the card
export const termOf = (card) => String(card.term ?? card.front ?? "").trim();
export const inGlossary = (card) => card.gloss !== false && isTerm(termOf(card));

// every glossary entry of some lectures, A to Z: { lec, card, term, def }
export function glossaryFor(lectures) {
  const seen = new Set(), out = [];
  for (const lec of lectures) for (const card of lec.cards || []) {
    if (!inGlossary(card)) continue;
    const term = termOf(card), key = term.toLowerCase();
    if (seen.has(key)) continue; // the same word on two lectures is listed once
    seen.add(key); out.push({ lec, card, term, def: card.back });
  }
  return out.sort((a, b) => a.term.localeCompare(b.term, undefined, { sensitivity: "base" }));
}
export const letterOf = (term) => (term.replace(/[^A-Za-z0-9]/g, "").slice(0, 1).toUpperCase() || "#");
