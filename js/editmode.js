// Admin edit mode: the platform admin changes a course lecture right where it is shown (notes, pictures, questions, flashcards, glossary terms).
// Every change is saved to the database at once (supabase/patch8.sql: admin_save_lecture) and everyone sees it; every save is kept in a history
// that can be undone. Switched on by the "Edit" pill in the top bar (or Admin tools in the profile): S.pref("edit"). Nobody else ever gets any of
// this: every entry point answers with nothing unless editing() is true, so students and instructors get the same page as before.
// Texts are plain text with the **bold** / *italic* marks; they are shown with md() (never as HTML). The rules live in editmode-core.js.
import * as S from "./store.js";
import { h, md, ic, toast, openModal, pic } from "./ui.js";
import * as C from "./editmode-core.js";
import { inGlossary, termOf, glossaryFor } from "./glossaryrules.js";

/* ---------- who may, and what the page gives us ---------- */
// main.js registers: route() draws the screen again, rebuild(l) refills the lecture's lists from its body, adopt(l, body) replaces the body,
// gotoPage(l, i) selects a topic of the notes
const host = { route: async () => {}, rebuild: () => {}, adopt: () => {}, gotoPage: () => {} };
export const setHost = (o) => Object.assign(host, o);

// the stylesheet of edit mode is loaded the first time it is needed, so nobody else ever downloads it
let cssAdded = false;
function ensureCss() { if (cssAdded) return; cssAdded = true; if (!document.querySelector('link[href$="edit.css"]')) document.head.append(h("link", { rel: "stylesheet", href: "css/edit.css" })); }
export const editing = () => { const on = S.isAdmin() && !S.pref("student") && S.pref("edit"); if (on) ensureCss(); return on; };
// a course lecture loaded from its body (not an instructor's own lecture, which is edited in the Workspace)
export const canEdit = (l) => editing() && !!l && !l.custom && !!l._raw && Array.isArray(l._raw.sections);
export const rerender = async () => { const y = window.scrollY; await host.route(); window.scrollTo(0, y); };

/* ---------- small building blocks ---------- */
const nid = (() => { let n = 0; return (p = "ed") => `${p}-${++n}`; })();
const LETTERS = "ABCDE";
const iconBtn = (label, icon, disabled, onclick) => h("button.ed-iconbtn", { type: "button", "aria-label": label, title: label, disabled, onclick }, ic(icon, 18));
const textBtn = (label, icon, onclick, cls = "") => h("button.btn.alt.ed-btn" + cls, { type: "button", onclick }, icon ? ic(icon, 16) : "", label);
const renderText = (v, placeholder) => (String(v ?? "").trim() ? md(String(v)) : h("span.ed-empty", placeholder || "Tap to add text"));
// a label, a control, a hint and a place for a message under the field
function fieldBox(labelText, control, { hint = "" } = {}) {
  const id = control.id || (control.id = nid("ed-f")), mid = id + "-m", hid = id + "-h";
  const msg = h("p.ed-msg", { id: mid, "aria-live": "polite" });
  control.setAttribute("aria-describedby", (hint ? hid + " " : "") + mid);
  const node = h(".ed-field", h("label", { for: id }, labelText), hint ? h("p.ed-hint", { id: hid }, hint) : "", control, msg);
  const set = (text) => { msg.textContent = text || ""; if (text) control.setAttribute("aria-invalid", "true"); else control.removeAttribute("aria-invalid"); return !text; };
  return { node, set, control, msg };
}
// a bottom sheet for a form: Escape closes it, a tap outside does not (so a long text is not lost by accident)
function openSheet(title, ...kids) {
  let opts = {};
  if (kids.length && kids[kids.length - 1] && kids[kids.length - 1].__opts) opts = kids.pop().__opts;
  const m = openModal(h("div.ed-sheet", h("h2", title), ...kids), { label: title, dismissable: false, onClose: opts.onClose });
  m.el.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); m.close(); } });
  return m;
}
const sheetOpts = (o) => ({ __opts: o });
const actions = (...kids) => h(".ed-actions", ...kids);
const focusInvalid = (root) => root.querySelector("[aria-invalid=true]")?.focus();
async function busy(btn, fn) { btn.disabled = true; try { return await fn(); } finally { btn.disabled = false; } }

/* ---------- saving ---------- */
const friendly = (e) => {
  const m = e?.message || String(e || ""), code = e?.code || "";
  if (/PGRST202|PGRST205|Could not find the function|does not exist|Bucket not found/i.test(m + code)) return "The database upgrade for editing lectures is not installed yet. The site owner must run supabase/RUN-ME-4.sql in Supabase.";
  if (/admin only/.test(m)) return "Only the platform admin can edit lectures.";
  if (/unknown course/.test(m)) return "The database does not know this course yet.";
  if (/too large|exceed|size/i.test(m)) return "That is too large to save.";
  if (/row.level security|unauthori[sz]ed|forbidden|403/i.test(m)) return "The database refused it. Sign in again as the platform admin and retry.";
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return "No connection. Your change is still on this screen; press Try saving again when you are back online.";
  return m || "Something went wrong.";
};
const bars = new Set(); // the toolbars on the screen, so a failed save can be shown on them
const paintBars = () => { for (const b of [...bars]) { if (!b.node.isConnected) bars.delete(b); else b.paint(); } };
let queue = Promise.resolve();
// Saves the lecture's whole body. Saves run one after the other so two quick edits never race, and each one sends the body as it was when
// the edit was made. If it fails the change stays on the screen and a "Not saved" note with a retry button shows on the toolbar.
export function saveLecture(l, summary) {
  const check = C.checkBody(l._raw);
  if (!check.ok) { l._failed = check.why; toast(check.why); paintBars(); return Promise.resolve({ ok: false, error: check.why }); }
  const snap = JSON.stringify(l._raw);
  l._pending = (l._pending || 0) + 1; paintBars();
  const run = async () => {
    let r;
    try {
      const text = summary || C.describeChange(l._snap ? JSON.parse(l._snap) : null, JSON.parse(snap));
      r = await S.saveLecture(l.id, l.subject, JSON.parse(snap), l._fromDb || !l._orig ? null : JSON.parse(l._orig), text);
    } catch (e) { r = { error: e }; }
    l._pending = Math.max(0, (l._pending || 1) - 1);
    if (r.error) { l._failed = friendly(r.error); toast("Not saved. " + l._failed); paintBars(); return { ok: false, error: l._failed }; }
    l._failed = ""; l._fromDb = true; l._snap = snap; l._at = Date.now();
    toast("Saved. Everyone sees this now."); paintBars();
    return { ok: true, id: r.data };
  };
  const p = queue.then(run, run);
  queue = p.then(() => {}, () => {});
  return p;
}

/* ---------- inline text editing ---------- */
function openInline(el, spec) {
  const cont = typeof spec.container === "function" ? spec.container() : spec.container || el;
  if (!cont || cont.dataset.edOpen) return;
  cont.dataset.edOpen = "1";
  const id = nid("ed-in");
  const ta = h("textarea.ed-ta", { id, rows: "3", maxlength: String(spec.max || 2000), "aria-describedby": id + "-m" });
  ta.value = String(spec.get() ?? "");
  const msg = h("p.ed-msg", { id: id + "-m", "aria-live": "polite" });
  const cancel = h("button.btn.alt.ed-btn", { type: "button" }, "Cancel"), save = h("button.btn.ed-btn", { type: "button" }, ic("check", 16), "Save");
  const box = h(".ed-inline", h("label", { for: id }, "Editing: " + spec.label), ta, msg, actions(cancel, save));
  cont.hidden = true; cont.after(box);
  const grow = () => { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight + 4, 420) + "px"; };
  ta.addEventListener("input", () => { msg.textContent = ""; ta.removeAttribute("aria-invalid"); grow(); });
  grow(); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
  const close = (refocus = true) => { box.remove(); cont.hidden = false; delete cont.dataset.edOpen; if (refocus) el.focus?.(); };
  const go = () => {
    const r = C.checkText(ta.value, { required: spec.required, max: spec.max || 2000, multiline: !!spec.multiline, name: spec.name || "This text" });
    if (!r.ok) { msg.textContent = r.why; ta.setAttribute("aria-invalid", "true"); ta.focus(); return; }
    if (r.value === C.tidyText(spec.get(), !!spec.multiline)) { close(); return; }
    spec.set(r.value);
    if (spec.render) spec.render(el, r.value); else el.replaceChildren(renderText(r.value, spec.placeholder));
    el.setAttribute("aria-label", nameFor(spec, el));
    close();
    spec.after?.(r.value);
    saveLecture(spec.l, typeof spec.summary === "function" ? spec.summary(r.value) : spec.summary);
  };
  cancel.onclick = () => close();
  save.onclick = go;
  ta.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === "Enter" && (!spec.multiline || e.ctrlKey || e.metaKey)) { e.preventDefault(); go(); }
  });
}
// Makes an element that is already on the page editable: a button that opens an editor in place (Save / Cancel; Escape cancels).
// spec: { l (the lecture, saved after the change), get(), set(v), label, name, summary (text or function of the new value), multiline, required, max,
//         placeholder, render(el, v), after(v), container (what to hide while the editor is open) }
// the name of an editable text: "Edit: <what it is>. <the text shown>" (the shown text is part of the name, so a voice user can say it)
const nameFor = (spec, el) => `Edit: ${spec.label}. ${C.clip(el.textContent.replace(/\s+/g, " ").trim(), 2000)}`;
export function editableText(el, spec) {
  if (!editing()) return el;
  el.classList.add("ed-text"); el.setAttribute("role", "button"); el.tabIndex = 0; el.setAttribute("aria-label", nameFor(spec, el));
  const open = () => openInline(el, spec);
  el.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); open(); });
  el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); open(); } });
  return el;
}

/* ---------- dialogs: delete confirmation, a note ---------- */
// answers "delete", "alt" (the extra button, when one is given) or null (cancelled). Cancel has the first focus.
export function confirmDelete(what, { detail = "", alt = "", title = "" } = {}) {
  return new Promise((resolve) => {
    let m;
    const cancel = h("button.btn.alt.ed-btn", { type: "button", autofocus: "", onclick: () => { resolve(null); m.close(); } }, "Cancel");
    const del = h("button.btn.warn.ed-btn", { type: "button", onclick: () => { resolve("delete"); m.close(); } }, ic("trash", 16), "Delete");
    const altBtn = alt ? h("button.btn.alt.ed-btn", { type: "button", onclick: () => { resolve("alt"); m.close(); } }, alt) : "";
    const did = nid("ed-d");
    m = openModal(h("div.ed-sheet", h("h2", title || `Delete this ${what}?`), detail ? h("p", { id: did }, detail) : "", h("p.ed-hint", "If you change your mind, Change history can undo it."), actions(cancel, altBtn, del)), { label: title || `Delete this ${what}?`, onClose: () => resolve(null) });
    m.el.setAttribute("role", "alertdialog"); if (detail) m.el.setAttribute("aria-describedby", did);
  });
}
function noteDialog(title, text) {
  let m; const ok = h("button.btn.ed-btn", { type: "button", autofocus: "", onclick: () => m.close() }, "OK");
  m = openModal(h("div.ed-sheet", h("h2", title), h("p", text), actions(ok)), { label: title });
}

/* ---------- pictures ---------- */
// a picture is shrunk in the browser (at most 1600 pixels on the long side, WebP at quality 0.85 or JPEG) and must be under 2 MB afterwards
const MAX_BYTES = 2000000;
export async function prepareImage(file) {
  if (!/^image[/](png|jpe?g|webp|gif)$/.test(file.type)) throw new Error("Choose a JPG, PNG, WebP or GIF picture.");
  if (file.size > 30e6) throw new Error("That file is too large. Choose one under 30 MB.");
  const bmp = await createImageBitmap(file).catch(() => { throw new Error("That picture could not be read."); });
  try {
    for (const [side, quality] of [[1600, 0.85], [1600, 0.75], [1280, 0.7], [1000, 0.65], [760, 0.6]]) {
      const scale = Math.min(1, side / Math.max(bmp.width, bmp.height)), cv = document.createElement("canvas");
      cv.width = Math.max(1, Math.round(bmp.width * scale)); cv.height = Math.max(1, Math.round(bmp.height * scale));
      const g = cv.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(bmp, 0, 0, cv.width, cv.height);
      let blob = await new Promise((r) => cv.toBlob(r, "image/webp", quality));
      if (!blob || blob.type !== "image/webp") blob = await new Promise((r) => cv.toBlob(r, "image/jpeg", quality));
      if (blob && blob.size <= MAX_BYTES) return blob;
    }
  } finally { bmp.close?.(); }
  throw new Error("That picture is still over 2 MB after shrinking. Try a simpler one.");
}
// A picture with a description: file chooser, preview and the required description. commit() uploads a newly chosen file (to the course's
// private bucket) and answers { img } for the lecture ({ path, bucket: "course", alt }) or { error }.
function pictureControl(l, current, { required = false, removable = false, label = "Picture" } = {}) {
  const st = { blob: null, url: "", removed: false, busy: false };
  const file = h("input", { type: "file", accept: "image/png,image/jpeg,image/webp,image/gif" });
  const f1 = fieldBox(label, file, { hint: "A JPG, PNG, WebP or GIF picture. It is shrunk to fit and must be under 2 MB." });
  const alt = h("input", { maxlength: String(C.LIMITS.alt), placeholder: "What the picture shows" }); alt.value = current?.alt || "";
  const f2 = fieldBox("Picture description", alt, { hint: "Required. Screen readers read it aloud, so say what the picture shows." });
  const show = h(".ed-prev"), status = h("p.ed-hint", { role: "status" });
  const has = () => !!st.blob || (!!current && !st.removed);
  const paint = () => {
    show.replaceChildren(
      st.blob ? h("img", { src: st.url, alt: "The picture you chose" }) : current && !st.removed ? pic({ ...current, alt: current.alt || "The current picture" }) : h("p.ed-hint", "No picture yet."),
      removable && has() ? h("button.btn.alt.ed-btn", { type: "button", onclick: () => { st.blob = null; st.removed = true; file.value = ""; paint(); } }, ic("trash", 16), "Remove picture") : "");
    f2.node.hidden = !has();
  };
  file.onchange = async () => {
    f1.set(""); const f = file.files[0]; if (!f) return;
    st.busy = true; status.textContent = "Preparing the picture...";
    try { const blob = await prepareImage(f); if (st.url) URL.revokeObjectURL(st.url); st.blob = blob; st.url = URL.createObjectURL(blob); st.removed = false; paint(); status.textContent = ""; }
    catch (e) { f1.set(e.message); status.textContent = ""; file.value = ""; }
    finally { st.busy = false; }
  };
  alt.addEventListener("input", () => f2.set(""));
  paint();
  return {
    node: h("div.ed-pic", f1.node, status, show, f2.node),
    hasPicture: has,
    replaced: () => !!st.blob,
    changed: () => !!st.blob || st.removed || (!!current && alt.value.trim() !== (current.alt || "").trim()),
    validate() {
      if (st.busy) { f1.set("Wait until the picture is ready."); return false; }
      if (!has()) { if (required) { f1.set("Choose a picture."); return false; } return true; }
      const a = C.checkAlt(alt.value); f2.set(a.ok ? "" : a.why); return a.ok;
    },
    async commit() {
      if (!has()) return { img: null };
      const a = C.checkAlt(alt.value).value;
      if (st.blob) {
        const up = await S.uploadCourseImage(l.subject, st.blob);
        if (up.error) return { error: friendly(up.error) };
        return { img: { path: up.path, bucket: "course", alt: a } };
      }
      return { img: { ...current, alt: a } };
    },
    dispose() { if (st.url) URL.revokeObjectURL(st.url); },
  };
}
// the dialog behind tapping a picture (or "Add a picture"): choose a new file, change the description, or remove it
function pictureDialog(l, { current, title, onApply, onRemove }) {
  const ctl = pictureControl(l, current, { required: !current }), err = h("p.ed-msg", { role: "alert" });
  const cancel = textBtn("Cancel", "", () => m.close()), save = h("button.btn.ed-btn", { type: "button" }, ic("check", 16), "Save picture");
  const remove = current && onRemove ? textBtn("Remove picture", "trash", async () => { const c = await confirmDelete("picture", { detail: "The step keeps its text." }); if (c === "delete") { m.close(); onRemove(); } }) : "";
  const m = openSheet(title, ctl.node, err, actions(cancel, remove, save), sheetOpts({ onClose: ctl.dispose }));
  save.onclick = () => busy(save, async () => {
    err.textContent = "";
    if (!ctl.validate()) { focusInvalid(m.el); return; }
    if (!ctl.changed()) { m.close(); return; }
    const r = await ctl.commit();
    if (r.error) { err.textContent = r.error; return; }
    m.close(); onApply(r.img, ctl.replaced());
  });
}

/* ---------- points (bullets) ---------- */
function pointSheet(l, ensure, base, again) {
  const ta = h("textarea", { rows: "3", maxlength: String(C.LIMITS.bullet), autofocus: "" }), f = fieldBox("New point", ta, { hint: "Put two stars on each side of a word to highlight it." });
  const err = h("p.ed-msg", { role: "alert" }), save = h("button.btn.ed-btn", { type: "button" }, ic("check", 16), "Add point");
  const m = openSheet("Add a point", f.node, err, actions(textBtn("Cancel", "", () => m.close()), save));
  save.onclick = () => busy(save, async () => {
    const r = C.checkText(ta.value, { required: true, max: C.LIMITS.bullet, name: "The point" });
    if (!f.set(r.ok ? "" : r.why)) { ta.focus(); return; }
    ensure().push(r.value); m.close(); again(); saveLecture(l, C.summaryFor("add-bullet", `${base}: ${r.value}`));
  });
}
// the points of a topic or of a picture step, with the tools to add, move and delete them
function bulletList(l, read, ensure, base, again) {
  const arr = read(), ul = h("ul.pts.ed-pts");
  arr.forEach((txt, k) => {
    const lab = `${base}, point ${k + 1}`, t = h(".ed-t", renderText(txt, "Tap to add text"));
    editableText(t, { l, label: lab, name: "This point", get: () => arr[k], set: (v) => { arr[k] = v; }, required: true, max: C.LIMITS.bullet, summary: (v) => C.summaryFor("edit-bullet", `${base}: ${v}`) });
    const move = (d) => () => { if (C.moveWithin(arr, k, k + d)) { again(); saveLecture(l, C.summaryFor("move-bullet", `${base}: ${txt}`)); } };
    const del = async () => {
      if ((await confirmDelete("point", { detail: C.clip(C.plain(txt), 140) })) !== "delete") return;
      const i = arr.indexOf(txt); if (i < 0) return; arr.splice(i, 1); again(); saveLecture(l, C.summaryFor("delete-bullet", `${base}: ${txt}`));
    };
    ul.append(h("li", t, h(".ed-tools", iconBtn(`Move up: ${lab}`, "up2", k === 0, move(-1)), iconBtn(`Move down: ${lab}`, "down2", k === arr.length - 1, move(1)), iconBtn(`Delete: ${lab}`, "trash", false, del))));
  });
  return h("div.ed-points", arr.length ? ul : "", textBtn("Add a point", "plus", () => pointSheet(l, ensure, base, again), ".ed-add"));
}

/* ---------- picture steps and topics ---------- */
function stepSheet(l, sec) {
  const title = h("input", { maxlength: String(C.LIMITS.title), autofocus: "" }), f1 = fieldBox("Step title", title);
  const first = h("textarea", { rows: "3", maxlength: String(C.LIMITS.bullet) }), f2 = fieldBox("First point (optional)", first);
  const ctl = pictureControl(l, null, { required: true, label: "Picture" }), err = h("p.ed-msg", { role: "alert" });
  const save = h("button.btn.ed-btn", { type: "button" }, ic("check", 16), "Add step");
  const m = openSheet("Add a picture step", f1.node, ctl.node, f2.node, err, actions(textBtn("Cancel", "", () => m.close()), save), sheetOpts({ onClose: ctl.dispose }));
  save.onclick = () => busy(save, async () => {
    err.textContent = "";
    const t = C.checkText(title.value, { required: true, max: C.LIMITS.title, name: "The step title" }), p = C.checkText(first.value, { max: C.LIMITS.bullet, name: "The point" });
    const a = f1.set(t.ok ? "" : t.why), b = f2.set(p.ok ? "" : p.why), c = ctl.validate();
    if (!(a && b && c)) { focusInvalid(m.el); return; }
    const r = await ctl.commit(); if (r.error) { err.textContent = r.error; return; }
    (sec.steps ||= []).push({ img: r.img, title: t.value, bullets: p.value ? [p.value] : [] });
    m.close(); saveLecture(l, C.summaryFor("add-step", `${sec.title}: ${t.value}`)); rerender();
  });
}
function topicSheet(l, afterSec) {
  const title = h("input", { maxlength: String(C.LIMITS.title), autofocus: "" }), f1 = fieldBox("Topic title", title);
  const first = h("textarea", { rows: "3", maxlength: String(C.LIMITS.bullet) }), f2 = fieldBox("First point (optional)", first, { hint: "You can add more points, pictures and boxes afterwards." });
  const save = h("button.btn.ed-btn", { type: "button" }, ic("check", 16), "Add topic");
  const m = openSheet("Add a topic", f1.node, f2.node, actions(textBtn("Cancel", "", () => m.close()), save));
  save.onclick = () => busy(save, async () => {
    const t = C.checkText(title.value, { required: true, max: C.LIMITS.title, name: "The topic title" }), p = C.checkText(first.value, { max: C.LIMITS.bullet, name: "The point" });
    const a = f1.set(t.ok ? "" : t.why), b = f2.set(p.ok ? "" : p.why);
    if (!(a && b)) { focusInvalid(m.el); return; }
    const secs = l._raw.sections, id = C.makeId(C.idPrefix(secs.map((s) => s.id), l.id), secs.map((s) => s.id));
    const at = Math.max(0, secs.indexOf(afterSec)) + 1;
    secs.splice(at, 0, { id, title: t.value, bullets: p.value ? [p.value] : [], boxes: [] });
    host.rebuild(l); host.gotoPage(l, at); m.close(); saveLecture(l, C.summaryFor("add-topic", t.value)); rerender();
  });
}

/* ---------- the hooks main.js calls while drawing a notes page ---------- */
// null unless the page's topic belongs to the course lecture (instructors' own topics are not edited here). again() draws the page again.
export function forPage(l, sec, again) {
  if (!canEdit(l) || !l._raw.sections.includes(sec)) return null;
  const secLabel = () => C.plain(sec.title) || "this topic";
  return {
    title() {
      const t = h("span", sec.title); // a topic title is plain text
      editableText(t, { l, label: "topic title", name: "The title", get: () => sec.title, set: (v) => { sec.title = v; }, required: true, max: C.LIMITS.title,
        container: () => t.closest("h2") || t, render: (el, v) => el.replaceChildren(v), summary: (v) => C.summaryFor("edit-title", v), after: () => again() });
      return t;
    },
    intro() {
      const t = h("span", renderText(l.intro, "Add an introduction (optional)")), p = h("p.ed-intro", { style: "color:var(--mute);margin:0 0 6px" }, t);
      editableText(t, { l, label: "introduction", name: "The introduction", get: () => l._raw.intro || "", set: (v) => { l._raw.intro = v; l.intro = v; }, max: C.LIMITS.intro, container: () => p, summary: (v) => C.summaryFor("edit-intro", v) });
      return p;
    },
    bullets() { return bulletList(l, () => sec.bullets || [], () => (sec.bullets ||= []), secLabel(), again); },
    box(x) {
      const name = { why: "Why it works", trick: "Memory trick", trap: "Exam trap" }[x.type] || "Box", t = h(".ed-t", renderText(x.text, "Tap to add text"));
      editableText(t, { l, label: `${name} box of ${secLabel()}`, name: "This text", get: () => x.text, set: (v) => { x.text = v; }, required: true, max: C.LIMITS.box, summary: (v) => C.summaryFor("edit-box", `${secLabel()}: ${v}`) });
      return t;
    },
    // tapping a picture (instead of enlarging it): replace it, change its description or remove it
    pic(st, redraw) {
      pictureDialog(l, { current: st.img, title: "Picture",
        onApply: (img, replaced) => { st.img = img; redraw(); saveLecture(l, C.summaryFor(replaced ? "replace-picture" : "edit-alt", `${secLabel()}: ${img.alt}`)); },
        onRemove: () => { delete st.img; redraw(); saveLecture(l, C.summaryFor("remove-picture", secLabel())); } });
    },
    // a step with no picture: a button to add one
    addPic(st, redraw) {
      return h(".ed-addpic", textBtn("Add a picture to this step", "image", () => pictureDialog(l, { current: null, title: "Add a picture",
        onApply: (img) => { st.img = img; redraw(); saveLecture(l, C.summaryFor("add-picture", `${secLabel()}: ${img.alt}`)); } })));
    },
    stepText(st, redraw, back) {
      const tt = h("span", renderText(st.title, "Add a step title")), n = (sec.steps || []).indexOf(st) + 1, where = n ? `${secLabel()}, step ${n}` : secLabel();
      editableText(tt, { l, label: `step title of ${where}`, name: "The step title", get: () => st.title || "", set: (v) => { st.title = v; }, max: C.LIMITS.title,
        container: () => tt.closest("h3") || tt, summary: (v) => C.summaryFor("edit-text", `${where} title: ${v}`) });
      const del = n ? textBtn("Delete this step", "trash", async () => {
        if ((await confirmDelete("step", { detail: C.clip(C.plain(st.title || where), 120) })) !== "delete") return;
        const i = sec.steps.indexOf(st); if (i < 0) return; sec.steps.splice(i, 1);
        saveLecture(l, C.summaryFor("delete-step", where)); rerender();
      }, ".ed-add") : "";
      return h(".steptxt.ed-step" + (back ? ".back" : ""), h("h3", tt), bulletList(l, () => st.bullets || [], () => (st.bullets ||= []), where, redraw), del);
    },
    // add a topic, delete this topic (never the last one)
    pageTools() {
      const can = C.canDeleteSection(l._raw), hint = can.ok ? "" : h("p.ed-hint", can.why);
      const del = textBtn("Delete this topic", "trash", async () => {
        const c = C.canDeleteSection(l._raw); if (!c.ok) { toast(c.why); return; }
        if ((await confirmDelete("topic", { detail: `"${C.clip(C.plain(sec.title), 100)}" and everything on its page.` })) !== "delete") return;
        const secs = l._raw.sections, i = secs.indexOf(sec); if (i < 0) return;
        secs.splice(i, 1); host.rebuild(l); host.gotoPage(l, Math.max(0, i - 1));
        saveLecture(l, C.summaryFor("delete-topic", sec.title)); rerender();
      });
      del.disabled = !can.ok;
      return h(".ed-pagetools", h(".ed-actions.start", textBtn("Add a topic", "plus", () => topicSheet(l, sec)), del), hint);
    },
  };
}

/* ---------- questions ---------- */
export function questionEditor(l, q, o = {}) {
  if (!canEdit(l)) return;
  const isNew = !q, sectionIds = l._raw.sections.map((s) => s.id);
  const qText = h("textarea", { rows: "4", maxlength: String(C.LIMITS.question[1] + 200), autofocus: "" }); qText.value = q?.q || "";
  const fq = fieldBox("Question", qText, { hint: "Put two stars on each side of a word to highlight it." });
  const opts = q ? q.options.map(String) : ["", "", "", ""]; let correct = q ? q.answer : 0;
  const gid = nid("ed-g"), group = h("div", { role: "radiogroup", "aria-labelledby": gid });
  const gerr = h("p.ed-msg", { "aria-live": "polite" }), addOpt = textBtn("Add an option", "plus", () => { opts.push(""); drawOpts(); group.querySelectorAll("input[type=text]")[opts.length - 1]?.focus(); });
  const rowMsgs = [];
  const drawOpts = () => {
    rowMsgs.length = 0;
    group.replaceChildren(...opts.map((t, i) => {
      const ro = h("input", { type: "radio", name: gid, "aria-label": `Option ${LETTERS[i]} is the correct answer`, onchange: () => { correct = i; gerr.textContent = ""; } }); ro.checked = i === correct;
      const tx = h("input", { type: "text", maxlength: String(C.LIMITS.option + 100), "aria-label": `Option ${LETTERS[i]}`, placeholder: `Option ${LETTERS[i]}` }); tx.value = t;
      const rm = opts.length > C.LIMITS.optionsMin ? h("button.ed-iconbtn", { type: "button", "aria-label": `Remove option ${LETTERS[i]}`, title: `Remove option ${LETTERS[i]}`, onclick: () => { opts.splice(i, 1); if (correct >= opts.length) correct = opts.length - 1; else if (correct > i) correct--; drawOpts(); } }, ic("x", 18)) : "";
      const msg = h("p.ed-msg", { "aria-live": "polite" }); rowMsgs[i] = { msg, tx };
      tx.addEventListener("input", () => { opts[i] = tx.value; msg.textContent = ""; tx.removeAttribute("aria-invalid"); gerr.textContent = ""; });
      return h(".ed-optrow", h(".ed-optline", h("span.ed-letter", LETTERS[i]), ro, tx, rm), msg);
    }));
    addOpt.hidden = opts.length >= C.LIMITS.optionsMax;
  };
  drawOpts();
  const why = h("textarea", { rows: "3", maxlength: String(C.LIMITS.why + 200) }); why.value = q?.why || "";
  const fw = fieldBox("Explanation (shown after the answer)", why);
  const topic = h("select"); topic.append(h("option", { value: "" }, "No topic"), ...l._raw.sections.map((s, k) => h("option", { value: s.id }, `${k + 1}. ${C.clip(C.plain(s.title), 60)}`)));
  topic.value = q?.topic && sectionIds.includes(q.topic) ? q.topic : "";
  const ft = fieldBox("Topic (optional)", topic, { hint: "Which topic of the lecture the question is about." });
  const ctl = pictureControl(l, q?.img, { removable: true, label: "Picture (optional)" });
  const err = h("p.ed-msg", { role: "alert" }), save = h("button.btn.ed-btn", { type: "button" }, ic("check", 16), isNew ? "Add question" : "Save question");
  const m = openSheet(isNew ? "Add a question" : "Edit question", fq.node,
    h(".ed-field", h("label", { id: gid }, "Answer options"), h("p.ed-hint", "Choose the correct answer with the round button. Use 2 to 5 options."), group, gerr, addOpt),
    fw.node, ft.node, ctl.node, err, actions(textBtn("Cancel", "", () => m.close()), save), sheetOpts({ onClose: ctl.dispose }));
  save.onclick = () => busy(save, async () => {
    err.textContent = "";
    const rows = opts.map((t, i) => ({ t, i })).filter((r) => r.t.trim()), kept = rows.map((r) => r.t), ans = rows.findIndex((r) => r.i === correct);
    const res = C.checkQuestion({ q: qText.value, options: kept, answer: ans, why: why.value, topic: topic.value }, { sectionIds });
    let ok = fq.set(res.errors.q);
    rowMsgs.forEach((r) => { r.msg.textContent = ""; r.tx.removeAttribute("aria-invalid"); });
    res.optionErrs.forEach((e, j) => { if (e && rows[j]) { const r = rowMsgs[rows[j].i]; r.msg.textContent = e; r.tx.setAttribute("aria-invalid", "true"); ok = false; } });
    let g = res.errors.options && !res.optionErrs.some(Boolean) ? res.errors.options : "";
    if (!opts[correct]?.trim()) { g = g || "The option marked as correct is empty. Type it, or choose another option."; rowMsgs[correct]?.tx.setAttribute("aria-invalid", "true"); }
    else if (res.errors.answer) g = res.errors.answer;
    gerr.textContent = g; if (g) ok = false;
    ok = fw.set(res.errors.why) && ok; ok = ft.set(res.errors.topic) && ok; ok = ctl.validate() && ok;
    if (!ok || !res.ok) { err.textContent = "Fix the problems marked above, then save."; focusInvalid(m.el) ; if (!m.el.querySelector("[aria-invalid=true]")) gerr.scrollIntoView?.({ block: "center" }); return; }
    const pr = await ctl.commit(); if (pr.error) { err.textContent = pr.error; return; }
    const v = res.value;
    if (isNew) {
      const quiz = l._raw.quiz, id = C.makeId(C.idPrefix(quiz.map((x) => x.id), l.id), quiz.map((x) => x.id)), nq = { id, q: v.q, options: v.options, answer: v.answer, why: v.why };
      if (v.topic) nq.topic = v.topic; if (pr.img) nq.img = pr.img;
      quiz.push(nq); host.rebuild(l);
    } else {
      q.q = v.q; q.options = v.options; q.answer = v.answer; q.why = v.why;
      if (v.topic) q.topic = v.topic; else delete q.topic;
      if (pr.img) q.img = pr.img; else delete q.img;
    }
    m.close(); saveLecture(l, C.summaryFor(isNew ? "add-question" : "edit-question", v.q)); (o.after || rerender)();
  });
}
export async function deleteQuestion(l, q, after) {
  if (!canEdit(l)) return;
  if ((await confirmDelete("question", { detail: C.clip(C.plain(String(q.q).split("\n")[0]), 160) })) !== "delete") return;
  const i = l._raw.quiz.indexOf(q); if (i < 0) return;
  l._raw.quiz.splice(i, 1); host.rebuild(l);
  saveLecture(l, C.summaryFor("delete-question", q.q)); (after || rerender)();
}
// the "Edit questions" list above the quiz menu
export function questionPanel(l) {
  if (!canEdit(l)) return "";
  const qs = l._raw.quiz, secTitle = (id) => C.plain(l._raw.sections.find((s) => s.id === id)?.title || "");
  const list = h("ol.ed-list", qs.map((q, k) => {
    const first = C.clip(C.plain(String(q.q).split("\n")[0]), 150);
    return h("li.ed-item", h(".ed-item-t", h("b", `${k + 1}. `), first, q.topic && secTitle(q.topic) ? h("span.pill.mute.ed-topic", secTitle(q.topic)) : ""),
      h(".ed-item-b", qBtn(`Edit question ${k + 1}: ${first}`, "Edit", "edit", () => questionEditor(l, q)), qBtn(`Delete question ${k + 1}: ${first}`, "Delete", "trash", () => deleteQuestion(l, q))));
  }));
  return h("details.panel.card.ed-panel", { open: "" }, h("summary", `Edit questions (${qs.length})`),
    h("div", qs.length ? list : h("p.ed-hint", "This lecture has no questions of its own yet."), h(".ed-actions.start", textBtn("Add question", "plus", () => questionEditor(l, null)))));
}
const qBtn = (aria, label, icon, onclick) => h("button.btn.alt.ed-btn", { type: "button", "aria-label": aria, onclick }, ic(icon, 16), label);

/* ---------- flashcards and the glossary ---------- */
// the form for a flashcard (card = null adds one). A card that was in the glossary and whose front is no longer a term stays a flashcard.
export function cardEditor(l, card, o = {}) {
  if (!canEdit(l)) return;
  const isNew = !card, wasListed = !!card && inGlossary(card);
  const front = h("textarea", { rows: "2", maxlength: String(C.LIMITS.front + 100), autofocus: "" }); front.value = card?.front || "";
  const ff = fieldBox("Front (the term or question)", front);
  const note = h("p.ed-hint", { "aria-live": "polite" });
  const back = h("textarea", { rows: "4", maxlength: String(C.LIMITS.back + 200) }); back.value = card?.back || "";
  const fb = fieldBox("Back (the meaning or answer)", back);
  const short = h("input", { maxlength: String(C.LIMITS.short + 50) }); short.value = card?.short || "";
  const fs = fieldBox("Short version (optional)", short, { hint: "A shorter wording for the matching and memory games. Leave empty to use the start of the back." });
  const termNow = () => (card && card.term != null ? card.term : front.value);
  const hint = () => {
    const r = C.checkGlossaryEntry({ term: termNow(), definition: "x" }).errors.term, dup = r && /already in the glossary/.test(r);
    note.textContent = !termNow().trim() ? "" : !r || dup ? "This card also shows in the glossary." : `Not a glossary term, so it stays a flashcard only. ${r}`;
  };
  front.addEventListener("input", hint); hint();
  const err = h("p.ed-msg", { role: "alert" }), save = h("button.btn.ed-btn", { type: "button" }, ic("check", 16), isNew ? "Add flashcard" : "Save flashcard");
  const m = openSheet(isNew ? "Add a flashcard" : "Edit flashcard", ff.node, note, fb.node, fs.node, err, actions(textBtn("Cancel", "", () => m.close()), save));
  save.onclick = () => busy(save, async () => {
    const res = C.checkCard({ front: front.value, back: back.value, short: short.value });
    let ok = ff.set(res.errors.front); ok = fb.set(res.errors.back) && ok; ok = fs.set(res.errors.short) && ok;
    if (!ok) { err.textContent = "Fix the problems marked above, then save."; focusInvalid(m.el); return; }
    let notice = "";
    if (isNew) {
      const cards = l._raw.cards, id = C.makeId(C.idPrefix(cards.map((x) => x.id), l.id), cards.map((x) => x.id));
      cards.push(C.newCard(res.value, id)); host.rebuild(l);
    } else {
      const r = C.applyCardEdit(card, res.value); Object.assign(card, r.card); notice = r.notice;
    }
    m.close(); saveLecture(l, C.summaryFor(isNew ? "add-card" : "edit-card", res.value.front));
    if (notice) noteDialog("Saved as a flashcard only", notice);
    (o.after || rerender)();
  });
}
export async function deleteCard(l, card, after, o = {}) {
  if (!canEdit(l)) return;
  const c = await confirmDelete(o.glossary ? "term" : "flashcard", { detail: C.clip(C.plain(card.front), 140), alt: o.glossary ? "Remove from glossary only" : "",
    title: o.glossary ? `Delete the term "${C.clip(C.plain(termOf(card)), 50)}"?` : "" });
  if (!c) return;
  if (c === "alt") { card.gloss = false; saveLecture(l, C.summaryFor("hide-term", termOf(card))); (after || rerender)(); return; }
  const i = l._raw.cards.indexOf(card); if (i < 0) return;
  l._raw.cards.splice(i, 1); host.rebuild(l);
  saveLecture(l, C.summaryFor(o.glossary ? "delete-term" : "delete-card", o.glossary ? termOf(card) : card.front)); (after || rerender)();
}
// Edit / Delete under the card being studied
export function cardTools(l, card, redraw) {
  if (!canEdit(l) || !l._raw.cards.includes(card)) return "";
  const what = C.clip(C.plain(card.front), 60);
  return h(".ed-cardtools", qBtn(`Edit card: ${what}`, "Edit card", "edit", () => cardEditor(l, card, { after: redraw })), qBtn(`Delete card: ${what}`, "Delete card", "trash", () => deleteCard(l, card)));
}

// a glossary term: the term (checked live with the glossary rule; Save stays off while it fails) and its meaning
export function termEditor(lectures, entry, o = {}) {
  const pool = lectures.filter(canEdit);
  if (!pool.length) return;
  const isNew = !entry, existing = glossaryFor(lectures).map((e) => e.term).filter((t) => !entry || t.toLowerCase() !== entry.term.toLowerCase());
  const term = h("input", { maxlength: "120", autofocus: "", autocomplete: "off" }); term.value = entry?.term || "";
  const ft = fieldBox("Term", term, { hint: "A word, a piece of vocabulary or a name (up to 4 words). Not a question or a sentence." });
  const def = h("textarea", { rows: "4", maxlength: String(C.LIMITS.back + 200) }); def.value = entry?.def || "";
  const fd = fieldBox("Meaning", def);
  const short = h("input", { maxlength: String(C.LIMITS.short + 50) }); short.value = entry?.card?.short || "";
  const fs = fieldBox("Short version (optional)", short, { hint: "A shorter wording for the matching and memory games." });
  const sel = h("select"); sel.append(...pool.map((x) => h("option", { value: x.id }, x.title)));
  const fl = isNew && pool.length > 1 ? fieldBox("Add it to this lecture", sel, { hint: "The term becomes a flashcard of that lecture and is listed in the glossary." }) : null;
  const save = h("button.btn.ed-btn", { type: "button", disabled: true }, ic("check", 16), isNew ? "Add term" : "Save term"), err = h("p.ed-msg", { role: "alert" });
  let touched = false;
  const check = () => {
    const r = C.checkGlossaryEntry({ term: term.value, definition: def.value }, existing);
    save.disabled = !r.ok;
    ft.set(r.errors.term && (touched || term.value.trim()) ? r.errors.term : ""); // never nag about an empty field nobody has touched
    return r;
  };
  term.addEventListener("input", () => { touched = true; check(); });
  def.addEventListener("input", () => { fd.set(""); check(); });
  short.addEventListener("input", () => fs.set(""));
  const m = openSheet(isNew ? "Add a glossary term" : "Edit glossary term", ft.node, fd.node, fs.node, fl ? fl.node : "", err, actions(textBtn("Cancel", "", () => m.close()), save));
  check();
  save.onclick = () => busy(save, async () => {
    const r = check(); // the glossary rule decides again here: a term that fails is never saved
    if (!r.ok) { fd.set(r.errors.definition || ""); focusInvalid(m.el); return; }
    const sh = C.checkText(short.value, { max: C.LIMITS.short, name: "The short version" });
    if (!fs.set(sh.ok ? "" : sh.why)) { focusInvalid(m.el); return; }
    let lec;
    if (isNew) {
      lec = pool.find((x) => x.id === sel.value) || pool[0];
      const cards = lec._raw.cards, id = C.makeId(C.idPrefix(cards.map((x) => x.id), lec.id), cards.map((x) => x.id));
      cards.push({ id, front: r.value.term, back: r.value.definition, short: sh.value || C.autoShort(r.value.definition), gloss: true }); host.rebuild(lec);
    } else {
      lec = entry.lec; const c = entry.card;
      if (c.term != null) c.term = r.value.term; else c.front = r.value.term;
      c.back = r.value.definition; c.short = sh.value || (c.short ? c.short : C.autoShort(r.value.definition)); c.gloss = true;
    }
    m.close(); saveLecture(lec, C.summaryFor(isNew ? "add-term" : "edit-term", r.value.term)); (o.after || rerender)();
  });
}
// the "Add term" button at the top of the glossary (nothing unless editing)
export function termAddButton(lectures, after) {
  if (!editing() || !lectures.some(canEdit)) return "";
  return h(".ed-glossbar", textBtn("Add term", "plus", () => termEditor(lectures, null, { after })));
}
// Edit / Delete inside an open glossary entry
export function glossaryTools(lectures, entry, after) {
  if (!canEdit(entry.lec) || !entry.lec._raw.cards.includes(entry.card)) return "";
  return h(".ed-cardtools", qBtn(`Edit term: ${entry.term}`, "Edit term", "edit", () => termEditor(lectures, entry, { after })), qBtn(`Delete term: ${entry.term}`, "Delete term", "trash", () => deleteCard(entry.lec, entry.card, after, { glossary: true })));
}

/* ---------- history ---------- */
const when = (t) => new Date(t).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
export function historyPanel(l) {
  const list = h("div.ed-hist"), msg = h("p.ed-msg", { role: "alert" });
  const load = async () => {
    list.replaceChildren(h("p.ed-hint", "Loading..."));
    const r = await S.lectureHistory(l.id);
    if (r.error) { list.replaceChildren(); msg.textContent = friendly(r.error); return; }
    msg.textContent = "";
    list.replaceChildren(...(r.data.length ? r.data.map(row) : [h("p.ed-hint", "No changes have been saved to this lecture yet.")]));
  };
  const row = (x) => {
    const undo = h("button.btn.alt.ed-btn", { type: "button", "aria-label": `Undo: ${x.summary}`, disabled: !!x.undone }, ic("history", 16), "Undo");
    undo.onclick = () => busy(undo, async () => {
      msg.textContent = ""; await queue;
      const r = await S.undoChange(x.id);
      if (r.error) { msg.textContent = friendly(r.error); await load(); return; }
      const body = await S.fetchLecture(l.id);
      if (body) { host.adopt(l, body); l._snap = JSON.stringify(body); l._fromDb = true; l._failed = ""; }
      toast("Undone."); paintBars(); await load(); rerender();
    });
    return h(".ed-hrow", h(".ed-hmain", h("b", x.summary || "Edited"), h(".src", `${x.user_email || "An admin"} - ${when(x.at)}`), x.undone ? h("span.pill.mute", "Undone") : ""), undo);
  };
  const close = textBtn("Close", "", () => m.close());
  const m = openSheet("Change history", h("p.ed-hint", `Changes to "${C.clip(C.plain(l.title), 60)}", newest first. Undo puts the lecture back the way it was before that change. An undo can itself be undone.`), msg, list, actions(close));
  load();
}

/* ---------- the toolbar at the top of a lecture ---------- */
// tab: notes | cards | quiz | games.  ctx.section(): the topic of the notes page that is open
export function toolbar(l, tab, ctx = {}) {
  if (!canEdit(l)) return "";
  const status = h("span.ed-status", { role: "status" }), retry = h("button.btn.alt.ed-btn", { type: "button", hidden: true, onclick: () => saveLecture(l, "Saved earlier changes") }, ic("refresh", 16), "Try saving again");
  const secNow = () => { const s = ctx.section?.(); return s && l._raw.sections.includes(s) ? s : null; };
  const adds = [];
  if (tab === "notes") {
    adds.push(textBtn("Add point", "plus", () => { const s = secNow(); if (!s) { toast("Open one of the lecture's own topics first."); return; } pointSheet(l, () => (s.bullets ||= []), C.plain(s.title), rerender); }));
    adds.push(textBtn("Add picture", "image", () => { const s = secNow(); if (!s) { toast("Open one of the lecture's own topics first."); return; } stepSheet(l, s); }));
  }
  if (tab === "cards") adds.push(textBtn("Add flashcard", "plus", () => cardEditor(l, null)));
  if (tab === "quiz") adds.push(textBtn("Add question", "plus", () => questionEditor(l, null)));
  const node = h(".ed-bar", { role: "region", "aria-label": "Editing tools" },
    h(".ed-bar-top", h("b.ed-title", ic("pencil", 16), "Editing mode on"), h("button.btn.ed-btn", { type: "button", onclick: () => { S.setPref("edit", false); rerender(); } }, ic("check", 16), "Done")),
    h("p.ed-hint", "Tap any text or picture to change it. Changes are saved at once and everyone sees them."),
    status, retry, h(".ed-actions.start", ...adds, textBtn("History", "history", () => historyPanel(l))));
  const paint = () => {
    status.textContent = l._failed ? "Not saved: " + l._failed : l._pending ? "Saving..." : "";
    status.className = "ed-status" + (l._failed ? " bad" : ""); retry.hidden = !l._failed;
  };
  bars.add({ node, paint }); paint();
  return node;
}
