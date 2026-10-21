// Instructors add to their class: notes, flashcards, questions, whole lectures and announcements, with pictures.
// These are the screens inside the Workspace (class page > Class content). The rules live in itemrules.js and, enforced, in the database.
import * as S from "./store.js";
import * as A from "./staffapi.js";
import { h, ic, md, toast, pic } from "./ui.js";
import { go, field, busy, plural, tile, empty, warn, crumb, loading, fail, when } from "./wsui.js";
import { problem, tidy, summary, ICONS, KIND_NAME, LIMITS } from "./itemrules.js";
import { parseQuestions, parseCards } from "./bulk.js";
import { mark } from "./classcontent.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const STATUS = { published: ["Published", "ok"], review: ["Waiting for approval", "amber"], draft: ["Draft", "mute"] };
const statusPill = (st) => h("span.pill." + STATUS[st][1], STATUS[st][0]);
const LETTER = "ABCDE";
const order = (a, b) => (a.position - b.position) || String(a.created_at || "").localeCompare(String(b.created_at || ""));
const mine = (items, kind, ref) => items.filter((i) => i.kind === kind && (ref === undefined || i.lecture_ref === ref)).sort(order);
const pageOf = (cls, tail) => go(`class/${cls.class_id}/content${tail ? "/" + tail : ""}`);

/* ---------- the entry points used by the class and school pages ---------- */

// a small card on the class page that leads here
export function contentCard(c, cls) {
  const box = h("div", h(".src", "Loading..."));
  A.items(cls.class_id).then((r) => {
    const n = (st) => r.data.filter((i) => i.status === st).length;
    box.replaceChildren(r.error ? h(".src", r.error.message) : h(".kv", h("span", h("b", n("published")), " published"), h("span", h("b", n("draft")), " drafts"), n("review") ? h("span", h("b", n("review")), " waiting for approval") : ""));
  });
  return h(".card", { style: "margin-top:12px" }, h("h3", "Class content"), h(".src", { style: "margin:0 0 6px" }, "Add your own notes, flashcards, questions, lectures and announcements for this class."), box,
    h("div", { style: "margin-top:10px" }, h("button.btn.sm", { onclick: () => pageOf(cls) }, ic("edit", 16), "Manage class content")));
}

// the screens under #/work/class/<id>/content...
export async function viewContent(c, cls, rest, manage) {
  const { v } = c, done = loading(v), [ir, sr] = await Promise.all([A.items(cls.class_id), A.mySchools()]); done();
  if (ir.error) return fail(v, ir.error);
  const ctx = { c, cls, items: ir.data, school: sr.data.find((s) => s.school_id === cls.school_id) || {}, manage };
  ctx.needsApproval = !!ctx.school.require_approval && !manage;
  ctx.refresh = async () => { await c.X.refreshExtras(); c.X.route(); };
  v.append(c.tabBar(S.isAdmin() ? "schools" : manage ? "school/" + cls.school_id : "teaching"));
  const [page, a, b, d] = rest;
  if (page === "lecture") return lecturePage(ctx, a);
  if (page === "edit") return editor(ctx, a, b, d);
  if (page === "bulk") return bulkPage(ctx, a, b);
  return overview(ctx);
}

/* ---------- the overview ---------- */
function overview(ctx) {
  const { c, cls, items, school } = ctx, v = c.v, n = (st) => items.filter((i) => i.status === st).length;
  v.append(crumb(cls.name, "class/" + cls.class_id), h(".hero", h("h1", "Class content"), h("p", `${cls.name}. Students see an item only after you publish it. The course's own material is never changed.`)));
  if (school.require_approval) v.append(warn(h("b", ctx.manage ? "Approval is switched on for this school." : "Your school asks a manager to approve what you publish."), h(".src", { style: "margin:2px 0 0" }, ctx.manage ? "Items instructors publish wait in School > Content until you approve them. Your own items publish directly." : "When you press Publish the item waits for approval and students see it once it is approved.")));
  v.append(h(".tiles", tile("Published", n("published")), tile("Drafts", n("draft")), tile("Waiting for approval", n("review"))));
  // announcements
  const anns = mine(items, "announcement");
  v.append(h(".card", { style: "margin-top:12px" }, h("h3", "Announcements"), h(".src", { style: "margin:0 0 6px" }, "A message at the top of the class page. Add a last day and it disappears by itself."),
    anns.length ? h(".stack", anns.map((it) => itemRow(ctx, it, anns))) : h(".src", "No announcements yet."),
    h("div", { style: "margin-top:10px" }, h("button.btn.sm", { onclick: () => pageOf(cls, "edit/announcement/new") }, ic("plus", 16), "New announcement"))));
  // the class's own lectures
  const lecs = mine(items, "lecture");
  v.append(h(".card", { style: "margin-top:12px" }, h("h3", "Your lectures"), h(".src", { style: "margin:0 0 6px" }, "Whole lectures of your own, with notes, flashcards and questions. They appear in the class's list, marked as added by you."),
    lecs.length ? h(".stack", lecs.map((it) => lectureRow(ctx, it, lecs))) : h(".src", "No lectures of your own yet."),
    h("div", { style: "margin-top:10px" }, h("button.btn.sm", { onclick: () => pageOf(cls, "edit/lecture/new") }, ic("plus", 16), "New lecture"))));
  // additions to the course's lectures
  const base = c.X.LECS.filter((l) => l.subject === cls.course_id && !l.custom);
  const count = (id) => items.filter((i) => i.lecture_ref === id).length;
  const pick = h("select", { "aria-label": "Course lecture" }, base.map((l) => h("option", { value: l.id }, `${l.title}${count(l.id) ? ` (${count(l.id)} added)` : ""}`)));
  v.append(h(".card", { style: "margin-top:12px" }, h("h3", "Add to the course's lectures"), h(".src", { style: "margin:0 0 6px" }, "Extra questions, flashcards and notes go at the end of that lecture's quiz, cards and notes for your class only."),
    base.length ? h(".row.wrapx", pick, h("button.btn.sm", { onclick: () => pageOf(cls, "lecture/" + pick.value) }, "Open")) : h(".src", "This course has no lectures yet."),
    base.filter((l) => count(l.id)).length ? h("div", { style: "margin-top:8px" }, base.filter((l) => count(l.id)).map((l) => h("button.chip", { style: "margin:2px 6px 2px 0", onclick: () => pageOf(cls, "lecture/" + l.id) }, `${l.title}: ${count(l.id)}`))) : ""));
  v.append(copyCard(ctx), h("details.card.panel", { style: "margin-top:12px" }, h("summary", "How this works"),
    h("div", { style: "margin-top:8px" }, h("ul", { style: "margin:0;padding-left:18px" },
      h("li", "Everything you add starts as a draft that only you and your school's staff can see. In the Classes tab your drafts show with a Draft label so you can try them as a student would."),
      h("li", "Press Publish when it is ready. If your school wants approval, a manager reviews it first."),
      h("li", "Put two stars on each side of a word to highlight it, and one star on each side for italics."),
      h("li", "Your words are shown exactly as you write them."),
      h("li", "Only add pictures you have the right to use. Every picture needs a short description for students who cannot see it."),
      h("li", `A class holds up to ${LIMITS.itemsPerClass} items and a lecture up to ${LIMITS.itemsPerLecture}.`)))));
}

function lectureRow(ctx, it, siblings) {
  const kids = ctx.items.filter((i) => i.lecture_ref === it.id), n = (k) => kids.filter((i) => i.kind === k).length;
  return h(".card.itemrow", h(".row", { style: "flex-wrap:nowrap;align-items:flex-start" }, h("span.em", { style: "font-size:1.6rem" }, it.body.icon || ICONS[0]),
    h("div", { style: "flex:1;min-width:0" }, h("b", it.body.title), " ", statusPill(it.status), h(".kv", h("span", h("b", n("note")), " notes"), h("span", h("b", n("card")), " cards"), h("span", h("b", n("question")), " questions"))),
    h("button.btn.sm", { onclick: () => pageOf(ctx.cls, "lecture/" + it.id) }, ic("edit", 16), "Open")),
    actions(ctx, it, siblings, { cascade: true }));
}

function copyCard(ctx) {
  const { c, cls } = ctx, box = h("div");
  A.classesOf(null).then((r) => {
    const others = (r.data || []).filter((k) => k.class_id !== cls.class_id && !k.archived);
    if (!others.length) { box.append(h(".src", "You teach no other class to copy from.")); return; }
    const from = h("select", { "aria-label": "Copy from this class" }, others.map((k) => h("option", { value: k.class_id }, `${k.name} (${k.school_name})`)));
    const go_ = h("button.btn.alt.sm", { onclick: () => busy(go_, async () => {
      if (!confirm(`Copy the lectures, notes, flashcards and questions of the selected class into ${cls.name}? They arrive as drafts.`)) return;
      const r2 = await A.copyItems(from.value, cls.class_id); if (r2.error) { toast(r2.error.message); return; }
      const failed = await A.copyPictures(r2.data || []);
      toast(failed ? `Copied. ${plural(failed, "picture")} could not be copied.` : "Copied as drafts"); await ctx.refresh();
    }) }, ic("copy", 16), "Copy here");
    box.append(h(".row.wrapx", from, go_));
  });
  return h(".card", { style: "margin-top:12px" }, h("h3", "Copy from another class"), h(".src", { style: "margin:0 0 6px" }, "Start a new term from a class you taught before. Announcements are not copied."), box);
}

/* ---------- one lecture (your own, or a course lecture you add to) ---------- */
function lecturePage(ctx, ref) {
  const { c, cls, items } = ctx, v = c.v;
  const own = UUID.test(ref || "") ? items.find((i) => i.id === ref && i.kind === "lecture") : null, base = !own ? c.X.LECS.find((l) => l.id === ref && !l.custom && l.subject === cls.course_id) : null;
  if (!own && !base) return v.append(crumb("Class content", `class/${cls.class_id}/content`), empty("That lecture was not found."));
  const title = own ? own.body.title : base.title;
  v.append(crumb("Class content", `class/${cls.class_id}/content`),
    h(".hero", h("h1", (own ? (own.body.icon || ICONS[0]) + " " : "") + title), h("p", own ? "A lecture of your own for this class." : "Added at the end of this course lecture for your class only.")));
  if (own) v.append(h(".card", h(".row", { style: "justify-content:space-between" }, h("div", statusPill(own.status)),
    h(".row", h("button.btn.alt.sm", { onclick: () => pageOf(cls, "edit/lecture/" + own.id) }, ic("edit", 16), "Edit details"),
      h("button.btn.sm", { onclick: () => lectureStatus(ctx, own) }, ic("send", 16), own.status === "published" ? "Unpublish lecture" : ctx.needsApproval ? "Submit lecture for approval" : "Publish lecture and its items")))));
  const section = (kind, heading, addLabel, bulkKind) => {
    const list = mine(items, kind, ref);
    return h(".card", { style: "margin-top:12px" }, h("h3", `${heading} (${list.length})`), list.length ? h(".stack", list.map((it) => itemRow(ctx, it, list))) : h(".src", `No ${heading.toLowerCase()} yet.`),
      h(".row", { style: "margin-top:10px" }, h("button.btn.sm", { onclick: () => pageOf(cls, `edit/${kind}/new/${ref}`) }, ic("plus", 16), addLabel), bulkKind ? h("button.btn.alt.sm", { onclick: () => pageOf(cls, `bulk/${bulkKind}/${ref}`) }, ic("list", 16), "Paste many") : ""));
  };
  v.append(section("note", "Notes", "Add a note"), section("card", "Flashcards", "Add a flashcard", "cards"), section("question", "Questions", "Add a question", "questions"));
}
async function lectureStatus(ctx, lec) {
  const publishing = lec.status !== "published";
  if (!publishing && !confirm("Take this lecture and all its items back to drafts? Students will no longer see them.")) return;
  const r = await A.setItemStatus(lec.id, publishing ? "published" : "draft", true);
  if (r.error) { toast(r.error.message); return; }
  toast(!publishing ? "Back to draft" : r.data === "review" ? "Sent to a school manager for approval" : "Published"); await ctx.refresh();
}

/* ---------- a row in a list: summary, status, and what can be done ---------- */
function itemRow(ctx, it, siblings) {
  const prev = h("div"), text = summary(it.kind, it.body);
  const row = h(".card.itemrow", h(".row", { style: "flex-wrap:nowrap;align-items:flex-start" },
    h("div", { style: "flex:1;min-width:0" }, h("b", { style: "font-weight:600;word-break:break-word" }, text), " ", statusPill(it.status), it.body.img ? h("span.pill.mute", { style: "margin-left:6px" }, "picture") : "",
      it.kind === "announcement" && it.body.until ? h(".src", { style: "margin:2px 0 0" }, "Shown until " + it.body.until) : "")),
    actions(ctx, it, siblings, { preview: prev }), prev);
  return row;
}
function actions(ctx, it, siblings, o = {}) {
  const { cls } = ctx, idx = siblings.findIndex((s) => s.id === it.id), what = summary(it.kind, it.body);
  const icon = (label, name, fn) => h("button.btn.alt.sm", { "aria-label": `${label}: ${what}`, title: label, onclick: fn }, ic(name, 16));
  const text = (label, name, fn, primary) => h("button.btn.sm" + (primary ? "" : ".alt"), { "aria-label": `${label}: ${what}`, onclick: fn }, ic(name, 16), label);
  const move = (d) => async () => { const ids = siblings.map((s) => s.id), j = idx + d; if (j < 0 || j >= ids.length) return; [ids[idx], ids[j]] = [ids[j], ids[idx]]; const r = await A.reorderItems(cls.class_id, ids); if (r.error) toast(r.error.message); else await ctx.refresh(); };
  const act = h(".row", { style: "margin-top:8px;gap:6px" });
  if (it.kind !== "lecture") act.append(text("Edit", "edit", () => pageOf(cls, `edit/${it.kind}/${it.id}${it.lecture_ref ? "/" + it.lecture_ref : ""}`)));
  if (o.preview) act.append(text("Preview", "eye", () => { if (o.preview.firstChild) o.preview.replaceChildren(); else o.preview.append(previewNode(it.kind, it.body)); }));
  if (!o.cascade) {
    if (it.status === "published") act.append(text("Unpublish", "left", () => status(ctx, it, "draft")));
    else if (it.status === "review") act.append(text("Take back", "left", () => status(ctx, it, "draft")));
    else act.append(text(ctx.needsApproval ? "Submit for approval" : "Publish", "send", () => status(ctx, it, "published"), true));
  }
  if (siblings.length > 1) act.append(icon("Move up", "up2", move(-1)), icon("Move down", "down2", move(1)));
  act.append(icon("Delete", "trash", async () => { if (!confirm(`Delete this ${KIND_NAME[it.kind]}?${it.kind === "lecture" ? " Its notes, flashcards and questions go too." : ""} This cannot be undone.`)) return; const r = await A.deleteItem(it.id); if (r.error) { toast(r.error.message); return; } await A.removePictures(r.data); toast("Deleted"); await ctx.refresh(); }));
  return act;
}
async function status(ctx, it, to) {
  const r = await A.setItemStatus(it.id, to); if (r.error) { toast(r.error.message); return; }
  toast(to === "draft" ? "Back to draft" : r.data === "review" ? "Sent to a school manager for approval" : "Published"); await ctx.refresh();
}

/* ---------- how an item looks to a student ---------- */
export function previewNode(kind, b) {
  const t = (x) => md(mark(x || ""));
  if (kind === "question") return h(".card", { style: "margin-top:8px" }, b.img ? pic({ ...b.img }, { style: "max-width:100%;max-height:200px;margin-bottom:8px" }) : "", h(".q", t(b.q)),
    b.options.map((o, i) => h(".opt" + (i === b.answer ? ".ok" : ""), h("b", LETTER[i].toLowerCase()), h("span", t(o)))), b.why ? h(".fb", h("b", "Explanation: "), t(b.why)) : "", h(".src", "The correct answer is marked here only. Students pick one first."));
  if (kind === "card") return h(".card", { style: "margin-top:8px" }, h(".src", { style: "margin:0" }, "Front"), h("b", t(b.front)), h(".src", { style: "margin:8px 0 0" }, "Back"), h("div", t(b.back)));
  if (kind === "note") return h(".card", { style: "margin-top:8px" }, h("h3", t(b.title)), b.img ? pic({ ...b.img }, { style: "max-width:100%;max-height:240px;border:1px solid var(--line);border-radius:10px" }) : "", (b.bullets || []).length ? h("ul.pts", b.bullets.map((x) => h("li", t(x)))) : "");
  if (kind === "lecture") return h(".card", { style: "margin-top:8px" }, h("h3", (b.icon || ICONS[0]) + " " + b.title), b.intro ? h("p", t(b.intro)) : "");
  return h(".card", { style: "margin-top:8px;border-left:6px solid var(--sun)" }, h("b", t(b.title)), b.text ? h("p", { style: "margin:2px 0 0" }, t(b.text)) : "");
}

/* ---------- editors ---------- */
async function prepareImage(file) {
  if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) throw new Error("Choose a JPG, PNG, WebP or GIF picture.");
  if (file.size > 15e6) throw new Error("That file is too large. Choose one under 15 MB.");
  const bmp = await createImageBitmap(file).catch(() => { throw new Error("That picture could not be read."); });
  for (const [width, quality] of [[1280, 0.82], [1000, 0.75], [760, 0.7], [560, 0.65]]) {
    const scale = Math.min(1, width / bmp.width), cv = document.createElement("canvas"); cv.width = Math.max(1, Math.round(bmp.width * scale)); cv.height = Math.max(1, Math.round(bmp.height * scale));
    const g = cv.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(bmp, 0, 0, cv.width, cv.height);
    let blob = await new Promise((r) => cv.toBlob(r, "image/webp", quality)); if (!blob || blob.type !== "image/webp") blob = await new Promise((r) => cv.toBlob(r, "image/jpeg", quality));
    if (blob && blob.size <= 1000000) return blob;
  }
  throw new Error("That picture is still too large after shrinking. Try a simpler one.");
}
// an optional picture with a description; get() uploads a newly chosen file
function pictureField(ctx, current) {
  let blob = null, url = null, removed = false;
  const alt = h("input", { value: (current && current.alt) || "", maxlength: 200, placeholder: "Describe the picture for someone who cannot see it", "aria-label": "Picture description" });
  const file = h("input", { type: "file", accept: "image/png,image/jpeg,image/webp,image/gif", "aria-label": "Choose a picture" }), err = h("p.err", { role: "alert", style: "margin:4px 0 0;min-height:0" }), show = h("div", { style: "margin:8px 0" });
  const draw = () => {
    const has = blob || (current && !removed);
    show.replaceChildren(blob ? h("img", { src: url, alt: "The picture you chose", style: "max-width:100%;max-height:200px;border:1px solid var(--line);border-radius:10px" }) : current && !removed ? pic({ ...current }, { style: "max-width:100%;max-height:200px;border:1px solid var(--line);border-radius:10px" }) : h(".src", "No picture."),
      has ? h("div", { style: "margin-top:6px" }, h("button.btn.alt.sm", { type: "button", onclick: () => { blob = null; removed = true; file.value = ""; draw(); } }, ic("trash", 16), "Remove picture")) : "");
    altBox.hidden = !has;
  };
  file.onchange = async () => { err.textContent = ""; const f = file.files[0]; if (!f) return; try { blob = await prepareImage(f); url = URL.createObjectURL(blob); removed = false; draw(); } catch (e) { err.textContent = e.message; file.value = ""; } };
  const altBox = field("Picture description", alt, "Required with a picture. Screen readers read it aloud.");
  const node = h("div", { style: "margin-top:4px" }, h("label", "Picture (optional)"), file, show, altBox, err);
  draw();
  return {
    node,
    // the picture as it will look (a chosen file is not uploaded until the item is saved)
    peek: () => (blob ? { src: url, alt: alt.value } : current && !removed ? { path: current.path, alt: alt.value } : null),
    // { img } for the item, plus what to clean up: a file uploaded now (if saving fails) and the file this replaces (if saving works)
    async get() {
      if (blob) { const up = await A.uploadPicture(ctx.cls.class_id, blob); if (up.error) throw up.error; return { img: { path: up.path, alt: alt.value }, uploaded: up.path, oldPath: current && current.path }; }
      if (current && !removed) return { img: { path: current.path, alt: alt.value } };
      return { img: null, oldPath: current && current.path };
    },
  };
}

function editor(ctx, kind, id, ref) {
  const { c, cls, items } = ctx, v = c.v;
  if (!["question", "card", "note", "lecture", "announcement"].includes(kind)) return v.append(empty("That page doesn't exist."));
  const existing = id && id !== "new" ? items.find((i) => i.id === id && i.kind === kind) : null;
  if (id && id !== "new" && !existing) return v.append(crumb("Class content", `class/${cls.class_id}/content`), empty("That item was not found. It may have been deleted."));
  const lref = existing ? existing.lecture_ref : ref || null, b = existing ? existing.body : {};
  const back = () => (lref ? pageOf(cls, "lecture/" + lref) : pageOf(cls));
  const lecName = lref ? (items.find((i) => i.id === lref)?.body.title || c.X.LECS.find((l) => l.id === lref)?.title || lref) : "";
  const err = h("p.err", { role: "alert", "aria-live": "assertive", style: "min-height:1.4em" });
  const form = h("div"); let collect = null, picture = null;
  const noun = KIND_NAME[kind];

  if (kind === "question") {
    const q = h("textarea", { rows: 3, maxlength: 700, "aria-label": "Question" }); q.value = b.q || "";
    const opts = (b.options && b.options.length ? b.options.slice() : ["", "", "", ""]).map(String); let correct = b.answer ?? 0;
    const list = h("div", { role: "radiogroup", "aria-label": "Answer options. Choose the correct one." }), add = h("button.btn.alt.sm", { type: "button", onclick: () => { opts.push(""); draw(); } }, ic("plus", 16), "Add an option");
    const draw = () => { list.replaceChildren(...opts.map((t, i) => h(".row", { style: "flex-wrap:nowrap;margin:6px 0" }, h("input", { type: "radio", name: "correct", checked: i === correct, "aria-label": `Option ${LETTER[i]} is the correct answer`, onchange: () => { correct = i; } }),
      h("input", { value: t, maxlength: 300, "aria-label": `Option ${LETTER[i]}`, placeholder: `Option ${LETTER[i]}`, oninput: (e) => { opts[i] = e.target.value; } }),
      opts.length > 2 ? h("button.btn.alt.sm", { type: "button", "aria-label": `Remove option ${LETTER[i]}`, onclick: () => { opts.splice(i, 1); if (correct >= opts.length) correct = opts.length - 1; else if (correct > i) correct--; draw(); } }, ic("x", 16)) : ""))); add.hidden = opts.length >= 5; };
    draw();
    const why = h("textarea", { rows: 3, maxlength: 800, "aria-label": "Explanation" }); why.value = b.why || "";
    picture = pictureField(ctx, b.img);
    form.append(field("Question", q, "To highlight a word, put two stars on each side of it."), h("label", "Answer options"), h(".src", { style: "margin:0 0 4px" }, "Tick the correct one. Use 2 to 5 options; empty ones are ignored."), list, add,
      field("Explanation (optional)", why, "Shown after the student answers. A good one says why the right answer is right."), picture.node);
    collect = () => { const kept = []; let ans = -1; opts.forEach((t, i) => { if (t.trim()) { if (i === correct) ans = kept.length; kept.push(t); } }); return { q: q.value, options: kept, answer: ans, why: why.value }; };
  } else if (kind === "card") {
    const front = h("input", { value: b.front || "", maxlength: 200, "aria-label": "Front of the card" }), back_ = h("textarea", { rows: 3, maxlength: 800, "aria-label": "Back of the card" }); back_.value = b.back || "";
    const short = h("input", { value: b.short || "", maxlength: 100, "aria-label": "Short version" });
    form.append(field("Front: the term or question", front), field("Back: the meaning or answer", back_), field("Short version (optional)", short, "A shorter wording for the matching and memory games. Leave empty to use the start of the back."));
    collect = () => ({ front: front.value, back: back_.value, short: short.value });
  } else if (kind === "note") {
    const title = h("input", { value: b.title || "", maxlength: 150, "aria-label": "Note title" }), pts = h("textarea", { rows: 6, maxlength: 7600, "aria-label": "Points" }); pts.value = (b.bullets || []).join("\n");
    picture = pictureField(ctx, b.img);
    form.append(field("Title", title), field("Points", pts, "One point per line, up to 15. To highlight a key term, put two stars on each side of it."), picture.node);
    collect = () => ({ title: title.value, bullets: pts.value.split("\n") });
  } else if (kind === "lecture") {
    const title = h("input", { value: b.title || "", maxlength: 100, "aria-label": "Lecture title" }), chapter = h("input", { value: b.chapter || "", maxlength: 60, "aria-label": "Label" }), intro = h("textarea", { rows: 3, maxlength: 600, "aria-label": "Introduction" }); intro.value = b.intro || "";
    let icon = b.icon || ICONS[0]; const picker = h(".row", { role: "radiogroup", "aria-label": "Icon", style: "gap:6px" });
    const drawIcons = () => picker.replaceChildren(...ICONS.map((i) => h("button.chip" + (i === icon ? ".on" : ""), { type: "button", role: "radio", "aria-checked": String(i === icon), "aria-label": "Icon " + i, onclick: () => { icon = i; drawIcons(); } }, i))); drawIcons();
    form.append(field("Title", title), field("Label (optional)", chapter, `For example "Week 3". Leave empty to show the class name.`), h("label", "Icon"), picker, field("Introduction (optional)", intro, "Shown at the start of the lecture's notes."));
    collect = () => ({ title: title.value, chapter: chapter.value, icon, intro: intro.value });
  } else {
    const title = h("input", { value: b.title || "", maxlength: 120, "aria-label": "Announcement title" }), text = h("textarea", { rows: 4, maxlength: 1500, "aria-label": "Message" }); text.value = b.text || "";
    const until = h("input", { type: "date", value: b.until || "", min: new Date().toISOString().slice(0, 10), "aria-label": "Show until" });
    form.append(field("Title", title), field("Message (optional)", text), field("Show until (optional)", until, "After this day it is no longer shown. Leave empty to keep it up."));
    collect = () => ({ title: title.value, text: text.value, until: until.value });
  }

  const save = async (publish, btn) => {
    err.textContent = "";
    let got = null;
    try {
      const body = collect(); if (picture) { got = await picture.get(); if (got.img) body.img = got.img; }
      const tidied = tidy(kind, body), p = problem(kind, tidied);
      if (p) { err.textContent = p; if (got?.uploaded) await A.removePictures([got.uploaded]); return; }
      const r = await A.saveItem(cls.class_id, kind, lref, tidied, existing ? existing.id : null);
      if (r.error) { err.textContent = r.error.message; if (got?.uploaded) await A.removePictures([got.uploaded]); return; }
      if (got?.oldPath && got.oldPath !== tidied.img?.path) await A.removePictures([got.oldPath]);
      let msg = "Saved";
      if (publish) { const s = await A.setItemStatus(r.data, "published"); msg = s.error ? "Saved. It could not be published: " + s.error.message : s.data === "review" ? "Saved and sent to a school manager for approval" : "Saved and published"; }
      toast(msg); await c.X.refreshExtras();
      if (kind === "lecture" && !existing) pageOf(cls, "lecture/" + r.data); else back();
    } catch (e) { err.textContent = e.message || String(e); if (got?.uploaded) await A.removePictures([got.uploaded]); }
  };
  const preview = h("div"), previewBtn = h("button.btn.alt.sm", { type: "button", onclick: () => {
    if (preview.firstChild) { preview.replaceChildren(); return; }
    const body = tidy(kind, collect()), im = picture && picture.peek(); if (im) body.img = im;
    const p = problem(kind, body.img ? { ...body, img: { path: "preview/placeholder.webp", alt: body.img.alt || "" } } : body);
    if (p) { err.textContent = p; return; }
    err.textContent = ""; preview.append(previewNode(kind, body));
  } }, ic("eye", 16), "Preview");
  const published = existing && existing.status === "published";
  const saveBtn = h("button.btn", { onclick: () => busy(saveBtn, () => save(false)) }, ic("check", 16), existing ? "Save changes" : "Save as draft");
  const pubBtn = published ? "" : h("button.btn.alt", { onclick: () => busy(pubBtn, () => save(true)) }, ic("send", 16), ctx.needsApproval ? "Save and submit for approval" : "Save and publish");
  v.append(crumb(lref ? lecName : "Class content", lref ? `class/${cls.class_id}/content/lecture/${lref}` : `class/${cls.class_id}/content`),
    h(".hero", h("h1", `${existing ? "Edit" : "New"} ${noun}`), lref ? h("p", `For: ${lecName}`) : ""),
    h(".card", form, err, h(".row", { style: "margin-top:8px" }, saveBtn, pubBtn, previewBtn), preview));
}

/* ---------- paste many questions or flashcards ---------- */
function bulkPage(ctx, kind, ref) {
  const { c, cls } = ctx, v = c.v, isQ = kind === "questions", noun = isQ ? "question" : "flashcard";
  if (!["questions", "cards"].includes(kind) || !ref) return v.append(empty("That page doesn't exist."));
  const text = h("textarea", { rows: 12, "aria-label": `Paste your ${noun}s here`, placeholder: isQ ? EXAMPLE_Q : EXAMPLE_C });
  const out = h("div"), go_ = h("button.btn", { hidden: true }), check = h("button.btn.alt", { onclick: () => {
    const r = isQ ? parseQuestions(text.value) : parseCards(text.value), bad = [];
    r.items.forEach((it, i) => { const p = problem(isQ ? "question" : "card", it); if (p) bad.push(`${isQ ? "Question" : "Card"} ${i + 1}: ${p}`); });
    ready = r.items.filter((it) => !problem(isQ ? "question" : "card", it));
    out.replaceChildren(...(r.errors.length || bad.length ? [h(".warnbox.bad", h("b", "Some lines need fixing"), h("ul", { style: "margin:4px 0 0;padding-left:18px" }, [...r.errors.map((e) => e.message), ...bad].map((m) => h("li", m))))] : []),
      ready.length ? h(".warnbox.good", h("b", `${plural(ready.length, noun)} ready to add`), h("ul", { style: "margin:4px 0 0;padding-left:18px" }, ready.slice(0, 6).map((it) => h("li", summary(isQ ? "question" : "card", it))), ready.length > 6 ? h("li", `and ${ready.length - 6} more`) : "")) : (r.errors.length || bad.length ? "" : h(".src", "Nothing to add yet.")));
    go_.hidden = !ready.length; go_.replaceChildren(ic("plus", 16), `Add ${plural(ready.length, noun)} as drafts`);
  } }, ic("check", 16), "Check");
  let ready = [];
  go_.onclick = () => busy(go_, async () => {
    let n = 0; for (const it of ready) { const r = await A.saveItem(cls.class_id, isQ ? "question" : "card", ref, it, null); if (r.error) { toast(`Stopped after ${n}: ${r.error.message}`); break; } n++; go_.lastChild.textContent = `Saving ${n} of ${ready.length}...`; }
    if (n) { toast(`${plural(n, noun)} added as drafts`); await c.X.refreshExtras(); pageOf(cls, "lecture/" + ref); }
  });
  v.append(crumb("Back", `class/${cls.class_id}/content/lecture/${ref}`), h(".hero", h("h1", isQ ? "Paste many questions" : "Paste many flashcards"), h("p", isQ ? "Copy questions from a document. Leave a blank line between questions." : "Copy two columns from a spreadsheet, or type the front, a | and the back on each line.")),
    h(".card", text, h(".row", { style: "margin-top:8px" }, check, go_), out), isQ ? h(".card.src", { style: "margin-top:12px" }, "Mark the correct option with a star after it (like b) Paris *) or add a line such as Answer: b. A line starting with Why: becomes the explanation.") : "");
}
const EXAMPLE_Q = `1. What is the capital of France?
a) Berlin
b) Paris *
c) Rome
Why: Paris has been the capital since 987.

2. Which of these is a planet?
a) The Sun
b) Mars
c) The Moon
Answer: b`;
const EXAMPLE_C = `Igneous rock\tRock formed when magma cools
Sedimentary rock | Rock formed from layers of sediment`;

/* ---------- a school manager's view: the approval switch and what is waiting ---------- */
export async function reviewTab(c, sc) {
  const out = h("div"), done = loading(out), r = await A.reviewQueue(sc.school_id); done();
  const box = h("input", { type: "checkbox" }); box.checked = !!sc.require_approval;
  box.onchange = async () => { box.disabled = true; const x = await A.setApproval(sc.school_id, box.checked); box.disabled = false; if (x.error) { toast(x.error.message); box.checked = !box.checked; } else { toast(box.checked ? "Instructors' items now wait for approval" : "Instructors publish directly"); c.X.route(); } };
  const list = r.data || [], by = {}; list.forEach((it) => (by[it.class_name] ||= []).push(it));
  const refresh = async () => { await c.X.refreshExtras(); c.X.route(); };
  // approving names the version that was looked at: if the instructor changed it in the meantime the database refuses, and the list is reloaded to show the new wording
  const decide = async (it, to) => { const x = await A.setItemStatus(it.item_id, to, false, to === "published" ? it.updated_at : null); toast(x.error ? x.error.message : to === "published" ? "Approved and published" : "Sent back to the instructor as a draft"); await refresh(); };
  out.append(h(".card", { style: "margin-top:12px" }, h("h3", "Approval"), h(".src", { style: "margin:0 0 6px" }, "Instructors can add their own notes, flashcards, questions and lectures. With approval on, what they publish waits here until a manager approves it. Managers publish directly."),
      h("label.check", box, "Require approval before instructors publish")),
    h(".card", { style: "margin-top:12px" }, h("h3", `Waiting for approval (${list.length})`),
      list.length ? Object.entries(by).map(([cn, its]) => h("div", { style: "margin-top:10px" }, h(".row", { style: "justify-content:space-between" }, h("b", cn),
        h("button.btn.alt.sm", { onclick: async () => { if (!confirm(`Approve all ${plural(its.length, "item")} of ${cn}?`)) return; let done = 0; for (const it of its) { const x = await A.setItemStatus(it.item_id, "published", false, it.updated_at); if (x.error) { toast(x.error.message); break; } done++; } if (done === its.length) toast("Approved"); await refresh(); } }, ic("check", 16), `Approve all ${its.length}`)),
        h(".stack", { style: "margin-top:6px" }, its.map((it) => { const prev = h("div"); return h(".card.itemrow", h("div", h("span.pill.mute", KIND_NAME[it.kind]), " ", h("b", { style: "font-weight:600" }, summary(it.kind, it.body)), h(".src", { style: "margin:2px 0 0" }, `${it.author_name || "An instructor"} · ${when(it.updated_at)}`)),
          h(".row", { style: "margin-top:8px;gap:6px" }, h("button.btn.alt.sm", { onclick: () => { if (prev.firstChild) prev.replaceChildren(); else prev.append(previewNode(it.kind, it.body)); } }, ic("eye", 16), "Preview"),
            h("button.btn.sm", { onclick: () => decide(it, "published") }, ic("check", 16), "Approve"), h("button.btn.alt.sm", { onclick: () => decide(it, "draft") }, ic("left", 16), "Send back")), prev); })))) : h(".src", "Nothing is waiting.")));
  return out;
}
