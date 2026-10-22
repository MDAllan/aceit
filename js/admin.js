// Admin and instructor workspace. Admins see everything; instructors see only the classes they teach.
import * as S from "./store.js";
import { h, md, ic, symOf, toast } from "./ui.js";

export function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type })), a = h("a", { href: url, download: name });
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}
const panel = (title, ...kids) => h("details.card.panel", { style: "margin-top:12px" }, h("summary", title), h("div", { style: "margin-top:10px" }, ...kids));
const when = (t) => (t ? new Date(t).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "-");

// what an instructor needs: which questions the class finds hardest, who has gone quiet, and an export
function insights(ls, rows, name) {
  const qs = ls.flatMap((l) => (l.quiz || []).map((q) => ({ l, q })));
  const hard = qs.map(({ l, q }) => { let a = 0, c = 0; rows.forEach((r) => { const t = r.quiz[q.id]; if (t?.attempts) { a += t.attempts; c += t.correct; } }); return { l, q, a, acc: a ? c / a : null }; })
    .filter((x) => x.a >= 3).sort((x, y) => x.acc - y.acc).slice(0, 8);
  const quiet = rows.filter((r) => !r.p.is_admin && (!r.last || Date.now() - new Date(r.last) > 7 * 864e5));
  const csv = () => {
    const esc = (t) => `"${String(t ?? "").replace(/"/g, '""')}"`;
    const head = ["Name", "Email", "Classes", "Overall %", ...ls.map((l) => l.title + " %"), "Quiz accuracy %", "Last active"];
    const lines = [head.map(esc).join(",")].concat(rows.filter((r) => !r.p.is_admin).map((r) => [r.p.display_name, r.p.email, r.classes.join(" "), r.avg, ...r.stats, r.acc ?? "", r.last ? new Date(r.last).toISOString().slice(0, 10) : ""].map(esc).join(",")));
    download(`aceit-${name.replace(/\s+/g, "")}-progress.csv`, lines.join("\r\n"), "text/csv");
  };
  return h(".card", { style: "margin-top:14px" }, h("h3", `Class insights: ${name}`),
    h("b", { style: "font-size:.9rem" }, "Hardest questions (3+ attempts)"),
    hard.length ? h("div", hard.map((x) => h(".fb", { style: "margin-top:6px" }, h("b", `${Math.round(x.acc * 100)}% correct `), h("span.src", { style: "margin:0" }, `${x.a} attempts, ${x.l.title}`), h("div", md(x.q.q.split(String.fromCharCode(10))[0]))))) : h(".src", "Not enough answers yet. This fills in as students take quizzes."),
    h("b", { style: "font-size:.9rem;display:block;margin-top:12px" }, `Quiet for 7+ days (${quiet.length})`),
    quiet.length ? h("p", { style: "margin:4px 0 0" }, quiet.map((r) => r.p.display_name || r.p.email).join(", ")) : h(".src", "Everyone has been active this week."),
    h("div", { style: "margin-top:12px" }, h("button.btn.alt.sm", { onclick: csv }, "Download progress (CSV)")));
}

// sample students so this page can be previewed on localhost with ?demo&admin (never used when real login is on)
function demoData(LECS) {
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const names = ["Ava Chen", "Noah Singh", "Lima A.", "Omar B."], profiles = [{ id: "a0", email: "admin@example.com", display_name: "Admin", is_admin: true }], progress = [];
  names.forEach((n, i) => {
    const id = "s" + i; profiles.push({ id, email: n.split(" ")[0].toLowerCase() + "@example.com", display_name: n, is_admin: false, blocked: false });
    const quiz = {}, read = {};
    LECS.forEach((l) => { (l.quiz || []).forEach((q, k) => { if (rnd() < 0.7) { const a = 1 + Math.floor(rnd() * 4); quiz[q.id] = { attempts: a, correct: Math.round(a * (k % 7 === 0 ? 0.2 : 0.75) * (0.6 + rnd() * 0.4)), last: rnd() > 0.4 }; } }); (l.sections || []).slice(0, 3 + i).forEach((x) => { (read[l.id] ||= {})[x.id] = 1; }); });
    progress.push({ user_id: id, data: { quiz, read, cards: {}, games: {} }, updated_at: new Date(Date.now() - (i === 3 ? 12 : i) * 864e5).toISOString() });
  });
  return { profiles, progress, error: null };
}

export async function viewAdmin(v, ctx) {
  const { LECS, SUBJECTS, route } = ctx, isAdm = S.isAdmin();
  const mine = isAdm ? SUBJECTS : SUBJECTS.filter((sj) => S.instructorOf.has(sj.id));
  const title = isAdm ? "Admin" : "Instructor";
  v.append(h(".hero", h("h1", title), h("p", isAdm ? "Everyone's progress, class codes and tools." : "Your classes: progress, codes and exam dates.")), h("p", "Loading..."));
  let data, codesList, accessRows, instructors = [];
  if (S.DEMO) { data = demoData(LECS); codesList = SUBJECTS.map((x) => ({ class_id: x.id, code: "demo-" + x.id })); accessRows = []; }
  else [data, codesList, accessRows, instructors] = await Promise.all([S.adminList(), S.getCodes(), S.adminAccess(), isAdm ? S.listInstructors() : []]);
  v.lastChild.remove();
  if (data.error) return v.append(h("p.err", data.error.message));
  const { profiles, progress } = data;
  const codes = Object.fromEntries((codesList || []).map((c) => [c.class_id, c.code]));
  const accessBy = {}; (accessRows || []).forEach((a) => (accessBy[a.user_id] ||= new Set()).add(a.class_id));
  const byId = Object.fromEntries(progress.map((p) => [p.user_id, p]));
  let sj = mine[0]?.id, everyone = false;

  const draw = () => {
    v.replaceChildren(h(".hero", h("h1", title), h("p", isAdm ? "Everyone's progress, class codes and tools." : "Your classes: progress, codes and exam dates.")));
    if (!mine.length) return v.append(h(".card", "You are not set up as an instructor for any class yet. Ask the administrator."));
    const ls = LECS.filter((l) => l.subject === sj), sjObj = SUBJECTS.find((x) => x.id === sj);
    let rows = profiles.map((p) => {
      const d = byId[p.id]?.data || { cards: {}, quiz: {}, read: {}, games: {} };
      const stats = ls.map((l) => {
        const secs = (l.sections || []).filter((s) => d.read?.[l.id]?.[s.id]).length, known = l.cards.filter((c) => d.cards?.[c.id] === "know").length;
        const right = (l.quiz || []).filter((q) => d.quiz?.[q.id]?.last).length, games = Math.min((l.games || []).filter((g) => d.games?.[l.id + ":" + g]).length, 3);
        const parts = [[secs, (l.sections || []).length], [known, l.cards.length], [right, (l.quiz || []).length], [games, 3]].filter((x) => x[1]);
        return Math.round((parts.reduce((s, x) => s + x[0] / x[1], 0) / (parts.length || 1)) * 100);
      });
      const avg = stats.length ? Math.round(stats.reduce((a, c) => a + c, 0) / stats.length) : 0;
      const att = Object.values(d.quiz || {}).reduce((s, x) => s + x.attempts, 0), cor = Object.values(d.quiz || {}).reduce((s, x) => s + x.correct, 0);
      return { p, stats, avg, acc: att ? Math.round((cor / att) * 100) : null, last: byId[p.id]?.updated_at, classes: [...(accessBy[p.id] || [])], quiz: d.quiz || {} };
    });
    if (!S.DEMO && !everyone) rows = rows.filter((r) => r.p.is_admin || r.classes.includes(sj));
    const nameOf = (id) => SUBJECTS.find((x) => x.id === id)?.name || id;
    const actions = (r) => {
      if (r.p.is_admin || S.DEMO) return "";
      const btns = [];
      if (r.classes.includes(sj)) btns.push(h("button.btn.alt.sm", { onclick: async () => { if (!confirm(`Remove ${r.p.email} from ${nameOf(sj)}?`)) return; const x = await S.removeFromClass(r.p.id, sj); toast(x.error ? x.error.message : "Removed from class"); route(); } }, "Remove from class"));
      if (isAdm) {
        btns.push(h("button.btn.alt.sm", { onclick: async () => { await S.adminBlock(r.p.id, !r.p.blocked); route(); } }, r.p.blocked ? "Unblock" : "Block"));
        btns.push(h("button.btn.warn.sm", { onclick: async () => { if (confirm("Permanently remove " + r.p.email + "?")) { const x = await S.adminDelete(r.p.id); if (x.error) toast(x.error.message); route(); } } }, "Kick"));
      }
      return h(".row", { style: "flex-wrap:nowrap" }, ...btns);
    };
    v.append(h(".card", h("b", `${rows.length} accounts`), h(".src", "Columns show each lecture's completion for the class you pick.")),
      h(".row", { style: "margin:10px 0" }, mine.map((x) => h("button.chip" + (sj === x.id ? ".on" : ""), { onclick: () => { sj = x.id; draw(); } }, [ic(symOf(x), 15), x.name])), isAdm && !S.DEMO ? h("button.chip" + (everyone ? ".on" : ""), { onclick: () => { everyone = !everyone; draw(); } }, "Show everyone") : ""),
      h(".tw", h("table", h("thead", h("tr", ["Student", "Classes", "Overall", ...ls.map((l) => ic(symOf(l), 16)), "Quiz acc.", "Last active", ""].map((x) => h("th", x)))),
        h("tbody", rows.map((r) => h("tr",
          h("td", h("b", r.p.display_name || ""), h(".src", r.p.email), r.p.is_admin ? h("span.pill", { style: "background:#324586" }, "admin") : "", r.p.blocked ? h("span.pill", { style: "background:#B8404F" }, "blocked") : ""),
          h("td", r.p.is_admin ? "all" : r.classes.map(nameOf).join(", ") || "none yet"),
          h("td", r.avg + "%"), ...r.stats.map((x) => h("td", x + "%")),
          h("td", r.acc === null ? "-" : r.acc + "%"), h("td", r.last ? new Date(r.last).toLocaleDateString() : "-"),
          h("td", actions(r))))))),
      insights(ls, rows, sjObj?.name || ""),
      examCard(mine), codeCard(mine, codes), feedbackCard(),
      isAdm && !S.DEMO ? [instructorPanel(instructors, profiles, mine, SUBJECTS, route), domainPanel(), auditPanel(), errorPanel()] : "");
    // the publish tool goes right at the top and starts open, so it is easy to find
    if (isAdm && !S.DEMO) { const pp = publishPanel(LECS, SUBJECTS); pp.open = true; pp.style.marginBottom = "12px"; v.children[0].after(pp); }
  };
  draw();
}

function codeCard(mine, codes) {
  return h(".card", { style: "margin-top:14px" }, h("h3", "Class access codes"), h(".src", { style: "margin:0 0 6px" }, "Students enter a class's code to join it."),
    mine.map((x) => { const inp = h("input", { value: codes[x.id] || "", placeholder: "Set a code (4+ characters)", "aria-label": x.name + " code" });
      return h("div", { style: "margin:8px 0" }, h("label", { style: "margin:0 0 4px;display:flex;gap:6px;align-items:center" }, ic(symOf(x), 15), x.name), h(".row", { style: "flex-wrap:nowrap" }, inp,
        h("button.btn.sm", { onclick: async () => { if (inp.value.trim().length < 4) { toast("Use at least 4 characters"); return; } if (S.DEMO) { toast("Demo only"); return; } const r = await S.setCode(x.id, inp.value.trim()); toast(r.error ? r.error.message : x.name + " code saved"); } }, "Save"))); }));
}

function examCard(mine) {
  return h(".card", { style: "margin-top:14px" }, h("h3", "Exam date"), h(".src", { style: "margin:0 0 6px" }, "Students see a countdown and a study plan for the weakest lectures."),
    mine.map((x) => { const cur = S.settings[x.id] || {};
      const nm = h("input", { value: cur.exam_name || "", placeholder: "e.g. Midterm", "aria-label": x.name + " exam name" }), dt = h("input", { type: "date", value: cur.exam_date || "", "aria-label": x.name + " exam date" });
      return h("div", { style: "margin:8px 0" }, h("label", { style: "margin:0 0 4px;display:flex;gap:6px;align-items:center" }, ic(symOf(x), 15), x.name),
        h(".row", { style: "flex-wrap:nowrap" }, nm, dt, h("button.btn.sm", { onclick: async () => { if (S.DEMO) { toast("Demo only"); return; } const r = await S.setExam(x.id, nm.value, dt.value); toast(r.error ? r.error.message : dt.value ? "Exam date saved" : "Exam date cleared"); } }, "Save"))); }));
}

function feedbackCard() {
  const box = h("div", h(".src", "Loading..."));
  if (!S.DEMO) S.feedbackList().then((list) => {
    const avg = list.length ? (list.reduce((t, f) => t + (f.rating || 0), 0) / list.length).toFixed(1) : null;
    box.replaceChildren(list.length ? h("div", h("p", { style: "margin:0 0 6px" }, `Average rating ${avg} from ${list.length} message${list.length === 1 ? "" : "s"}.`), ...list.slice(0, 6).map((f) => h(".fb", { style: "margin-top:6px" }, h("b", "★".repeat(f.rating || 0) + " "), f.message || "(no message)", h(".src", `${when(f.at)}${f.class_id ? ", " + f.class_id : ""}`)))) : h(".src", "No feedback yet. Students can send it from their profile."));
  }); else box.replaceChildren(h(".src", "Feedback appears here once students send it."));
  return h(".card", { style: "margin-top:14px" }, h("h3", "Student feedback"), box);
}

/* ----- admin-only tools ----- */
function instructorPanel(list, profiles, mine, SUBJECTS, route) {
  const em = h("input", { type: "email", placeholder: "instructor@school.ca (must have signed up)", "aria-label": "Instructor email" });
  const cl = h("select", { "aria-label": "Class" }, SUBJECTS.map((x) => h("option", { value: x.id }, x.name)));
  const act = async (email, cid, flag) => { const r = await S.setInstructor(email, cid, flag); toast(r.error ? r.error.message : flag ? "Instructor added" : "Instructor removed"); if (!r.error) route(); };
  return panel("\u{1F9D1}‍\u{1F3EB} Instructors", h(".src", { style: "margin:0 0 6px" }, "An instructor sees only the students in their class and can change that class's code and exam date."),
    list.length ? h("div", list.map((i) => { const p = profiles.find((x) => x.id === i.user_id); return h(".row", { style: "padding:4px 0;flex-wrap:nowrap" }, h("span", { style: "flex:1" }, `${p?.email || i.user_id} (${SUBJECTS.find((x) => x.id === i.class_id)?.name || i.class_id})`), h("button.btn.alt.sm", { onclick: () => act(p?.email, i.class_id, false) }, "Remove")); })) : h(".src", "No instructors yet."),
    h(".row", { style: "margin-top:8px;flex-wrap:nowrap" }, em, cl, h("button.btn.sm", { onclick: () => em.value.trim() && act(em.value.trim(), cl.value, true) }, "Add")));
}
function domainPanel() {
  const inp = h("input", { placeholder: "school.ca, uni.ca (leave empty to allow anyone)", "aria-label": "Allowed email domains" });
  S.getDomains().then((d) => { inp.value = d; });
  return panel("\u{1F3EB} Allowed school emails", h(".src", { style: "margin:0 0 6px" }, "Only these email domains can create accounts. Your own admin email always works."),
    h(".row", { style: "flex-wrap:nowrap" }, inp, h("button.btn.sm", { onclick: async () => { const r = await S.setDomains(inp.value.trim()); toast(r.error ? r.error.message : "Saved"); } }, "Save")));
}
export function publishPanel(LECS, SUBJECTS) {
  const status = h("p", { style: "margin:8px 0 0" }, "");
  const go = h("button.btn.sm", { onclick: async () => {
    go.disabled = true; let done = 0, bad = [];
    const jobs = [...LECS.map((l) => ({ id: l.id, cls: l.subject, url: `content/${l.id}.json` })), ...SUBJECTS.filter((x) => x.exams).map((x) => ({ id: x.exams, cls: x.id, url: `content/${x.exams}.json`, exam: true }))];
    for (const j of jobs) {
      try { const body = await (await fetch(j.url, { cache: "no-store" })).json(); const r = j.exam ? await S.publishExam(j.cls, body) : await S.publishLecture(j.id, j.cls, body); if (r.error) throw r.error; done++; }
      catch (e) { bad.push(`${j.id}: ${e.message || e}`); }
      status.textContent = `Published ${done} of ${jobs.length}...`;
    }
    status.textContent = bad.length ? `Published ${done} of ${jobs.length}. Problems: ${bad.join("; ")}` : `Done: ${done} of ${jobs.length} published. Only class members can read these now.`;
    go.disabled = false;
  } }, "Publish content to the database");
  return panel("\u{1F512} Protect lecture content", h(".src", { style: "margin:0 0 6px" }, "Copies every lecture and exam into the database, where only members of each class can read them. Run this again after you change any lecture."), go, status);
}
function auditPanel() {
  const box = h("div", h(".src", "Loading..."));
  S.auditLog().then((rows) => box.replaceChildren(rows.length ? h("div", rows.map((r) => h(".row", { style: "padding:3px 0;font-size:.85rem;flex-wrap:nowrap" }, h("span.src", { style: "margin:0;min-width:120px" }, when(r.at)), h("span", `${r.action}${r.target ? ": " + r.target : ""}${r.detail ? " (" + r.detail + ")" : ""}`)))) : h(".src", "Nothing yet.")));
  return panel("\u{1F4DC} Recent admin actions", box);
}
function errorPanel() {
  const box = h("div", h(".src", "Loading..."));
  S.errorLog().then((rows) => box.replaceChildren(rows.length ? h("div", rows.map((r) => h(".fb", { style: "margin-top:6px" }, h("b", r.msg), h(".src", `${when(r.at)} ${r.url || ""}`)))) : h(".src", "No errors reported. Good.")));
  return panel("\u{1F6E0}️ Error reports", box);
}
