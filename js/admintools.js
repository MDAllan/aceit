// What the platform admin sees at the bottom of their profile: view as a student, edit mode, the Customer Service inbox and instructor promotion.
import * as S from "./store.js";
import * as A from "./account.js";
import * as Staff from "./staffapi.js";
import { h, ic, toast } from "./ui.js";
import { switchRow } from "./profile.js";

const when = (t) => new Date(t).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const nameOf = (p) => p.display_name || (p.email || "").split("@")[0] || "Unnamed";

export function adminCard(X) {
  const box = h(".card#admin-tools", { style: "margin-top:12px" }, h("h3", "Admin tools"));
  const draw = () => {
    box.replaceChildren(h("h3", "Admin tools"),
      switchRow("Edit mode", "Edit notes, pictures, questions, flashcards and glossary terms right where you see them. Only you see this.", S.pref("edit"), (on) => { S.setPref("edit", on); if (on) S.setPref("student", false); X.route(); }, true),
      switchRow("View as a student", "See the app exactly as students see it.", S.pref("student"), (on) => { S.setPref("student", on); if (on) S.setPref("edit", false); X.route(); }),
      inbox(), peopleTool(X));
  };
  draw();
  return box;
}

/* ----- Customer Service inbox ----- */
function inbox() {
  const d = h("details.panel", { style: "margin-top:12px;border-top:1px solid var(--line);padding-top:10px" }), sum = h("summary", "Customer Service inbox"), body = h("div");
  d.append(sum, body);
  let filter = "open";
  const load = async () => {
    body.replaceChildren(h(".src", "Loading..."));
    const r = await A.adminQuestions(filter);
    if (r.error) { body.replaceChildren(h(".warnbox", r.error.message)); return; }
    const filters = h(".swipe", [["open", "Open"], ["answered", "Answered"], ["closed", "Closed"]].map(([k, t]) => h("button.chip" + (filter === k ? ".on" : ""), { onclick: () => { filter = k; load(); } }, t)));
    if (filter === "open") sum.textContent = `Customer Service inbox${r.data.length ? ` (${r.data.length} open)` : ""}`;
    body.replaceChildren(filters, r.data.length ? h("div", r.data.map((q) => {
      const reply = h("textarea", { rows: 2, maxlength: 1000, placeholder: "Write a reply the person will see in the app", "aria-label": "Reply to " + nameOf(q), value: q.admin_note || "" });
      const act = (status) => async (e) => { e.target.disabled = true; const x = await A.setQuestionStatus(q.id, status, reply.value.trim() || null); e.target.disabled = false; if (x.error) { toast(x.error.message); return; } toast(status === "answered" ? "Reply sent" : "Closed"); load(); };
      return h(".card", { style: "margin-top:8px" }, h(".row", { style: "justify-content:space-between;flex-wrap:nowrap" }, h("b", q.topic), h("span.src", { style: "margin:0" }, when(q.at))),
        h(".src", { style: "margin:2px 0 6px;overflow-wrap:anywhere" }, `${nameOf(q)}${q.email ? " · " + q.email : ""}`), h("p", { style: "margin:0 0 8px;white-space:pre-wrap" }, q.message), reply,
        h(".row", { style: "margin-top:6px" }, h("button.btn.sm", { onclick: act("answered") }, "Send reply"), q.status !== "closed" ? h("button.btn.alt.sm", { onclick: act("closed") }, "Close") : ""));
    })) : h(".empty", filter === "open" ? "No open questions. All caught up." : "Nothing here."));
  };
  d.addEventListener("toggle", () => { if (d.open && !d.dataset.loaded) { d.dataset.loaded = "1"; load(); } });
  if (!S.DEMO) A.adminQuestions("open").then((r) => { if (r.data?.length) sum.textContent = `Customer Service inbox (${r.data.length} open)`; });
  return d;
}

/* ----- promote and demote instructors ----- */
function peopleTool(X) {
  const d = h("details.panel", { style: "margin-top:12px;border-top:1px solid var(--line);padding-top:10px" }, h("summary", "Instructors"));
  const q = h("input", { type: "search", placeholder: "Find a person by name or email", "aria-label": "Find a person", autocomplete: "off" }), out = h("div", { style: "margin-top:8px" });
  let seq = 0, classes = null;
  const classList = async () => {
    if (classes) return classes;
    if (S.isV2()) { const r = await Staff.classesOf(null, null); classes = (r.data || []).map((c) => ({ id: c.class_id, label: `${c.school_name} · ${c.name}` })); }
    else classes = X.SUBJECTS.map((s) => ({ id: s.id, label: s.name })); // legacy: one set of classes per course
    return classes;
  };
  const teaches = async (p) => {
    if (S.isV2()) return (await A.instructorClasses(p.id)).data.map((c) => ({ id: c.class_id, label: `${c.school_name} · ${c.class_name}` }));
    const rows = await S.listInstructors(); return rows.filter((r) => r.user_id === p.id).map((r) => ({ id: r.class_id, label: X.SUBJECTS.find((s) => s.id === r.class_id)?.name || r.class_id })); // legacy
  };
  const set = async (p, kid, flag) => (S.isV2() ? A.setInstructorOf(p.id, kid, flag) : S.setInstructor(p.email, kid, flag)); // legacy: the older per-course tool
  const card = async (p) => {
    const el = h(".card", { style: "margin-top:8px" }), cl = await classList(), mine = await teaches(p);
    const sel = h("select", { "aria-label": "Class for " + nameOf(p) }, cl.map((c) => h("option", { value: c.id }, c.label)));
    const refresh = async () => el.replaceWith(await card(p));
    el.append(h(".row", { style: "flex-wrap:nowrap" }, h("span.av", nameOf(p).slice(0, 1).toUpperCase()), h("div", { style: "flex:1;min-width:0" }, h("b", nameOf(p), p.is_admin ? h("span.pill.navy", { style: "margin-left:8px" }, "Admin") : "", mine.length ? h("span.pill.ok", { style: "margin-left:8px" }, "Instructor") : ""), h(".src", { style: "margin:0;overflow-wrap:anywhere" }, p.email))),
      mine.length ? h("div", { style: "margin-top:8px" }, h(".src", { style: "margin:0 0 4px" }, "Instructor of"), mine.map((c) => h("span.xchip", c.label, h("button", { "aria-label": `Remove ${nameOf(p)} as instructor of ${c.label}`, onclick: async () => { if (!confirm(`Remove ${nameOf(p)} as an instructor of ${c.label}?`)) return; const r = await set(p, c.id, false); if (r.error) toast(r.error.message); else { toast("Instructor removed"); refresh(); } } }, ic("x", 14))))) : "",
      cl.length ? h(".row.wrapx", { style: "margin-top:8px" }, sel, h("button.btn.sm", { onclick: async (e) => { e.target.disabled = true; const r = await set(p, sel.value, true); e.target.disabled = false; if (r.error) toast(r.error.message); else { toast(`${nameOf(p)} is now an instructor`); refresh(); } } }, ic("userplus", 16), "Make instructor")) : h(".src", "There are no classes yet."));
    return el;
  };
  q.oninput = async () => {
    const my = ++seq, list = await Staff.findAccounts(q.value); if (my !== seq) return;
    if (q.value.trim().length < 2) { out.replaceChildren(h(".src", "Type at least 2 letters.")); return; }
    const cards = await Promise.all(list.map(card)); if (my !== seq) return;
    out.replaceChildren(...(cards.length ? cards : [h(".empty", "Nobody found.")]));
  };
  d.append(h(".src", { style: "margin:6px 0" }, "An instructor can see and manage the classes you give them. They must have confirmed their email."), q, out);
  return d;
}
