// Sample school data so the Workspace can be previewed without a database (localhost only):
//   ?demo&role=admin   ?demo&role=manager   ?demo&role=instructor     (?demo&admin is the same as role=admin)
// It answers the same function names, with the same argument names, as the real database, so the screens behave the same way.
import { demoRole } from "./store.js";

const DAY = 864e5;
let seed = 11;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const pick = (a) => a[Math.floor(rnd() * a.length)];
let LECS = [], T = null;

const NAMES = ["Ava Chen", "Noah Singh", "Lima Aziz", "Omar Bakr", "Sofia Rossi", "Liam Tremblay", "Maya Patel", "Ethan Wong", "Zara Ahmed", "Lucas Martin", "Nora Haddad", "Jack Olsen", "Priya Nair", "Leo Fischer", "Hana Sato", "Ben Carter", "Isla Murphy", "Yusuf Demir"];
const uid = (n) => "u" + n;
const email = (n, dom) => n.toLowerCase().replace(/[^a-z ]/g, "").replace(" ", ".") + "@" + dom;

function build() {
  T = { schools: [], classes: [], people: {}, enrol: [], invites: [], admins: [], audit: [], confirm: true, domains: "" };
  const school = (id, name, region, seat_limit, courses) => T.schools.push({ id, name, region, active: true, seat_limit, courses, managers: [] });
  school("sch-a", "Alpha University", "Alberta", 400, ["astr207", "erth209"]);
  school("sch-b", "Beta College", "Ontario", 120, ["erth209"]);
  school("sch-c", "ACEIT Direct", "Alberta, Canada", null, ["astr207", "erth209"]);
  const person = (id, nm, em) => (T.people[id] = { id, email: em, display_name: nm, blocked: false });
  person("me", "You", "you@alpha.ca");
  person("t1", "Dr. Rivera", "rivera@alpha.ca"); person("t2", "Prof. Okafor", "okafor@alpha.ca"); person("t3", "Dr. Lindqvist", "lindqvist@beta.ca");
  person("m1", "Morgan Reid", "morgan.reid@alpha.ca"); person("m2", "Casey Ng", "casey.ng@beta.ca");
  T.schools[0].managers = [role() === "manager" ? "me" : "m1"]; T.schools[1].managers = ["m2"];
  T.admins = [{ user_id: "me", email: "you@alpha.ca", display_name: "You" }];
  const me = role() === "instructor" ? "me" : null;
  const cls = (id, sid, course, name, term, code, teachers, exam, extra = {}) => T.classes.push({ id, school_id: sid, course_id: course, name, term, code, code_expires: null, max_students: null, exam_name: exam ? "Midterm" : null, exam_date: exam, archived: false, teacher_ids: teachers, ...extra });
  const soon = new Date(Date.now() + 19 * DAY).toISOString().slice(0, 10);
  cls("k-a1", "sch-a", "astr207", "ASTR 207 Section 1", "Fall 2026", "K7QM-2WXP", [me || "t1"], soon);
  cls("k-a2", "sch-a", "erth209", "ERTH 209 Section 2", "Fall 2026", "R4DN-8FJC", [me || "t2"], null);
  cls("k-a3", "sch-a", "astr207", "ASTR 207 Evening", "Fall 2026", "B9HT-3KLE", ["t1"], null, { max_students: 20 });
  cls("k-b1", "sch-b", "erth209", "ERTH 209 Evening", "Fall 2026", "Q2VX-6MNA", ["t3"], null);
  cls("k-c1", "sch-c", "erth209", "Geology (ERTH 209)", "Fall 2026", "madi@77", [], null);
  cls("k-c2", "sch-c", "astr207", "Astronomy (ASTR 207)", "Fall 2026", "cry@18", [], null);
  const size = { "k-a1": 11, "k-a2": 8, "k-a3": 6, "k-b1": 9, "k-c1": 4, "k-c2": 3 };
  let n = 0;
  for (const c of T.classes) {
    for (let i = 0; i < size[c.id]; i++, n++) {
      const nm = NAMES[n % NAMES.length], id = uid(n);
      person(id, nm, email(nm, c.school_id === "sch-b" ? "beta.ca" : c.school_id === "sch-c" ? "gmail.com" : "alpha.ca"));
      const eng = rnd(), quiet = i % 5 === 4;
      T.enrol.push({ user_id: id, class_id: c.id, joined_at: new Date(Date.now() - (5 + rnd() * 30) * DAY).toISOString(), eng, quiet, sum: null });
    }
  }
  T.people[uid(3)].blocked = false;
  T.invites = [
    { id: "i1", email: "new.instructor@alpha.ca", role: "teacher", school_id: "sch-a", class_id: "k-a2", created_at: new Date(Date.now() - 2 * DAY).toISOString(), expires_at: new Date(Date.now() + 12 * DAY).toISOString() },
    { id: "i2", email: "dean@beta.ca", role: "manager", school_id: "sch-b", class_id: null, created_at: new Date(Date.now() - 1 * DAY).toISOString(), expires_at: new Date(Date.now() + 13 * DAY).toISOString() },
  ];
  const log = (d, action, target, detail, sid) => T.audit.push({ id: T.audit.length + 1, at: new Date(Date.now() - d * 3600e3).toISOString(), actor: "me", action, target, detail, school_id: sid });
  log(2, "create class", "ASTR 207 Evening", "astr207", "sch-a"); log(9, "invite teacher", "new.instructor@alpha.ca", null, "sch-a"); log(30, "change class code", "k-a1", "code changed", "sch-a");
  log(52, "create school", "Beta College", null, "sch-b"); log(70, "invite manager", "dean@beta.ca", null, "sch-b"); log(200, "license course", "erth209", null, "sch-b");
}

// per-student numbers for a course from the loaded lecture lists (sample data, deterministic)
function summaries() {
  for (const e of T.enrol) {
    if (e.sum) continue;
    const c = T.classes.find((x) => x.id === e.class_id), ls = LECS.filter((l) => l.subject === c.course_id);
    const scale = e.quiet ? 0.18 : 0.3 + e.eng * 0.7;
    const data = { quiz: {}, read: {}, cards: {}, games: {}, sr: {} };
    ls.forEach((l, li) => {
      if (rnd() < scale + 0.1 - li * 0.04) (l.sections || []).slice(0, Math.max(1, Math.round((l.sections || []).length * scale * (0.5 + rnd())))).forEach((s) => ((data.read[l.id] ||= {})[s.id] = 1));
      (l.cards || []).forEach((cd) => { if (rnd() < scale * 0.8) { data.cards[cd.id] = rnd() < 0.7 ? "know" : "learning"; data.sr[cd.id] = { box: 1 + Math.floor(rnd() * 5), due: 0 }; } });
      (l.quiz || []).forEach((q, k) => { if (rnd() < scale) { const a = 1 + Math.floor(rnd() * 4); const hard = k % 7 === 0; data.quiz[q.id] = { attempts: a, correct: Math.round(a * (hard ? 0.25 : 0.55 + 0.4 * scale)), last: rnd() < (hard ? 0.3 : 0.75) }; } });
      (l.games || []).slice(0, 2).forEach((g) => { if (rnd() < scale) data.games[l.id + ":" + g] = 1; });
    });
    e.data = data;
    const qa = Object.values(data.quiz);
    const st = ls.map((l) => {
      const secs = (l.sections || []).filter((s) => data.read[l.id]?.[s.id]).length, known = (l.cards || []).filter((cd) => data.cards[cd.id] === "know").length;
      const right = (l.quiz || []).filter((q) => data.quiz[q.id]?.last).length, games = Math.min((l.games || []).filter((g) => data.games[l.id + ":" + g]).length, 3);
      const parts = [[secs, (l.sections || []).length], [known, (l.cards || []).length], [right, (l.quiz || []).length], [games, Math.min(3, (l.games || []).length)]].filter((p) => p[1] > 0);
      return parts.length ? Math.round((parts.reduce((s, p) => s + p[0] / p[1], 0) / parts.length) * 100) : 0;
    });
    const pct = st.length ? Math.round(st.reduce((a, b) => a + b, 0) / st.length) : 0;
    e.sum = {
      pct, mastery: Math.round(pct * (0.6 + rnd() * 0.3)), read_topics: ls.reduce((t, l) => t + (l.sections || []).filter((s) => data.read[l.id]?.[s.id]).length, 0),
      cards_known: Object.values(data.cards).filter((x) => x === "know").length, cards_total: ls.reduce((t, l) => t + (l.cards || []).length, 0),
      quiz_attempts: qa.reduce((t, q) => t + q.attempts, 0), quiz_correct: qa.reduce((t, q) => t + q.correct, 0),
      last_active: e.quiet ? new Date(Date.now() - (9 + rnd() * 14) * DAY).toISOString() : new Date(Date.now() - rnd() * 5 * DAY).toISOString(),
    };
  }
}

export function init(lecs) { LECS = lecs; if (!T) build(); summaries(); }
const role = () => demoRole();
const adminView = () => role() === "admin";
const mySchoolId = () => "sch-a";
const myClassIds = () => T.classes.filter((c) => c.teacher_ids.includes("me")).map((c) => c.id);
const canManage = (c) => adminView() || (role() === "manager" && c.school_id === mySchoolId());
const canTeach = (c) => canManage(c) || (role() === "instructor" && c.teacher_ids.includes("me"));
const classOf = (kid) => T.classes.find((c) => c.id === kid);
const need = (ok, msg) => { if (!ok) throw new Error(msg); };
const log = (action, target, detail, sid) => T.audit.unshift({ id: T.audit.length + 1, at: new Date().toISOString(), actor: "me", action, target, detail, school_id: sid || null });
const enrolOf = (kid) => T.enrol.filter((e) => e.class_id === kid);
const teacherJson = (c) => c.teacher_ids.map((id) => ({ id, email: T.people[id]?.email, name: T.people[id]?.display_name }));
const week = (e) => e.sum && Date.now() - new Date(e.sum.last_active) < 7 * DAY;
const avg = (a) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : 0);

const API = {
  staff_schools() {
    const list = T.schools.filter((s) => adminView() || s.id === mySchoolId());
    return list.map((s) => {
      const cs = T.classes.filter((c) => c.school_id === s.id), en = T.enrol.filter((e) => cs.some((c) => c.id === e.class_id));
      return { school_id: s.id, name: s.name, region: s.region, active: s.active, seat_limit: s.seat_limit, seats_used: new Set(en.map((e) => e.user_id)).size, courses: s.courses, classes: cs.length,
        teachers: new Set(cs.flatMap((c) => c.teacher_ids)).size, managers: s.managers.length, students: new Set(en.map((e) => e.user_id)).size, active7: new Set(en.filter(week).map((e) => e.user_id)).size };
    });
  },
  staff_classes({ sid } = {}) {
    return T.classes.filter((c) => canTeach(c) && (!sid || c.school_id === sid)).map((c) => {
      const en = enrolOf(c.id);
      return { class_id: c.id, school_id: c.school_id, school_name: T.schools.find((s) => s.id === c.school_id).name, course_id: c.course_id, name: c.name, term: c.term, code: c.code, code_expires: c.code_expires,
        max_students: c.max_students, exam_name: c.exam_name, exam_date: c.exam_date, archived: c.archived, students: en.length, active7: en.filter(week).length,
        avg_pct: avg(en.map((e) => e.sum.pct)), avg_mastery: avg(en.map((e) => e.sum.mastery)), teachers: teacherJson(c) };
    });
  },
  class_roster({ kid }) {
    const c = classOf(kid); need(c && canTeach(c), "not allowed");
    return enrolOf(kid).map((e) => ({ user_id: e.user_id, email: T.people[e.user_id].email, display_name: T.people[e.user_id].display_name, blocked: T.people[e.user_id].blocked, joined_at: e.joined_at, ...e.sum }))
      .sort((a, b) => a.display_name.localeCompare(b.display_name));
  },
  class_question_stats({ kid }) {
    const c = classOf(kid); need(c && canTeach(c), "not allowed");
    const out = {};
    enrolOf(kid).forEach((e) => Object.entries(e.data.quiz).forEach(([q, v]) => { const o = (out[q] ||= { qid: q, attempts: 0, correct: 0 }); o.attempts += v.attempts; o.correct += v.correct; }));
    return Object.values(out);
  },
  staff_people({ sid }) {
    need(adminView() || (role() === "manager" && sid === mySchoolId()), "not allowed");
    const s = T.schools.find((x) => x.id === sid), cs = T.classes.filter((c) => c.school_id === sid), teachers = {};
    cs.forEach((c) => c.teacher_ids.forEach((t) => (teachers[t] ||= []).push(c.name)));
    return [...s.managers.map((m) => ({ role: "manager", user_id: m, email: T.people[m].email, display_name: T.people[m].display_name, classes: [] })),
      ...Object.entries(teachers).map(([t, names]) => ({ role: "teacher", user_id: t, email: T.people[t].email, display_name: T.people[t].display_name, classes: names }))];
  },
  list_invites({ sid } = {}) {
    return T.invites.filter((i) => (sid ? i.school_id === sid && (adminView() || role() === "manager") : adminView() && !i.school_id));
  },
  list_admins() { need(adminView(), "admin only"); return T.admins; },
  admin_create_school({ nm, rg, seats }) {
    need(adminView(), "admin only"); const id = "sch-" + Math.random().toString(36).slice(2, 7);
    T.schools.push({ id, name: nm.trim(), region: rg || null, active: true, seat_limit: seats || null, courses: [], managers: [] }); log("create school", nm.trim(), null, id); return id;
  },
  admin_update_school({ sid, nm, rg, is_active, seats }) {
    need(adminView(), "admin only"); Object.assign(T.schools.find((s) => s.id === sid), { name: nm.trim(), region: rg || null, active: is_active, seat_limit: seats || null }); log(is_active ? "update school" : "suspend school", nm, null, sid);
  },
  admin_set_school_course({ sid, cid, flag }) {
    need(adminView(), "admin only"); const s = T.schools.find((x) => x.id === sid); s.courses = flag ? [...new Set([...s.courses, cid])] : s.courses.filter((x) => x !== cid); log(flag ? "license course" : "remove course license", cid, null, sid);
  },
  create_class({ sid, cid, nm, tm, seats, new_code }) {
    need(adminView() || (role() === "manager" && sid === mySchoolId()), "school managers only");
    const s = T.schools.find((x) => x.id === sid); need(adminView() || s.courses.includes(cid), "this school is not licensed for that course");
    const code = (new_code || "").trim() || "NEW" + Math.floor(rnd() * 9) + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
    need(!T.classes.some((c) => c.code.toLowerCase() === code.toLowerCase()), "duplicate key value violates unique constraint \"classes_code_uq\"");
    const id = "k-" + Math.random().toString(36).slice(2, 6); T.classes.push({ id, school_id: sid, course_id: cid, name: nm.trim(), term: tm || null, code, code_expires: null, max_students: seats || null, exam_name: null, exam_date: null, archived: false, teacher_ids: [] });
    log("create class", nm.trim(), cid, sid); return id;
  },
  update_class({ kid, nm, tm, seats, expires, closed }) {
    const c = classOf(kid); need(canManage(c), "school managers only"); Object.assign(c, { name: nm.trim(), term: tm || null, max_students: seats || null, code_expires: expires || null, archived: closed }); log(closed ? "archive class" : "update class", nm, null, c.school_id);
  },
  set_class_code({ kid, new_code }) {
    const c = classOf(kid); need(canTeach(c), "instructors only"); const code = (new_code || "").trim() || "NEW" + Math.floor(rnd() * 9) + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
    need(code.length >= 6, "code too short (use at least 6 characters)");
    need(!T.classes.some((x) => x.id !== kid && x.code.toLowerCase() === code.toLowerCase()), "duplicate key value violates unique constraint \"classes_code_uq\"");
    c.code = code; log("change class code", kid, "code changed", c.school_id); return code;
  },
  set_class_exam({ kid, nm, d }) { const c = classOf(kid); need(canTeach(c), "instructors only"); c.exam_name = nm || null; c.exam_date = d || null; log("set exam date", kid, (nm || "") + " " + (d || "cleared"), c.school_id); },
  remove_student({ uid, kid }) { const c = classOf(kid); need(canTeach(c), "instructors only"); T.enrol = T.enrol.filter((e) => !(e.user_id === uid && e.class_id === kid)); log("remove student from class", T.people[uid]?.email, kid, c.school_id); },
  invite_user({ target_email, rl, sid, kid }) {
    const em = target_email.trim().toLowerCase(); need(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em), "that does not look like an email address");
    if (rl === "admin") need(adminView(), "admin only");
    else if (rl === "manager") { need(adminView(), "only the platform admin can add school managers"); need(sid, "choose a school"); }
    else if (rl === "teacher") { const c = classOf(kid); need(c, "choose a class"); need(canManage(c), "only school managers can add instructors"); sid = c.school_id; }
    const known = Object.values(T.people).find((p) => p.email === em);
    need(known || T.confirm, "Turn on Confirm email (Workspace, Settings) before inviting someone who has not signed up yet.");
    log("invite " + rl, em, null, sid);
    if (known) { // existing account: the role applies at once
      if (rl === "teacher") classOf(kid).teacher_ids.push(known.id); else if (rl === "manager") T.schools.find((s) => s.id === sid).managers.push(known.id); else T.admins.push({ user_id: known.id, email: em, display_name: known.display_name });
      return "added";
    }
    T.invites.unshift({ id: "i" + (T.invites.length + 5), email: em, role: rl, school_id: sid || null, class_id: kid || null, created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 14 * DAY).toISOString() });
    return "invited";
  },
  revoke_invite({ iid }) { T.invites = T.invites.filter((i) => i.id !== iid); log("revoke invite", iid); },
  remove_teacher({ uid, kid }) { const c = classOf(kid); need(canManage(c), "school managers only"); c.teacher_ids = c.teacher_ids.filter((t) => t !== uid); log("remove instructor", T.people[uid]?.email, kid, c.school_id); },
  remove_manager({ uid, sid }) { need(adminView(), "admin only"); const s = T.schools.find((x) => x.id === sid); s.managers = s.managers.filter((m) => m !== uid); log("remove school manager", T.people[uid]?.email, null, sid); },
  admin_set_admin({ target_email, flag }) {
    need(adminView(), "admin only"); const em = target_email.trim().toLowerCase(); const p = Object.values(T.people).find((x) => x.email === em); need(p, "no account with that email");
    if (!flag) need(T.admins.length > 1, "you cannot remove the last admin");
    T.admins = flag ? [...T.admins.filter((a) => a.email !== em), { user_id: p.id, email: em, display_name: p.display_name }] : T.admins.filter((a) => a.email !== em); log(flag ? "add admin" : "remove admin", em);
  },
  admin_get_confirm_email() { return T.confirm; },
  admin_set_confirm_email({ flag }) { need(adminView(), "admin only"); T.confirm = flag; log("confirm email setting", flag ? "on" : "off"); },
  admin_set_blocked({ uid: id, flag }) { need(adminView(), "admin only"); T.people[id].blocked = flag; log(flag ? "block" : "unblock", T.people[id].email); },
  admin_delete_user({ uid: id }) { need(adminView(), "admin only"); T.enrol = T.enrol.filter((e) => e.user_id !== id); log("delete account", T.people[id]?.email); delete T.people[id]; },
  admin_get_domains() { return T.domains; },
  admin_set_domains({ list }) { T.domains = list; log("set allowed domains", list); },
};

export async function rpc(name, args) {
  const f = API[name];
  if (!f) return { error: { message: "This is not available in the preview." } };
  try { return { data: f(args || {}) }; } catch (e) { return { error: { message: e.message } }; }
}
export const progressOf = (userId) => T.enrol.find((e) => e.user_id === userId)?.data || null;
export const findPeople = (q) => Object.values(T.people).filter((p) => p.id !== "me" && (p.email.includes(q) || p.display_name.toLowerCase().includes(q))).slice(0, 12).map((p) => ({ ...p, classes: T.enrol.filter((e) => e.user_id === p.id).map((e) => classOf(e.class_id)?.name) }));
export const auditLines = (sid) => T.audit.filter((a) => !sid || a.school_id === sid).slice(0, 40);
export const errorLines = () => [{ id: 1, at: new Date(Date.now() - 3 * 3600e3).toISOString(), msg: "Example: Failed to fetch (offline)", url: "#/l/motion/quiz" }];
export const feedbackFor = (kid) => (kid ? [{ id: 1, at: new Date(Date.now() - DAY).toISOString(), rating: 5, message: "The flashcards make revision so much easier." }, { id: 2, at: new Date(Date.now() - 3 * DAY).toISOString(), rating: 4, message: "More practice questions on gravity please." }] : []);
