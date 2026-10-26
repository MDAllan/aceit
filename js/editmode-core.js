// Admin edit mode, the parts that need no page: JSON path helpers, the rules for what an admin may save (questions, flashcards, glossary
// terms, texts, pictures), id and history-text makers, and a plain-words description of what changed. No DOM and no imports from ui.js,
// so Node tests them (tools/test_editmode.mjs) and the page code (editmode.js) uses exactly the same rules.
import { checkTerm, inGlossary, termOf } from "./glossaryrules.js";

/* ---------- limits (the longest existing course text is well inside every one of them) ---------- */
export const LIMITS = {
  question: [3, 700], option: 300, optionsMin: 2, optionsMax: 5, why: 1500,
  front: 300, back: 1200, short: 160,
  bullet: 1500, title: 200, intro: 1500, box: 2000, alt: 400, topic: 64,
  body: 2000000, // bytes, the same limit as the database (admin_save_lecture)
};

/* ---------- paths into the lecture body ---------- */
// a path is an array (["sections", 0, "steps", 2]) or the same thing as one string ("sections.0.steps.2")
const UNSAFE = new Set(["__proto__", "prototype", "constructor"]);
export function toPath(p) {
  const a = Array.isArray(p) ? p.slice() : String(p ?? "").split(".").filter((x) => x !== "");
  for (const k of a) if (UNSAFE.has(String(k))) throw new Error("That path is not allowed.");
  return a;
}
const isIndex = (k) => typeof k === "number" || /^(0|[1-9]\d*)$/.test(String(k));
export function getAt(obj, path, fallback) {
  let cur = obj;
  for (const k of toPath(path)) { if (cur == null || typeof cur !== "object") return fallback; cur = cur[k]; }
  return cur === undefined ? fallback : cur;
}
// sets a value, making the lists and objects on the way when they are missing; answers the object
export function setAt(obj, path, value) {
  const a = toPath(path);
  if (!a.length) throw new Error("A path is needed.");
  let cur = obj;
  for (let i = 0; i < a.length - 1; i++) {
    const k = a[i];
    if (cur[k] == null || typeof cur[k] !== "object") cur[k] = isIndex(a[i + 1]) ? [] : {};
    cur = cur[k];
  }
  cur[a[a.length - 1]] = value;
  return obj;
}
// removes what is at the path (an entry of a list is spliced out so no hole is left); answers the removed value
export function removeAt(obj, path) {
  const a = toPath(path);
  if (!a.length) return undefined;
  const parent = getAt(obj, a.slice(0, -1));
  if (parent == null || typeof parent !== "object") return undefined;
  const k = a[a.length - 1];
  if (Array.isArray(parent) && isIndex(k)) return +k < parent.length ? parent.splice(+k, 1)[0] : undefined;
  const old = parent[k]; delete parent[k]; return old;
}
// puts a value into the list at the path, at an index (clamped to the list)
export function insertAt(obj, path, index, value) {
  let list = getAt(obj, path);
  if (!Array.isArray(list)) { setAt(obj, path, []); list = getAt(obj, path); }
  const i = Math.max(0, Math.min(list.length, Number.isFinite(index) ? index : list.length));
  list.splice(i, 0, value);
  return i;
}
// moves the entry at `from` to `to` inside a list; false when either place is outside it
export function moveWithin(list, from, to) {
  if (!Array.isArray(list) || from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return false;
  list.splice(to, 0, list.splice(from, 1)[0]);
  return true;
}

/* ---------- text rules ---------- */
// control and invisible formatting characters are never saved (a leading U+2063 would also switch off the student-safe text filter)
const BAD_CHAR = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u;
export function hasBadChar(s, multiline = false) {
  let t = String(s ?? "");
  t = multiline ? t.replace(/[\n\t]/g, "") : t.replace(/\t/g, "");
  return BAD_CHAR.test(t);
}
// text as it will be kept: line ends made the same; a single-line text loses its line breaks
export function tidyText(s, multiline = false) {
  let t = String(s ?? "").replace(/\r\n?/g, "\n");
  if (multiline) t = t.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n");
  else t = t.replace(/\s*\n\s*/g, " ").replace(/\t/g, " ").replace(/ {2,}/g, " ");
  return t.trim();
}
// { ok, value } or { ok: false, why }
export function checkText(raw, { required = false, min = 0, max = 2000, multiline = false, name = "This text" } = {}) {
  const value = tidyText(raw, multiline);
  if (hasBadChar(value, multiline)) return { ok: false, why: `${name} has a character that cannot be saved. Remove it and try again.` };
  if (!value) return required ? { ok: false, why: `${name} cannot be empty.` } : { ok: true, value };
  if (value.length < min) return { ok: false, why: `${name} needs at least ${min} characters.` };
  if (value.length > max) return { ok: false, why: `${name} is ${value.length} characters. The most is ${max}.` };
  return { ok: true, value };
}
export const clip = (s, n) => { const t = String(s ?? ""); return t.length <= n ? t : t.slice(0, Math.max(0, n - 3)).replace(/\s+\S*$/, "") + "..."; };
// the text without the **bold** and *italic* marks, on one line (for labels and history lines)
export const plain = (s) => tidyText(String(s ?? "").replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1"));
// a short version of a card's back for the matching games
export const autoShort = (back) => clip(plain(back).split(/(?<=[.!?])\s/)[0] || plain(back), 60);

/* ---------- questions ---------- */
// q: { q, options (the texts), answer (index), why, topic }   ctx: { sectionIds } to check a topic
// answers { ok, errors, value }; errors has q, options, option (a list, one message or "" per option), answer, why, topic
export function checkQuestion(q, ctx = {}) {
  const errors = {}, optionErrs = [];
  const text = checkText(q?.q, { required: true, min: LIMITS.question[0], max: LIMITS.question[1], multiline: true, name: "The question" });
  if (!text.ok) errors.q = text.why;
  const raw = Array.isArray(q?.options) ? q.options : [], options = [], seen = new Map();
  raw.forEach((o, i) => {
    const t = checkText(o, { required: true, max: LIMITS.option, name: `Option ${"ABCDE"[i] || i + 1}` });
    optionErrs[i] = t.ok ? "" : t.why;
    if (t.ok) {
      const key = t.value.toLowerCase();
      if (seen.has(key)) optionErrs[i] = `Option ${"ABCDE"[i] || i + 1} is the same as option ${"ABCDE"[seen.get(key)]}. Each option must be different.`;
      else seen.set(key, i);
      options.push(t.value);
    } else options.push(String(o ?? ""));
  });
  if (raw.length < LIMITS.optionsMin) errors.options = `Add at least ${LIMITS.optionsMin} answer options.`;
  else if (raw.length > LIMITS.optionsMax) errors.options = `Use at most ${LIMITS.optionsMax} answer options.`;
  else if (optionErrs.some(Boolean)) errors.options = optionErrs.find(Boolean);
  const a = q?.answer;
  if (!Number.isInteger(a) || a < 0 || a >= raw.length) errors.answer = "Choose which option is the correct answer.";
  else if (optionErrs[a] && /empty/.test(optionErrs[a])) errors.answer = "The option marked as correct is empty.";
  const why = checkText(q?.why, { max: LIMITS.why, multiline: true, name: "The explanation" });
  if (!why.ok) errors.why = why.why;
  let topic = "";
  if (q?.topic != null && String(q.topic) !== "") {
    topic = String(q.topic);
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(topic) || (Array.isArray(ctx.sectionIds) && !ctx.sectionIds.includes(topic))) errors.topic = "Choose one of the topics of this lecture, or no topic.";
  }
  const ok = !Object.keys(errors).length;
  const value = { q: text.value ?? "", options, answer: a, why: why.value ?? "" };
  if (topic) value.topic = topic;
  return { ok, errors, optionErrs, value };
}

/* ---------- flashcards and glossary terms ---------- */
export function checkCard(c) {
  const errors = {};
  const front = checkText(c?.front, { required: true, max: LIMITS.front, name: "The front of the card" });
  const back = checkText(c?.back, { required: true, max: LIMITS.back, multiline: true, name: "The back of the card" });
  const short = checkText(c?.short, { max: LIMITS.short, name: "The short version" });
  if (!front.ok) errors.front = front.why;
  if (!back.ok) errors.back = back.why;
  if (!short.ok) errors.short = short.why;
  const value = { front: front.value ?? "", back: back.value ?? "", short: short.value ? short.value : autoShort(back.value ?? "") };
  return { ok: !Object.keys(errors).length, errors, value };
}
// a glossary entry: a term (the glossary rule, and not one the class already has) and what it means
// existing: the terms the glossary already shows (the one being edited is left out by the caller)
export function checkGlossaryEntry(e, existing = []) {
  const errors = {};
  const term = checkText(e?.term, { required: true, max: 60, name: "The term" });
  if (!term.ok) errors.term = term.why;
  else {
    const rule = checkTerm(term.value);
    if (!rule.ok) errors.term = rule.why;
    else if (existing.some((t) => String(t).trim().toLowerCase() === term.value.toLowerCase())) errors.term = "That term is already in the glossary.";
  }
  const def = checkText(e?.definition, { required: true, max: LIMITS.back, multiline: true, name: "The meaning" });
  if (!def.ok) errors.definition = def.why;
  return { ok: !Object.keys(errors).length, errors, value: { term: term.value ?? "", definition: def.value ?? "" } };
}
// what an edited card becomes: a card that was listed in the glossary and whose term no longer passes the rule stays a flashcard
// (gloss:false). Answers { card, notice } where notice is a sentence for the admin, or "".
export function applyCardEdit(card, fields) {
  const next = { ...card, front: fields.front, back: fields.back, short: fields.short };
  let notice = "";
  const wasListed = inGlossary(card);
  if (next.gloss !== false && !checkTerm(termOf(next)).ok) {
    next.gloss = false;
    if (wasListed) notice = `It is no longer a glossary term (${checkTerm(termOf(next)).why}). It stays a flashcard and leaves the glossary.`;
  }
  return { card: next, notice };
}
// a new flashcard; gloss is true only when its term passes the glossary rule
export function newCard(fields, id, { glossary = false } = {}) {
  const c = { id, front: fields.front, back: fields.back, short: fields.short || autoShort(fields.back) };
  if (glossary) c.gloss = true;
  else if (!checkTerm(termOf(c)).ok) c.gloss = false;
  return c;
}

/* ---------- pictures ---------- */
export function checkAlt(raw) {
  return checkText(raw, { required: true, max: LIMITS.alt, name: "The picture description" });
}
export const COURSE_IMAGE_PATH = /^[A-Za-z0-9_-]{1,64}[/][A-Za-z0-9_-]{8,64}[.](webp|jpg|png)$/;

/* ---------- ids ---------- */
const B36 = "0123456789abcdefghijklmnopqrstuvwxyz";
// the part of a lecture's ids before the first dash that most ids share ("def" for def-c1, def-c2...), otherwise the lecture id
export function idPrefix(ids, fallback = "x") {
  const n = new Map();
  for (const id of ids || []) { const p = String(id).split("-")[0]; if (/^[A-Za-z0-9_]{1,24}$/.test(p) && p !== String(id)) n.set(p, (n.get(p) || 0) + 1); }
  let best = "", most = 0;
  for (const [p, c] of n) if (c > most) { best = p; most = c; }
  return best || String(fallback).replace(/[^A-Za-z0-9_]/g, "").slice(0, 24) || "x";
}
// <prefix>-a<time in base 36><random>, never one of the ids in `taken` (a Set or a list); the caller adds the new id to its list
export function makeId(prefix, taken = [], { now = Date.now, rand = Math.random } = {}) {
  const used = taken instanceof Set ? taken : new Set(taken);
  const p = String(prefix || "x").replace(/[^A-Za-z0-9_]/g, "").slice(0, 24) || "x", t = Math.floor(now()).toString(36);
  for (let n = 0; n < 2000; n++) {
    let r = ""; const len = 4 + Math.floor(n / 20);
    for (let i = 0; i < len; i++) r += B36[Math.floor(rand() * 36) % 36];
    const id = `${p}-a${t}${r}`;
    if (!used.has(id)) return id;
  }
  throw new Error("Could not make a new id.");
}

/* ---------- history text ---------- */
const VERBS = {
  "edit-text": "Edited", "edit-title": "Edited the topic title", "edit-intro": "Edited the introduction", "edit-bullet": "Edited a point", "edit-box": "Edited a box",
  "add-bullet": "Added a point", "delete-bullet": "Deleted a point", "move-bullet": "Moved a point",
  "add-step": "Added a picture step", "delete-step": "Deleted a picture step",
  "replace-picture": "Replaced a picture", "add-picture": "Added a picture", "remove-picture": "Removed a picture", "edit-alt": "Changed a picture description",
  "add-topic": "Added a topic", "delete-topic": "Deleted a topic",
  "add-question": "Added a question", "edit-question": "Edited a question", "delete-question": "Deleted a question",
  "add-card": "Added a flashcard", "edit-card": "Edited a flashcard", "delete-card": "Deleted a flashcard",
  "add-term": "Added a glossary term", "edit-term": "Edited a glossary term", "delete-term": "Deleted a glossary term", "hide-term": "Removed a term from the glossary",
};
// the line shown in the change history: "Edited a point: Stress is force per unit..." (200 characters at most, the database limit)
export function summaryFor(action, detail = "") {
  const verb = VERBS[action] || "Edited", d = clip(plain(detail).replace(/[\p{Cc}\p{Cf}]/gu, ""), 110);
  return clip(d ? `${verb}: ${d}` : verb, 200);
}
const plural = (n, one, many = one + "s") => `${n} ${n === 1 ? one : many}`;
// "Added 1 question; changed 2 flashcards" from two lecture bodies (lists are compared by id)
export function describeChange(before, after) {
  const parts = [];
  const diff = (key, one, many) => {
    const a = new Map((before?.[key] || []).map((x) => [x.id, JSON.stringify(x)])), b = new Map((after?.[key] || []).map((x) => [x.id, JSON.stringify(x)]));
    let add = 0, del = 0, chg = 0;
    for (const [id, s] of b) { if (!a.has(id)) add++; else if (a.get(id) !== s) chg++; }
    for (const id of a.keys()) if (!b.has(id)) del++;
    if (add) parts.push(`added ${plural(add, one, many)}`);
    if (del) parts.push(`deleted ${plural(del, one, many)}`);
    if (chg) parts.push(`changed ${plural(chg, one, many)}`);
  };
  diff("sections", "topic"); diff("cards", "flashcard"); diff("quiz", "question");
  for (const k of ["title", "chapter", "intro"]) if ((before?.[k] ?? "") !== (after?.[k] ?? "")) parts.push(`changed the ${k}`);
  if (!parts.length) return JSON.stringify(before) === JSON.stringify(after) ? "No changes" : "Edited";
  const s = parts.join("; ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ---------- the whole lecture, before it is sent ---------- */
export const byteSize = (body) => (typeof TextEncoder === "function" ? new TextEncoder().encode(JSON.stringify(body)).length : JSON.stringify(body).length);
// the same checks the database makes, with wording an admin can act on
export function checkBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, why: "The lecture is not valid." };
  for (const k of ["sections", "cards", "quiz"]) if (k in body && !Array.isArray(body[k])) return { ok: false, why: `The "${k}" part of the lecture must be a list.` };
  if (!Array.isArray(body.sections) || body.sections.length < 1) return { ok: false, why: "A lecture needs at least one topic." };
  for (const k of ["sections", "cards", "quiz"]) {
    const ids = (body[k] || []).map((x) => x?.id);
    if (ids.some((id) => typeof id !== "string" || !id)) return { ok: false, why: `Every item in "${k}" needs an id.` };
    if (new Set(ids).size !== ids.length) return { ok: false, why: `Two items in "${k}" have the same id.` };
  }
  if (byteSize(body) > LIMITS.body) return { ok: false, why: "This lecture is too large to save (the limit is 2 MB)." };
  return { ok: true };
}
// a topic can be deleted unless it is the last one
export function canDeleteSection(body) {
  return (body?.sections?.length || 0) > 1 ? { ok: true } : { ok: false, why: "A lecture needs at least one topic, so the last one cannot be deleted. Add another topic first." };
}
