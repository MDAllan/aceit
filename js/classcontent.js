// Turns the things instructors added to their classes (rows of class_items) into what the study screens already understand:
// extra notes, flashcards and questions for the course's own lectures, whole lectures of the class, and announcements.
// No browser code here: the tests run it too.
import { MARK } from "./itemrules.js";

// Text an instructor wrote starts with an invisible marker. The study screens remove sentences that talk about where the course
// material came from (slides, textbook...); the marker tells them to leave an instructor's own words alone.
export const mark = (t) => (typeof t === "string" && t ? MARK + t : t);
export const isMarked = (t) => typeof t === "string" && t.charCodeAt(0) === MARK.charCodeAt(0);

const hex = (id, n) => String(id).replace(/-/g, "").slice(0, n);
export const lectureId = (itemId) => "c" + hex(itemId, 12);  // id of an instructor's own lecture in progress and in addresses
export const itemId = (id) => "cx" + hex(id, 10);             // id of a note, card or question
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const clip = (s, n) => (Array.from(s).length > n ? Array.from(s).slice(0, n - 1).join("") + "…" : s);
export const OWN_GAMES = ["match", "memory", "blitz", "guess", "speed"];

// items: rows of class_items { id, class_id, kind, lecture_ref, position, status, body, author_name, updated_at }
// classes: the person's classes { class_id, course_id, name, role }   role: student | teacher | manager
// opts: { showDrafts: instructors also see items that are not published yet (marked as drafts), today: "YYYY-MM-DD" }
export function buildExtras(items, classes, opts = {}) {
  const today = opts.today || new Date().toISOString().slice(0, 10);
  const mine = new Map(classes.filter((c) => c.role !== "manager").map((c) => [c.class_id, c])); // a manager's own study is not mixed with every class of the school
  const order = new Map([...mine.keys()].map((k, i) => [k, i]));
  const shown = (it) => { const c = mine.get(it.class_id); return !!c && (it.status === "published" || (!!opts.showDrafts && c.role === "teacher")); };
  const sorted = items.filter(shown).sort((a, b) => (order.get(a.class_id) - order.get(b.class_id)) || ((a.position || 0) - (b.position || 0)) || String(a.created_at || a.updated_at || "").localeCompare(String(b.created_at || b.updated_at || "")));
  const out = { lectures: [], extra: {}, announcements: [] };
  const flag = (it, o) => (it.status === "published" ? o : { ...o, draft: true });

  const lecs = new Map();
  for (const it of sorted.filter((x) => x.kind === "lecture")) {
    const c = mine.get(it.class_id), b = it.body || {};
    const l = flag(it, { id: lectureId(it.id), itemId: it.id, title: mark(b.title), chapter: mark(b.chapter || c.name), icon: b.icon || "\u{1F4D8}", intro: mark(b.intro || ""), subject: c.course_id,
      custom: true, classId: it.class_id, className: c.name, sections: [], cards: [], quiz: [], games: OWN_GAMES.slice(), _full: true });
    lecs.set(it.id, l); out.lectures.push(l);
  }
  const target = (it) => {
    const ref = it.lecture_ref;
    if (UUID.test(ref || "")) { const l = lecs.get(ref); return l && l.classId === it.class_id ? l : null; }
    return (out.extra[ref] ||= { sections: [], cards: [], quiz: [] });
  };
  for (const it of sorted) {
    const b = it.body || {};
    if (it.kind === "note") {
      const t = target(it); if (!t) continue;
      const pts = (b.bullets || []).map(mark), s = flag(it, { id: itemId(it.id), title: mark(b.title), bullets: pts, custom: true });
      if (b.img) { s.bullets = []; s.steps = [{ img: { path: b.img.path, alt: b.img.alt }, title: "", bullets: pts }]; }
      t.sections.push(s);
    } else if (it.kind === "card") {
      const t = target(it); if (!t) continue;
      t.cards.push(flag(it, { id: itemId(it.id), front: mark(b.front), back: mark(b.back), short: mark(b.short || clip(b.back, 60)), custom: true }));
    } else if (it.kind === "question") {
      const t = target(it); if (!t) continue;
      const q = flag(it, { id: itemId(it.id), q: mark(b.q), options: b.options.map(mark), answer: b.answer, why: mark(b.why || ""), source: "Added by the instructor", custom: true });
      if (b.img) q.img = { path: b.img.path, alt: b.img.alt };
      t.quiz.push(q);
    } else if (it.kind === "announcement") {
      if (b.until && b.until < today) continue;
      const c = mine.get(it.class_id);
      out.announcements.push(flag(it, { id: itemId(it.id), classId: it.class_id, className: c.name, title: mark(b.title), text: mark(b.text || ""), until: b.until || null, by: it.author_name || "", at: it.updated_at || null }));
    }
  }
  out.announcements.sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));
  return out;
}
