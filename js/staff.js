// Workspace: what platform admins, school managers and instructors see. Every rule is enforced in the database; this file only
// decides what to show. Platform admin -> schools -> school managers + instructors -> classes -> students.
import * as S from "./store.js";
import * as A from "./staffapi.js";
import { h, ic, toast } from "./ui.js";
import { download, publishPanel } from "./admin.js";

/* ---------- small helpers ---------- */
const DAY = 864e5;
const ago = (t) => { if (!t) return "has not opened ACEIT yet"; const d = Math.floor((Date.now() - new Date(t)) / DAY); return d <= 0 ? "active today" : d === 1 ? "active yesterday" : d < 30 ? `active ${d} days ago` : "active " + new Date(t).toLocaleDateString(); };
const when = (t) => (t ? new Date(t).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "-");
const quiet = (t) => !t || Date.now() - new Date(t) > 7 * DAY;
const plural = (n, w, many) => `${n} ${n === 1 ? w : many || w + "s"}`;
const site = () => location.origin + location.pathname;
const initials = (n) => (n || "?").trim().split(/\s+/).map((x) => x[0]).slice(0, 2).join("").toUpperCase();
const nameOf = (r) => r.display_name || r.name || (r.email || "").split("@")[0] || "Unknown";
const meter = (pct, tc) => h(".mastery", { style: tc ? `--tc:${tc}` : "", role: "img", "aria-label": pct + " percent" }, h("i", { style: `width:${Math.max(0, Math.min(100, pct || 0))}%` }), h("span", (pct || 0) + "%"));
const csvCell = (t) => { let s = String(t ?? ""); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return `"${s.replace(/"/g, '""')}"`; }; // a leading = + - @ would run as a formula in Excel
async function copy(text, msg = "Copied") { try { await navigator.clipboard.writeText(text); toast(msg); } catch { prompt("Copy this:", text); } }
const field = (label, input, help) => h(".field", h("label", label), input, help ? h(".src", help) : "");
const panel = (title, open, ...kids) => { const d = h("details.card.panel", { style: "margin-top:12px" }, h("summary", title), h("div", { style: "margin-top:10px" }, ...kids)); if (open) d.open = true; return d; };
const busy = async (btn, fn) => { btn.disabled = true; try { return await fn(); } finally { btn.disabled = false; } };
const go = (p) => { location.hash = "#/work" + (p ? "/" + p : ""); };
const tile = (label, value, sub) => h(".tile", h("b", String(value ?? 0)), h("span", label), sub ? h("small", sub) : "");
const empty = (msg) => h(".card.empty", msg);
const warn = (...kids) => h(".warnbox", ...kids);
const crumb = (label, to) => h("button.crumb", { onclick: () => go(to) }, ic("left", 16), label);
const loading = (v) => { const p = h("p.boot", "Loading..."); v.append(p); return () => p.remove(); };
const fail = (v, e) => v.append(h(".card", h("p.err", e.message || String(e))));
const CSV_HEAD = ["Name", "Email", "Joined", "Progress %", "Mastery %", "Topics read", "Cards known", "Cards total", "Quiz attempts", "Quiz correct", "Quiz accuracy %", "Last active"];
const csvRow = (r) => [nameOf(r), r.email, r.joined_at ? r.joined_at.slice(0, 10) : "", r.pct, r.mastery, r.read_topics, r.cards_known, r.cards_total, r.quiz_attempts, r.quiz_correct, r.quiz_attempts ? Math.round((r.quiz_correct / r.quiz_attempts) * 100) : "", r.last_active ? r.last_active.slice(0, 10) : ""];
const csvText = (head, rows) => "\uFEFF" + [head, ...rows].map((l) => l.map(csvCell).join(",")).join("\r\n"); // the BOM makes Excel read accents correctly
const inviteText = (email, role, what) => `You have been invited to ACEIT as ${role}${what ? " for " + what : ""}.\n\n1. Open ${site()}\n2. Create an account (or log in) with this email address: ${email}\n3. Confirm your email if you are asked to. A Workspace tab then appears at the bottom of the screen.`;

const managedSchools = () => (S.DEMO ? (S.isManager() ? [{ school_id: "sch-a", school_name: "Alpha University" }] : []) : S.managed);
const managesSchool = (sid) => S.isAdmin() || managedSchools().some((m) => m.school_id === sid);

function tabsFor() {
  const t = [];
  if (S.isAdmin()) t.push({ k: "schools", label: "Schools", icon: "school" }, { k: "admins", label: "Admins", icon: "shieldcheck" }, { k: "people", label: "People", icon: "users" }, { k: "content", label: "Content", icon: "layers" }, { k: "settings", label: "Settings", icon: "gear" }, { k: "activity", label: "Activity", icon: "history" });
  else {
    const ms = managedSchools();
    ms.forEach((m) => t.push({ k: "school/" + m.school_id, label: ms.length > 1 ? m.school_name : "My school", icon: "school" }));
    if (S.isTeacher()) t.push({ k: "teaching", label: "My classes", icon: "users" });
  }
  return t;
}
export const workspaceLabel = () => (S.isAdmin() ? "Platform" : S.isManager() ? "School" : "Teaching");

/* ---------- entry point ---------- */
// X = { LECS, SUBJECTS, EXAMS, route, ensureCourse } from main.js
export async function viewWorkspace(v, X, parts) {
  const tabs = tabsFor();
  if (!tabs.length) return v.append(h(".hero", h("h1", "Workspace")), empty("You are not set up as an instructor, school manager or admin yet. Ask your school to add your email address."));
  v.classList.add("ws");
  const rest = (parts[1] ? parts.slice(1) : tabs[0].k.split("/")), page = rest[0];
  const c = { v, X, tabs, active: null, courseName: (id) => X.SUBJECTS.find((s) => s.id === id)?.name || id, courseColor: (id) => X.SUBJECTS.find((s) => s.id === id)?.color || "var(--brand)" };
  const tabBar = (active) => tabs.length > 1 ? h(".ws-tabs", { role: "navigation", "aria-label": "Workspace" }, tabs.map((t) => h("button.chip" + (t.k === active ? ".on" : ""), { "aria-current": t.k === active ? "page" : "false", onclick: () => go(t.k) }, ic(t.icon, 16), t.label))) : "";
  c.tabBar = tabBar;
  const head = (title, sub) => v.append(h(".hero", h("h1", title), sub ? h("p", sub) : ""));
  c.head = head;
  if (page === "schools" && S.isAdmin()) { head("Platform", "Every school, class and person on ACEIT."); v.append(tabBar("schools")); return pageSchools(c); }
  if (page === "school") { const sid = rest[1]; if (!managesSchool(sid) && !(await A.mySchools()).data.some((s) => s.school_id === sid)) return v.append(empty("You don't have access to that school.")); v.append(tabBar(S.isAdmin() ? "schools" : "school/" + sid)); return pageSchool(c, sid, rest[2] || "classes"); }
  if (page === "class") { return pageClass(c, rest[1]); }
  if (page === "teaching") { head("My classes", "The classes you teach: progress, join codes and exam dates."); v.append(tabBar("teaching")); return pageTeaching(c); }
  if (page === "admins" && S.isAdmin()) { head("Platform admins", "People who can manage every school."); v.append(tabBar("admins")); return pageAdmins(c); }
  if (page === "people" && S.isAdmin()) { head("Find a person", "Look up an account to block it or remove it."); v.append(tabBar("people")); return pagePeople(c); }
  if (page === "content" && S.isAdmin()) { head("Course content", "What students and instructors can read."); v.append(tabBar("content")); return pageContent(c); }
  if (page === "settings" && S.isAdmin()) { head("Settings", "Sign-up safety and allowed emails."); v.append(tabBar("settings")); return pageSettings(c); }
  if (page === "activity" && S.isAdmin()) { head("Activity", "Recent changes and problems."); v.append(tabBar("activity")); return pageActivity(c); }
  return v.append(empty("That page doesn't exist."));
}

/* ---------- platform admin: schools ---------- */
async function pageSchools(c) {
  const { v } = c, done = loading(v), r = await A.mySchools(); done();
  if (r.error) return fail(v, r.error);
  const list = r.data, sum = (k) => list.reduce((t, s) => t + (s[k] || 0), 0);
  v.append(h(".tiles", tile("Schools", list.length), tile("Classes", sum("classes")), tile("Instructors", sum("teachers")), tile("Students", sum("students")), tile("Active this week", sum("active7"))), newSchoolPanel(c),
    list.length ? h(".stack", { style: "margin-top:12px" }, list.map((s) => schoolCard(c, s))) : empty("No schools yet. Create the first one above."));
}
function schoolCard(c, s) {
  return h("button.card.rowcard", { style: "--tc:var(--brand)", onclick: () => go("school/" + s.school_id) },
    h(".symtile", { style: "width:46px;height:46px;--tc:var(--brand)" }, ic("school", 22)),
    h(".grow", h("b", s.name), s.active ? "" : h("span.pill.bad", { style: "margin-left:8px" }, "Suspended"),
      h(".src", { style: "margin:2px 0 0" }, [s.region, s.courses.map(c.courseName).join(", ") || "no courses yet"].filter(Boolean).join(" · ")),
      h(".kv", h("span", h("b", s.classes), s.classes === 1 ? " class" : " classes"), h("span", h("b", s.teachers), s.teachers === 1 ? " instructor" : " instructors"), h("span", h("b", s.students), s.seat_limit ? ` of ${s.seat_limit} students` : s.students === 1 ? " student" : " students"), h("span", h("b", s.active7), " active this week"))),
    ic("right", 18));
}
function newSchoolPanel(c) {
  const nm = h("input", { placeholder: "e.g. Prairie University", maxlength: 120, "aria-label": "School name" });
  const rg = h("input", { placeholder: "e.g. Alberta, Canada", "aria-label": "Region" });
  const seats = h("input", { type: "number", min: 1, placeholder: "No limit", "aria-label": "Student limit" });
  const mail = h("input", { type: "email", placeholder: "manager@school.ca (optional)", "aria-label": "First school manager email" });
  const boxes = c.X.SUBJECTS.map((sj) => { const cb = h("input", { type: "checkbox", checked: true }); cb.dataset.id = sj.id; return { cb, el: h("label.check", cb, `${sj.name}: ${sj.title}`) }; });
  const make = h("button.btn", { onclick: () => busy(make, async () => {
    if (nm.value.trim().length < 2) { toast("Enter the school's name"); return; }
    const r = await A.createSchool(nm.value.trim(), rg.value.trim(), +seats.value || null); if (r.error) { toast(r.error.message); return; }
    const sid = r.data; for (const b of boxes.filter((x) => x.cb.checked)) await A.licenseCourse(sid, b.cb.dataset.id, true);
    let note = "School created";
    if (mail.value.trim()) { const i = await A.invite(mail.value.trim(), "manager", sid); note += i.error ? ". The manager invite did not go through: " + i.error.message : i.data === "added" ? " and the manager was added" : " and the manager invite was saved"; }
    toast(note); go("school/" + sid);
  }) }, ic("plus", 16), "Create school");
  return panel("New school", false, h(".fgrid.two", field("School name", nm), field("Region", rg), field("Student limit", seats, "Leave empty for no limit."), field("First school manager", mail, "They get access when they sign up with this email.")),
    h("label", "Courses this school may use"), h("div", boxes.map((b) => b.el)), h("div", { style: "margin-top:10px" }, make));
}

/* ---------- a school (admin and school managers) ---------- */
async function pageSchool(c, sid, tab) {
  const { v } = c, done = loading(v), [sr, cr] = await Promise.all([A.mySchools(), A.classesOf(sid)]); done();
  const sc = sr.data.find((s) => s.school_id === sid);
  if (!sc) return v.append(empty("School not found, or you don't have access to it."));
  const classes = cr.data, manage = managesSchool(sid), admin = S.isAdmin();
  const tabs = [["classes", "Classes", "cards"], ["people", "Instructors", "users"], admin ? ["settings", "Settings", "gear"] : null, manage ? ["activity", "Activity", "history"] : null].filter(Boolean);
  v.append(admin ? crumb("All schools", "schools") : "",
    h(".hero", h("h1", sc.name, sc.active ? "" : h("span.pill.bad", { style: "margin-left:10px;vertical-align:middle" }, "Suspended")), h("p", [sc.region, sc.courses.map(c.courseName).join(", ")].filter(Boolean).join(" · "))),
    h(".tiles", tile("Classes", sc.classes), tile("Instructors", sc.teachers), tile("Students", sc.students, sc.seat_limit ? `of ${sc.seat_limit} seats` : "no seat limit"), tile("Active this week", sc.active7)),
    h(".ws-tabs", tabs.map(([k, label, icon]) => h("button.chip" + (tab === k ? ".on" : ""), { onclick: () => go(`school/${sid}/${k}`) }, ic(icon, 16), label))));
  if (tab === "people") return v.append(await peopleTab(c, sc, classes));
  if (tab === "settings" && admin) return v.append(settingsTab(c, sc));
  if (tab === "activity" && manage) return v.append(await activityBlock(sid));
  const open = classes.filter((k) => !k.archived), arch = classes.filter((k) => k.archived);
  const all = h("button.btn.alt.sm", { onclick: () => busy(all, async () => {
    const lines = []; for (const k of classes) { const r = await A.roster(k.class_id); (r.data || []).forEach((x) => lines.push([sc.name, k.name, c.courseName(k.course_id), ...csvRow(x)])); }
    download(`aceit-${sc.name.replace(/[^A-Za-z0-9]+/g, "-")}-progress.csv`, csvText(["School", "Class", "Course", ...CSV_HEAD], lines), "text/csv");
  }) }, ic("download", 16), "Download all students (CSV)");
  v.append(manage ? newClassPanel(c, sc) : "", manage && classes.length ? h("div", { style: "margin-top:12px" }, all) : "", open.length ? h(".stack", { style: "margin-top:12px" }, open.map((k) => classCard(c, k))) : empty(manage ? "No classes yet. Create the first one above." : "No classes yet."),
    arch.length ? panel(`Archived classes (${arch.length})`, false, h(".stack", arch.map((k) => classCard(c, k)))) : "");
}
function classCard(c, k) {
  const col = c.courseColor(k.course_id);
  return h("button.card.rowcard", { style: `--tc:${col}`, onclick: () => go("class/" + k.class_id) },
    h(".grow", h("b", k.name), k.archived ? h("span.pill.mute", { style: "margin-left:8px" }, "Archived") : "",
      h(".src", { style: "margin:2px 0 0" }, [c.courseName(k.course_id), k.term, k.teachers.length ? k.teachers.map(nameOf).join(", ") : "no instructor yet"].filter(Boolean).join(" · ")),
      h(".kv", h("span", h("b", k.students), k.max_students ? ` of ${k.max_students} students` : k.students === 1 ? " student" : " students"), h("span", h("b", k.active7), " active this week"), h("span", "code ", h("b", k.code))),
      meter(k.avg_pct, col)),
    ic("right", 18));
}
function newClassPanel(c, sc) {
  const licensed = c.X.SUBJECTS.filter((sj) => sc.courses.includes(sj.id));
  if (!licensed.length) return warn(h("b", "No courses yet."), h(".src", S.isAdmin() ? "Open the Settings tab and tick the courses this school may use." : "Ask the platform admin to add a course for your school."));
  const course = h("select", { "aria-label": "Course" }, licensed.map((sj) => h("option", { value: sj.id }, `${sj.name}: ${sj.title}`)));
  const nm = h("input", { placeholder: "e.g. ERTH 209 Section 2", maxlength: 120, "aria-label": "Class name" });
  const term = h("input", { placeholder: "e.g. Fall 2026", "aria-label": "Term" });
  const seats = h("input", { type: "number", min: 1, placeholder: "No limit", "aria-label": "Student limit" });
  const code = h("input", { placeholder: "Leave empty for a random code", autocomplete: "off", "aria-label": "Custom join code" });
  const make = h("button.btn", { onclick: () => busy(make, async () => {
    const name = nm.value.trim() || `${c.courseName(course.value)} ${term.value.trim() || "class"}`;
    const r = await A.createClass(sc.school_id, course.value, name, term.value.trim(), +seats.value || null, code.value.trim()); if (r.error) { toast(r.error.message); return; }
    toast("Class created"); go("class/" + r.data);
  }) }, ic("plus", 16), "Create class");
  return panel("New class", false, h(".fgrid.two", field("Course", course), field("Class name", nm), field("Term", term), field("Student limit", seats, "Leave empty for no limit."), field("Join code", code, "6+ characters. Leave empty for a random one.")), h("div", { style: "margin-top:10px" }, make));
}

async function peopleTab(c, sc, classes) {
  const out = h("div"), admin = S.isAdmin(), manage = managesSchool(sc.school_id), done = loading(out);
  const [pp, inv] = await Promise.all([A.schoolPeople(sc.school_id), A.pendingInvites(sc.school_id)]); done();
  const teachers = new Map();
  classes.forEach((k) => k.teachers.forEach((t) => { const e = teachers.get(t.id) || { id: t.id, email: t.email, name: t.name, classes: [] }; e.classes.push({ id: k.class_id, name: k.name }); teachers.set(t.id, e); }));
  const refresh = () => c.X.route();
  const pending = h("div");
  const drawPending = async () => {
    const r = await A.pendingInvites(sc.school_id);
    pending.replaceChildren(r.data.length ? h("div", r.data.map((i) => h(".row", { style: "padding:6px 0;flex-wrap:nowrap" }, ic("mail", 16), h("div", { style: "flex:1;min-width:0" }, h("b", i.email), h(".src", { style: "margin:0" }, `${i.role === "manager" ? "School manager" : "Instructor"}${i.class_id ? ", " + (classes.find((k) => k.class_id === i.class_id)?.name || "") : ""}. Expires ${new Date(i.expires_at).toLocaleDateString()}`)),
      h("button.btn.alt.sm", { "aria-label": "Copy invite message for " + i.email, onclick: () => copy(inviteText(i.email, i.role === "manager" ? "a school manager" : "an instructor", sc.name), "Message copied") }, ic("copy", 16)),
      h("button.btn.alt.sm", { "aria-label": "Cancel invite for " + i.email, onclick: async () => { const x = await A.revokeInvite(i.id); if (x.error) toast(x.error.message); else { toast("Invite cancelled"); drawPending(); } } }, ic("x", 16))))) : h(".src", "No pending invites."));
  };
  const rows = [...teachers.values()].sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  out.append(
    h(".card", { style: "margin-top:12px" }, h("h3", "Instructors"),
      rows.length ? h("div", rows.map((t) => h(".row", { style: "padding:8px 0;border-bottom:1px solid var(--line);flex-wrap:nowrap;align-items:flex-start" }, h("span.av", initials(nameOf(t))),
        h("div", { style: "flex:1;min-width:0" }, h("b", nameOf(t)), h(".src", { style: "margin:0" }, t.email),
          h("div", t.classes.map((k) => h("span.xchip", h("a", { href: "#/work/class/" + k.id, style: "text-decoration:none;color:inherit" }, k.name), manage ? h("button", { "aria-label": `Remove ${nameOf(t)} from ${k.name}`, onclick: async () => { if (!confirm(`Remove ${nameOf(t)} from ${k.name}?`)) return; const x = await A.removeTeacher(t.id, k.id); if (x.error) toast(x.error.message); else { toast("Removed"); refresh(); } } }, ic("x", 14)) : ""))))))) : h(".src", "No instructors yet. Invite the first one below.")),
    manage ? inviteCard(c, { role: "teacher", title: "Invite an instructor", classes, sid: sc.school_id, schoolName: sc.name, pending: drawPending }) : "",
    manage ? h(".card", { style: "margin-top:12px" }, h("h3", "Pending invites"), h(".src", { style: "margin:0 0 6px" }, "People you invited who have not signed up yet. Invites expire after 14 days."), pending) : "",
    h(".card", { style: "margin-top:12px" }, h("h3", "School managers"), h(".src", { style: "margin:0 0 6px" }, "Managers create classes, add instructors and see every class in the school."),
      pp.data.filter((p) => p.role === "manager").map((m) => h(".row", { style: "padding:6px 0;flex-wrap:nowrap" }, h("span.av", initials(nameOf(m))), h("div", { style: "flex:1;min-width:0" }, h("b", nameOf(m)), h(".src", { style: "margin:0" }, m.email)),
        admin ? h("button.btn.alt.sm", { "aria-label": "Remove manager " + m.email, onclick: async () => { if (!confirm(`Remove ${m.email} as a manager of ${sc.name}?`)) return; const x = await A.removeManager(m.user_id, sc.school_id); if (x.error) toast(x.error.message); else { toast("Removed"); refresh(); } } }, ic("trash", 16)) : "")),
      !pp.data.some((p) => p.role === "manager") ? h(".src", "No managers yet.") : "",
      admin ? inviteForm(c, { role: "manager", sid: sc.school_id, button: "Invite manager", schoolName: sc.name, pending: drawPending }) : ""));
  drawPending();
  return out;
}

// one email box + button that invites someone; shows a message to send when the person has not signed up yet
function inviteForm(c, o) {
  const em = h("input", { type: "email", placeholder: "name@school.ca", autocomplete: "off", "aria-label": "Email address" });
  const sel = o.classes && !o.kid ? h("select", { "aria-label": "Class" }, o.classes.filter((k) => !k.archived).map((k) => h("option", { value: k.class_id }, k.name))) : null;
  const out = h("div");
  const btn = h("button.btn.sm", { onclick: () => busy(btn, async () => {
    const email = em.value.trim(); if (!email) { toast("Enter an email address"); return; }
    const kid = o.kid || sel?.value; if (o.role === "teacher" && !kid) { toast("Create a class first"); return; }
    const r = await A.invite(email, o.role, o.sid, kid); if (r.error) { toast(r.error.message); return; }
    em.value = "";
    if (r.data === "added") { toast(`${email} was added`); c.X.route(); return; }
    const text = inviteText(email, o.role === "manager" ? "a school manager" : o.role === "admin" ? "a platform admin" : "an instructor", o.schoolName || "");
    out.replaceChildren(h(".warnbox.good", h("b", "Invite saved for " + email), h(".src", "They get the role as soon as they sign up and confirm this email address. Send them this message:"),
      h("pre", { style: "white-space:pre-wrap;font:inherit;background:var(--card);border:1px solid var(--line);border-radius:4px;padding:8px;margin:6px 0" }, text), h("button.btn.alt.sm", { onclick: () => copy(text, "Message copied") }, ic("copy", 16), "Copy message")));
    o.pending?.();
  }) }, ic("userplus", 16), o.button || "Invite");
  return h("div", { style: "margin-top:10px" }, h(".row.wrapx", em, sel || "", btn), out);
}
function inviteCard(c, o) {
  return h(".card", { style: "margin-top:12px" }, h("h3", o.title), h(".src", { style: "margin:0" }, "If they already have an account they are added at once. Otherwise they get the role when they sign up with that email."), inviteForm(c, { ...o, button: "Invite" }));
}

function settingsTab(c, sc) {
  const nm = h("input", { value: sc.name, maxlength: 120, "aria-label": "School name" }), rg = h("input", { value: sc.region || "", "aria-label": "Region" });
  const seats = h("input", { type: "number", min: 1, value: sc.seat_limit || "", placeholder: "No limit", "aria-label": "Student limit" });
  const active = h("input", { type: "checkbox" }); active.checked = sc.active;
  const save = h("button.btn", { onclick: () => busy(save, async () => {
    if (nm.value.trim().length < 2) { toast("Enter the school's name"); return; }
    const r = await A.updateSchool(sc.school_id, nm.value.trim(), rg.value.trim(), active.checked, +seats.value || null); if (r.error) toast(r.error.message); else { toast("Saved"); c.X.route(); }
  }) }, ic("check", 16), "Save");
  const lic = c.X.SUBJECTS.map((sj) => { const cb = h("input", { type: "checkbox" }); cb.checked = sc.courses.includes(sj.id);
    cb.onchange = async () => { cb.disabled = true; const r = await A.licenseCourse(sc.school_id, sj.id, cb.checked); cb.disabled = false; if (r.error) { toast(r.error.message); cb.checked = !cb.checked; } else toast(cb.checked ? `${sj.name} added` : `${sj.name} removed`); };
    return h("label.check", cb, `${sj.name}: ${sj.title}`); });
  return h("div", h(".card", { style: "margin-top:12px" }, h("h3", "School details"), h(".fgrid.two", field("School name", nm), field("Region", rg), field("Student limit", seats, "Leave empty for no limit.")),
      h("label.check", active, "School is active (untick to suspend: nobody in it can join or study)"), h("div", { style: "margin-top:8px" }, save)),
    h(".card", { style: "margin-top:12px" }, h("h3", "Courses this school may use"), h(".src", { style: "margin:0 0 6px" }, "Managers can only create classes for these courses."), h("div", lic)));
}

async function activityBlock(sid) {
  const out = h("div"), done = loading(out), rows = await A.auditLines(sid); done();
  return h(".card", { style: "margin-top:12px" }, h("h3", "Recent changes"), rows.length ? h("div", rows.map((r) => h(".logrow", h("span.src", { style: "margin:0" }, when(r.at)), h("span", `${r.action}${r.target ? ": " + r.target : ""}${r.detail ? " (" + r.detail + ")" : ""}`)))) : h(".src", "Nothing yet."));
}

/* ---------- instructor home ---------- */
async function pageTeaching(c) {
  const { v } = c, done = loading(v), r = await A.classesOf(null); done();
  if (r.error) return fail(v, r.error);
  const list = r.data.filter((k) => !k.archived);
  if (!list.length) return v.append(empty("You are not assigned to a class yet. Ask your school manager to add you."));
  const by = {}; list.forEach((k) => (by[k.school_name] ||= []).push(k));
  v.append(h(".tiles", tile("Classes", list.length), tile("Students", list.reduce((t, k) => t + k.students, 0)), tile("Active this week", list.reduce((t, k) => t + k.active7, 0))),
    ...Object.entries(by).map(([school, ks]) => h("div", { style: "margin-top:12px" }, Object.keys(by).length > 1 ? h("h3", { style: "margin:0 0 6px" }, school) : "", h(".stack", ks.map((k) => classCard(c, k))))));
}

/* ---------- one class ---------- */
async function pageClass(c, kid) {
  const { v, X } = c, done = loading(v), [cs, ro] = await Promise.all([A.classesOf(null), A.roster(kid)]); done();
  const cls = cs.data.find((k) => k.class_id === kid);
  if (!cls) return v.append(empty("Class not found, or you don't have access to it."));
  try { await X.ensureCourse(cls.course_id); } catch {} // lecture lists give the question text and per-lecture bars
  const manage = managesSchool(cls.school_id), rows = ro.data, col = c.courseColor(cls.course_id);
  const backTo = manage ? "school/" + cls.school_id : "teaching";
  v.append(c.tabBar(S.isAdmin() ? "schools" : manage ? "school/" + cls.school_id : "teaching"), crumb(manage ? cls.school_name : "My classes", backTo),
    h(".hero", h("h1", cls.name, cls.archived ? h("span.pill.mute", { style: "margin-left:10px;vertical-align:middle" }, "Archived") : ""), h("p", [c.courseName(cls.course_id), cls.term, cls.school_name].filter(Boolean).join(" · "))),
    h(".tiles", tile("Students", cls.students, cls.max_students ? `of ${cls.max_students} seats` : ""), tile("Active this week", cls.active7), tile("Average progress", cls.avg_pct + "%"), tile("Average mastery", cls.avg_mastery + "%")),
    codeCard(c, cls, manage), examCard(c, cls), rosterCard(c, cls, rows, col), insightsCard(c, cls, rows), manage ? teachersCard(c, cls) : "", feedbackCard(cls));
}

function codeCard(c, cls, manage) {
  const text = `Join ${cls.name} on ACEIT:\n1. Open ${site()} and log in (or create an account).\n2. Tap "Join a class" and enter this code: ${cls.code}`;
  const inp = h("input", { placeholder: "Set your own code (6+ characters)", autocomplete: "off", "aria-label": "New join code" });
  const set = async (code) => { const r = await A.setCode(cls.class_id, code); if (r.error) toast(r.error.message); else { toast("Join code changed"); c.X.route(); } };
  const expired = cls.code_expires && cls.code_expires < new Date().toISOString().slice(0, 10), full = cls.max_students && cls.students >= cls.max_students;
  const nm = h("input", { value: cls.name, maxlength: 120, "aria-label": "Class name" }), term = h("input", { value: cls.term || "", "aria-label": "Term" });
  const seats = h("input", { type: "number", min: 1, value: cls.max_students || "", placeholder: "No limit", "aria-label": "Student limit" }), exp = h("input", { type: "date", value: cls.code_expires || "", "aria-label": "Code expires on" });
  const closed = h("input", { type: "checkbox" }); closed.checked = cls.archived;
  const save = h("button.btn.sm", { onclick: () => busy(save, async () => { const r = await A.updateClass(cls.class_id, nm.value.trim() || cls.name, term.value.trim(), +seats.value || null, exp.value || null, closed.checked); if (r.error) toast(r.error.message); else { toast("Saved"); c.X.route(); } }) }, ic("check", 16), "Save settings");
  return h(".card", { style: "margin-top:12px" }, h("h3", "Join code"), h(".src", { style: "margin:0 0 8px" }, "Students tap Join a class and type this code."),
    h(".codebox", h("code", cls.code), h(".row", { style: "gap:6px" }, h("button.btn.alt.sm", { onclick: () => copy(cls.code, "Code copied") }, ic("copy", 16), "Code"), h("button.btn.alt.sm", { onclick: () => copy(text, "Message copied") }, ic("mail", 16), "Message"))),
    expired ? warn(h("b", "This code has expired."), h(".src", { style: "margin:0" }, "New students cannot join with it. Change the expiry date below or make a new code.")) : "",
    full ? warn(h("b", "This class is full."), h(".src", { style: "margin:0" }, "Raise the student limit below to let more students in.")) : "",
    h(".row.wrapx", { style: "margin-top:10px" }, inp, h("button.btn.sm", { onclick: () => { if (inp.value.trim().length < 6) { toast("Use at least 6 characters"); return; } set(inp.value.trim()); } }, "Save"),
      h("button.btn.alt.sm", { onclick: () => { if (confirm("Make a new random code? The old code stops working for new students.")) set(""); } }, ic("refresh", 16), "Random")),
    manage ? panel("Class settings", false, h(".fgrid.two", field("Class name", nm), field("Term", term), field("Student limit", seats, "Leave empty for no limit."), field("Code stops working on", exp, "Leave empty for no end date.")),
      h("label.check", closed, "Archive this class (closed to new students)"), h("div", { style: "margin-top:8px" }, save)) : "");
}

function examCard(c, cls) {
  const nm = h("input", { value: cls.exam_name || "", placeholder: "e.g. Midterm", "aria-label": "Exam name" }), dt = h("input", { type: "date", value: cls.exam_date || "", "aria-label": "Exam date" });
  const save = h("button.btn.sm", { onclick: () => busy(save, async () => { const r = await A.setExam(cls.class_id, nm.value.trim(), dt.value || null); if (r.error) toast(r.error.message); else toast(dt.value ? "Exam date saved" : "Exam date cleared"); }) }, ic("calendar", 16), "Save");
  return h(".card", { style: "margin-top:12px" }, h("h3", "Exam date"), h(".src", { style: "margin:0 0 6px" }, "Students see a countdown and a study plan for their weakest lectures."), h(".row.wrapx", nm, dt, save));
}

function rosterCard(c, cls, rows, col) {
  const search = h("input", { type: "search", placeholder: "Search students", "aria-label": "Search students" });
  const sort = h("select", { "aria-label": "Sort students" }, [["name", "Name"], ["low", "Lowest progress first"], ["quiet", "Longest since active first"]].map(([k, t]) => h("option", { value: k }, t)));
  const list = h(".stack");
  const draw = () => {
    const q = search.value.trim().toLowerCase();
    const shown = rows.filter((r) => !q || (nameOf(r) + " " + r.email).toLowerCase().includes(q));
    shown.sort(sort.value === "low" ? (a, b) => a.pct - b.pct : sort.value === "quiet" ? (a, b) => (new Date(a.last_active || 0)) - (new Date(b.last_active || 0)) : (a, b) => nameOf(a).localeCompare(nameOf(b)));
    list.replaceChildren(...(shown.length ? shown.map((r) => personRow(c, cls, r, col)) : [h(".empty", rows.length ? "No student matches that search." : "No students yet. Share the join code above.")]));
  };
  search.oninput = draw; sort.onchange = draw; draw();
  const csv = () => download(`aceit-${cls.name.replace(/[^A-Za-z0-9]+/g, "-")}-progress.csv`, csvText(CSV_HEAD, rows.map(csvRow)), "text/csv");
  return h(".card", { style: "margin-top:12px" }, h(".row", { style: "justify-content:space-between" }, h("h3", { style: "margin:0" }, `Students (${rows.length})`), rows.length ? h("button.btn.alt.sm", { onclick: csv }, ic("download", 16), "Download CSV") : ""),
    h(".toolbar", search, sort), list);
}
function personRow(c, cls, r, col) {
  const d = h("details.person");
  const body = h("div.pbody");
  d.append(h("summary", h("span.av", initials(nameOf(r))), h(".meta", h("b", nameOf(r)), h(".src", r.email)), meter(r.pct, col),
    h("span.when", ago(r.last_active), r.blocked ? " · blocked" : "", quiet(r.last_active) ? " · quiet" : "")), body);
  let loaded = false;
  d.addEventListener("toggle", async () => {
    if (!d.open || loaded) return; loaded = true; body.append(h(".src", { style: "margin-top:8px" }, "Loading..."));
    const prog = await A.studentProgress(r.user_id), ls = c.X.LECS.filter((l) => l.subject === cls.course_id);
    body.replaceChildren(
      !prog ? h(".src", { style: "margin-top:8px" }, "No progress saved yet.") : h("div", { style: "margin-top:6px" }, ls.map((l) => { const st = S.statsFrom(prog, l); return h(".lrow", h("b", l.title), meter(st.pct, l.color), h(".src", `Read ${st.read}/${st.secs} · Cards ${st.known}/${st.cards} · Quiz ${st.right}/${st.qs} right`)); })),
      h(".kv", h("span", "Joined ", h("b", r.joined_at ? new Date(r.joined_at).toLocaleDateString() : "-")), h("span", "Quiz accuracy ", h("b", r.quiz_attempts ? Math.round((r.quiz_correct / r.quiz_attempts) * 100) + "%" : "-")), h("span", "Mastery ", h("b", r.mastery + "%"))),
      h(".row", { style: "margin-top:10px" },
        h("button.btn.alt.sm", { onclick: async () => { if (!confirm(`Remove ${nameOf(r)} from ${cls.name}? Their account stays, they just lose access to this class.`)) return; const x = await A.removeStudent(r.user_id, cls.class_id); if (x.error) toast(x.error.message); else { toast("Removed from class"); c.X.route(); } } }, ic("x", 16), "Remove from class"),
        S.isAdmin() ? h("button.btn.alt.sm", { onclick: async () => { const x = await A.blockAccount(r.user_id, !r.blocked); if (x.error) toast(x.error.message); else { toast(r.blocked ? "Unblocked" : "Blocked"); c.X.route(); } } }, ic("ban", 16), r.blocked ? "Unblock" : "Block") : "",
        S.isAdmin() ? h("button.btn.warn.sm", { onclick: async () => { if (!confirm(`Permanently delete the account ${r.email}? This cannot be undone.`)) return; const x = await A.deleteAccount(r.user_id); if (x.error) toast(x.error.message); else { toast("Account deleted"); c.X.route(); } } }, ic("trash", 16), "Delete account") : ""));
  });
  return d;
}

function insightsCard(c, cls, rows) {
  const box = h("div", h(".src", "Loading..."));
  const quietList = rows.filter((r) => quiet(r.last_active));
  A.questionStats(cls.class_id).then((r) => {
    const byId = new Map();
    c.X.LECS.filter((l) => l.subject === cls.course_id).forEach((l) => (l.quiz || []).forEach((q) => q.q && byId.set(q.id, { q, where: l.title })));
    (c.X.EXAMS[cls.course_id]?.tests || []).forEach((t) => t.questions.forEach((q) => byId.set(q.id, { q, where: t.title })));
    const hard = r.data.filter((x) => x.attempts >= 3 && byId.has(x.qid)).map((x) => ({ ...x, acc: x.correct / x.attempts, ...byId.get(x.qid) })).sort((a, b) => a.acc - b.acc).slice(0, 8);
    box.replaceChildren(h("b", { style: "font-size:.9rem" }, "Hardest questions (3+ attempts)"),
      hard.length ? h("div", hard.map((x) => h(".fb", { style: "margin-top:6px" }, h("b", `${Math.round(x.acc * 100)}% correct `), h("span.src", { style: "margin:0" }, `${plural(x.attempts, "attempt")} · ${x.where}`), h("div", String(x.q.q).split("\n")[0])))) : h(".src", "Not enough answers yet. This fills in as students take quizzes."),
      h("b", { style: "font-size:.9rem;display:block;margin-top:12px" }, `Quiet for 7+ days (${quietList.length})`),
      quietList.length ? h("p", { style: "margin:4px 0 0" }, quietList.map(nameOf).join(", ")) : h(".src", rows.length ? "Everyone has been active this week." : "No students yet."));
  });
  return h(".card", { style: "margin-top:12px" }, h("h3", "Class insights"), box);
}

function teachersCard(c, cls) {
  const refresh = () => c.X.route();
  return h(".card", { style: "margin-top:12px" }, h("h3", "Instructors of this class"),
    cls.teachers.length ? h("div", cls.teachers.map((t) => h("span.xchip", nameOf(t), h("button", { "aria-label": "Remove " + nameOf(t), onclick: async () => { if (!confirm(`Remove ${nameOf(t)} from ${cls.name}?`)) return; const x = await A.removeTeacher(t.id, cls.class_id); if (x.error) toast(x.error.message); else { toast("Removed"); refresh(); } } }, ic("x", 14))))) : h(".src", "No instructor yet."),
    inviteForm(c, { role: "teacher", kid: cls.class_id, sid: cls.school_id, schoolName: cls.school_name + ", " + cls.name, button: "Invite instructor" }));
}

function feedbackCard(cls) {
  const box = h("div", h(".src", "Loading..."));
  A.feedbackFor(cls.class_id).then((list) => {
    const avg = list.length ? (list.reduce((t, f) => t + (f.rating || 0), 0) / list.length).toFixed(1) : null;
    box.replaceChildren(list.length ? h("div", h("p", { style: "margin:0 0 6px" }, `Average rating ${avg} from ${plural(list.length, "message")}.`), ...list.slice(0, 6).map((f) => h(".fb", { style: "margin-top:6px" }, h("b", "★".repeat(f.rating || 0) + " "), f.message || "(no message)", h(".src", when(f.at))))) : h(".src", "No feedback yet. Students can send it from their profile."));
  });
  return h(".card", { style: "margin-top:12px" }, h("h3", "Student feedback"), box);
}

/* ---------- platform admin: admins, people, content, settings, activity ---------- */
async function pageAdmins(c) {
  const { v } = c, done = loading(v), [ad, inv] = await Promise.all([A.admins(), A.pendingInvites(null)]); done();
  const me = (S.session?.user?.email || "").toLowerCase();
  const em = h("input", { type: "email", placeholder: "name@email.com", autocomplete: "off", "aria-label": "Email address" });
  const add = h("button.btn.sm", { onclick: () => busy(add, async () => {
    const email = em.value.trim(); if (!email) { toast("Enter an email address"); return; }
    let r = await A.setAdmin(email, true);
    if (r.error && /no account/i.test(r.error.message)) { const i = await A.invite(email, "admin"); if (i.error) { toast(i.error.message); return; } toast("Invite saved. They become an admin when they sign up and confirm this email."); copy(inviteText(email, "a platform admin", ""), "Message copied"); em.value = ""; c.X.route(); return; }
    if (r.error) { toast(r.error.message); return; } toast(email + " is now an admin"); c.X.route();
  }) }, ic("userplus", 16), "Add admin");
  v.append(h(".card", h("h3", "Platform admins"), h(".src", { style: "margin:0 0 6px" }, "Admins can manage every school, class and account. Keep this list short."),
      ad.error ? h("p.err", ad.error.message) : h("div", ad.data.map((a) => h(".row", { style: "padding:6px 0;flex-wrap:nowrap" }, h("span.av", initials(nameOf(a))), h("div", { style: "flex:1;min-width:0" }, h("b", nameOf(a), a.email.toLowerCase() === me ? h("span.pill.navy", { style: "margin-left:8px" }, "you") : ""), h(".src", { style: "margin:0" }, a.email)),
        h("button.btn.alt.sm", { "aria-label": "Remove admin " + a.email, onclick: async () => { if (!confirm(`Remove ${a.email} as an admin?`)) return; const x = await A.setAdmin(a.email, false); if (x.error) toast(x.error.message); else { toast("Removed"); c.X.route(); } } }, ic("trash", 16))))),
      h("div", { style: "margin-top:10px" }, h(".row.wrapx", em, add), h(".src", "If they already have an account they become an admin straight away. Otherwise an invite is saved for when they sign up."))),
    inv.data.length ? h(".card", { style: "margin-top:12px" }, h("h3", "Pending admin invites"), h("div", inv.data.map((i) => h(".row", { style: "padding:6px 0;flex-wrap:nowrap" }, h("div", { style: "flex:1" }, h("b", i.email), h(".src", { style: "margin:0" }, "Expires " + new Date(i.expires_at).toLocaleDateString())), h("button.btn.alt.sm", { onclick: async () => { await A.revokeInvite(i.id); c.X.route(); } }, "Cancel"))))) : "");
}

function pagePeople(c) {
  const q = h("input", { type: "search", placeholder: "Search by email or name", "aria-label": "Search accounts", autocomplete: "off" }), out = h("div", { style: "margin-top:8px" });
  let seq = 0;
  q.oninput = async () => {
    const my = ++seq, list = await A.findAccounts(q.value); if (my !== seq) return;
    out.replaceChildren(q.value.trim().length < 2 ? h(".src", "Type at least 2 letters.") : list.length ? h(".stack", list.map((p) => h(".card", h(".row", { style: "flex-wrap:nowrap" }, h("span.av", initials(nameOf(p))), h("div", { style: "flex:1;min-width:0" }, h("b", nameOf(p), p.is_admin ? h("span.pill.navy", { style: "margin-left:8px" }, "admin") : "", p.blocked ? h("span.pill.bad", { style: "margin-left:8px" }, "blocked") : ""), h(".src", { style: "margin:0" }, p.email), p.classes?.length ? h(".src", { style: "margin:2px 0 0" }, p.classes.join(", ")) : "")),
      p.is_admin ? "" : h(".row", { style: "margin-top:8px" }, h("button.btn.alt.sm", { onclick: async () => { const x = await A.blockAccount(p.id, !p.blocked); if (x.error) toast(x.error.message); else { toast(p.blocked ? "Unblocked" : "Blocked"); q.oninput(); } } }, ic("ban", 16), p.blocked ? "Unblock" : "Block"),
        h("button.btn.warn.sm", { onclick: async () => { if (!confirm(`Permanently delete the account ${p.email}? This cannot be undone.`)) return; const x = await A.deleteAccount(p.id); if (x.error) toast(x.error.message); else { toast("Account deleted"); q.oninput(); } } }, ic("trash", 16), "Delete account"))))) : h(".empty", "No account matches."));
  };
  c.v.append(h(".card", q, out));
}

function pageContent(c) {
  const pp = publishPanel(c.X.LECS, c.X.SUBJECTS); pp.open = true;
  c.v.append(pp, h(".card", { style: "margin-top:12px" }, h("h3", "How content is protected"), h("p", { style: "margin:0" }, "Lectures and practice exams are copied into the database, where only members of a class (and the staff of that class's school) can read them. Press the button above again after you change any lecture.")));
}

async function pageSettings(c) {
  const { v } = c, done = loading(v), [flag, auth, domains] = await Promise.all([A.confirmEmailFlag(), A.authSettings(), A.getDomains()]); done();
  const on = auth && auth.autoconfirm === false, off = auth && auth.autoconfirm === true;
  const flagBox = h("input", { type: "checkbox" }); flagBox.checked = !!flag; flagBox.disabled = off && !flag;
  flagBox.onchange = async () => { flagBox.disabled = true; const r = await A.setConfirmEmail(flagBox.checked); flagBox.disabled = false; if (r.error) { toast(r.error.message); flagBox.checked = !flagBox.checked; } else toast(flagBox.checked ? "Invites to new people are allowed" : "Invites to new people are paused"); };
  const dom = h("input", { value: domains, placeholder: "school.ca, uni.ca (leave empty to allow anyone)", "aria-label": "Allowed email domains" });
  const saveDom = h("button.btn.sm", { onclick: () => busy(saveDom, async () => { const r = await A.setDomains(dom.value.trim()); toast(r.error ? r.error.message : "Saved"); }) }, "Save");
  v.append(h(".card", h("h3", "Sign-up safety: Confirm email"),
      off ? warn(h("b", "Confirm email is OFF in Supabase."), h(".src", { style: "margin:2px 0 0" }, "Anyone can create an account with an email address that is not theirs. That is fine for students, but it means a role could be claimed by someone who is not the person you invited. Turn it on before inviting real instructors or managers: Supabase > Authentication > Providers > Email > Confirm email. You also need your own email sender so the confirmation emails arrive (docs/SCHOOL-SETUP.md).")) : "",
      on ? h(".warnbox.good", h("b", "Confirm email is ON in Supabase."), h(".src", { style: "margin:2px 0 0" }, "People must prove they own an email address before they get any role.")) : "",
      !auth ? warn(h("b", "Could not check Supabase."), h(".src", { style: "margin:2px 0 0" }, "Check the setting yourself in Supabase > Authentication > Providers > Email.")) : "",
      h("label.check", flagBox, "Allow invites to people who have not signed up yet"), h(".src", "Only tick this once Confirm email is on. Until then you can still add people who already have an account.")),
    h(".card", { style: "margin-top:12px" }, h("h3", "Allowed email domains"), h(".src", { style: "margin:0 0 6px" }, "Only these domains can create accounts. Your own admin email and anyone you invited always work."), h(".row.wrapx", dom, saveDom)));
}

async function pageActivity(c) {
  const { v } = c, done = loading(v), [rows, errs] = await Promise.all([A.auditLines(null), A.errorLines()]); done();
  v.append(h(".card", h("h3", "Recent changes"), rows.length ? h("div", rows.map((r) => h(".logrow", h("span.src", { style: "margin:0" }, when(r.at)), h("span", `${r.action}${r.target ? ": " + r.target : ""}${r.detail ? " (" + r.detail + ")" : ""}`)))) : h(".src", "Nothing yet.")),
    h(".card", { style: "margin-top:12px" }, h("h3", "Error reports"), errs.length ? h("div", errs.map((r) => h(".fb", { style: "margin-top:6px" }, h("b", r.msg), h(".src", `${when(r.at)} ${r.url || ""}`)))) : h(".src", "No errors reported. Good.")));
}
