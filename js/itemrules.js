// What an instructor may add to their class, and the rules each kind of item must follow.
// The database enforces the same rules (item_problem in supabase/patch7.sql). tools/test_sql.mjs feeds both the same examples and fails
// if they ever disagree, so these two cannot drift apart. No browser code in this file: it is also run by the tests.

export const KINDS = ["lecture", "note", "card", "question", "announcement"];
export const KIND_NAME = { lecture: "lecture", note: "note", card: "flashcard", question: "question", announcement: "announcement" };
export const LIMITS = { itemsPerClass: 600, itemsPerLecture: 200 };
// icons an instructor can give their own lecture
export const ICONS = ["\u{1F4D8}", "\u{1F4D7}", "\u{1F4D9}", "\u{1F4D5}", "\u{1F9EA}", "\u{1F52C}", "\u{1F30D}", "\u{1F4D0}", "\u{1F4CA}", "\u{1F9E0}", "\u{1F4A1}", "\u{1F3AF}", "\u{1F50E}", "\u{1F3DB}️"];

// text written by an instructor is stored without this invisible marker; the app adds it when showing the text (see classcontent.js)
export const MARK = String.fromCharCode(0x2063);

const FORBIDDEN = /[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]/; // control characters (tab, new line and return are fine)
const trim = (s) => s.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, "");
const count = (s) => Array.from(s).length; // characters, counted the way the database counts them

// a string that is clean and between lo and hi characters long once the ends are trimmed
export const text = (v, lo, hi) => typeof v === "string" && !FORBIDDEN.test(v) && !v.includes(MARK) && count(trim(v)) >= lo && count(trim(v)) <= hi;
const only = (b, keys) => Object.keys(b).every((k) => keys.includes(k));
const has = (b, k) => Object.prototype.hasOwnProperty.call(b, k);
const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

export const imageOk = (v) => isObject(v) && only(v, ["path", "alt"]) && text(v.path, 5, 200) && text(v.alt, 1, 200);

// the first thing wrong with an item, in words an instructor can act on, or null when it is fine
export function problem(kind, b) {
  if (!isObject(b)) return "That is not a valid item.";
  if (kind === "question") {
    if (!only(b, ["q", "options", "answer", "why", "img"])) return "This question has fields that are not allowed.";
    if (!text(b.q, 3, 700)) return "Write the question (3 to 700 characters).";
    if (!Array.isArray(b.options)) return "Add the answer options.";
    const n = b.options.length;
    if (n < 2 || n > 5) return "Use 2 to 5 answer options.";
    const seen = new Set();
    for (const o of b.options) {
      if (!text(o, 1, 300)) return "Each answer option needs 1 to 300 characters.";
      const k = trim(o).toLowerCase();
      if (seen.has(k)) return "Two answer options are the same.";
      seen.add(k);
    }
    if (!Number.isInteger(b.answer) || b.answer < 0 || b.answer >= n) return "Mark which option is correct.";
    if (has(b, "why") && !text(b.why, 0, 800)) return "The explanation can be up to 800 characters.";
    if (has(b, "img") && !imageOk(b.img)) return "The picture needs a description for people who cannot see it.";
    return null;
  }
  if (kind === "card") {
    if (!only(b, ["front", "back", "short"])) return "This flashcard has fields that are not allowed.";
    if (!text(b.front, 1, 200)) return "Write the front of the card (up to 200 characters).";
    if (!text(b.back, 1, 800)) return "Write the back of the card (up to 800 characters).";
    if (has(b, "short") && !text(b.short, 0, 100)) return "The short version can be up to 100 characters.";
    return null;
  }
  if (kind === "note") {
    if (!only(b, ["title", "bullets", "img"])) return "This note has fields that are not allowed.";
    if (!text(b.title, 1, 150)) return "Give the note a title (up to 150 characters).";
    if (has(b, "bullets")) {
      if (!Array.isArray(b.bullets) || b.bullets.length > 15) return "A note can have up to 15 points.";
      if (!b.bullets.every((x) => text(x, 1, 500))) return "Each point needs 1 to 500 characters.";
    }
    if (has(b, "img") && !imageOk(b.img)) return "The picture needs a description for people who cannot see it.";
    return null;
  }
  if (kind === "lecture") {
    if (!only(b, ["title", "chapter", "icon", "intro"])) return "This lecture has fields that are not allowed.";
    if (!text(b.title, 1, 100)) return "Give the lecture a title (up to 100 characters).";
    if (has(b, "chapter") && !text(b.chapter, 0, 60)) return "The label can be up to 60 characters.";
    if (has(b, "icon") && !text(b.icon, 1, 8)) return "Pick an icon.";
    if (has(b, "intro") && !text(b.intro, 0, 600)) return "The introduction can be up to 600 characters.";
    return null;
  }
  if (kind === "announcement") {
    if (!only(b, ["title", "text", "until"])) return "This announcement has fields that are not allowed.";
    if (!text(b.title, 1, 120)) return "Give the announcement a title (up to 120 characters).";
    if (has(b, "text") && !text(b.text, 0, 1500)) return "The message can be up to 1500 characters.";
    if (has(b, "until")) {
      const s = b.until;
      if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s) || s < "2000-01-01" || s > "2100-12-31") return "Choose a valid last day to show it.";
      const d = new Date(s + "T00:00:00Z");
      if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) return "Choose a valid last day to show it.";
    }
    return null;
  }
  return "Unknown kind of item.";
}

// tidy what an editor collected: trim the ends of every text and drop optional fields that are empty
export function tidy(kind, b) {
  const t = (v) => (typeof v === "string" ? trim(v) : v), out = {};
  const put = (k, v, optional) => { if (v === undefined || v === null) return; if (optional && (v === "" || (Array.isArray(v) && !v.length))) return; out[k] = v; };
  if (kind === "question") { put("q", t(b.q)); put("options", (b.options || []).map(t)); put("answer", b.answer); put("why", t(b.why), true); }
  if (kind === "card") { put("front", t(b.front)); put("back", t(b.back)); put("short", t(b.short), true); }
  if (kind === "note") { put("title", t(b.title)); put("bullets", (b.bullets || []).map(t).filter((x) => x !== ""), true); }
  if (kind === "lecture") { put("title", t(b.title)); put("chapter", t(b.chapter), true); put("icon", b.icon, true); put("intro", t(b.intro), true); }
  if (kind === "announcement") { put("title", t(b.title)); put("text", t(b.text), true); put("until", b.until, true); }
  if (b.img && b.img.path) out.img = { path: b.img.path, alt: t(b.img.alt || "") };
  return out;
}

// a short line to show in lists
export function summary(kind, b) {
  const first = (s) => String(s || "").split("\n")[0].trim();
  const cut = (s, n = 90) => (Array.from(s).length > n ? Array.from(s).slice(0, n - 1).join("") + "…" : s);
  if (kind === "question") return cut(first(b.q));
  if (kind === "card") return cut(first(b.front));
  return cut(first(b.title));
}
