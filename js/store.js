import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../config.js";
import { nextState, dueCards as srsDue, dayNum } from "./srs.js";

const LOCAL = ["localhost", "127.0.0.1"].includes(location.hostname);
// ?demo on localhost skips login for local testing; ?admin adds the admin view
export const DEMO = !SUPABASE_ANON_KEY || (LOCAL && location.search.includes("demo"));
export const canSeeRefs = () => (DEMO ? LOCAL && location.search.includes("admin") : !!profile?.is_admin && !pref("student"));
export const isInstructor = () => (DEMO ? LOCAL && location.search.includes("admin") : !!profile?.is_admin || instructorOf.size > 0);
export const isAdmin = () => (DEMO ? LOCAL && location.search.includes("admin") : !!profile?.is_admin);
export function pref(k) { try { return localStorage.getItem("erth209:" + k) === "1"; } catch { return false; } }
export function setPref(k, v) { try { localStorage.setItem("erth209:" + k, v ? "1" : "0"); } catch {} }
export let sb = null;
export let session = null;
export let profile = null;
export let access = new Set();
export let instructorOf = new Set();
export let settings = (() => { const m = typeof location !== "undefined" && /localhost|127\.0\.0\.1/.test(location.hostname) && location.search.match(/exam=(\d{4}-\d{2}-\d{2})/); return m ? { astr207: { class_id: "astr207", exam_name: "Midterm", exam_date: m[1] } } : {}; })(); // ?exam=YYYY-MM-DD previews the countdown on localhost

const KEY = "erth209:progress:v1";
let data = load();
let timer = null;

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || blank(); } catch { return blank(); }
}
function blank() { return { cards: {}, quiz: {}, read: {}, games: {}, days: {}, prefs: {}, sr: {} }; }
export const progress = () => data;

const subs = [];
export const onChange = (fn) => subs.push(fn);
export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {}
  const d = new Date().toISOString().slice(0, 10);
  data.days[d] = 1;
  clearTimeout(timer);
  timer = setTimeout(push, 1500);
  subs.forEach((f) => { try { f(); } catch {} });
}

export let sync = { state: "saved", at: null };
const syncSubs = []; export const onSync = (fn) => syncSubs.push(fn);
const setSync = (state) => { sync = { state, at: state === "saved" ? Date.now() : sync.at }; syncSubs.forEach((f) => { try { f(sync); } catch {} }); };
let retry = null;
async function push() {
  if (!sb || !session || !profile || profile.blocked) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) { setSync("offline"); return; }
  setSync("syncing");
  try {
    const r = await sb.from("progress").upsert({ user_id: session.user.id, data, updated_at: new Date().toISOString() });
    if (r.error) throw r.error;
    setSync("saved"); clearTimeout(retry);
  } catch { setSync("error"); clearTimeout(retry); retry = setTimeout(push, 15000); } // keep the work and try again
}
if (typeof addEventListener === "function") { addEventListener("online", () => push()); addEventListener("offline", () => setSync("offline")); }

export async function initBackend() {
  if (DEMO) return;
  const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm");
  sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: s } = await sb.auth.getSession();
  session = s.session;
  if (session) await loadProfile();
  sb.auth.onAuthStateChange((ev, s2) => {
    session = s2;
    if (ev === "PASSWORD_RECOVERY") location.hash = "#/reset";
  });
}

export async function loadProfile() {
  let { data: p } = await sb.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
  if (!p) { await sb.rpc("ensure_profile"); ({ data: p } = await sb.from("profiles").select("*").eq("id", session.user.id).maybeSingle()); }
  profile = p;
  const { data: ac, error: acErr } = await sb.from("class_access").select("class_id").eq("user_id", session.user.id);
  access = new Set((ac || []).map((x) => x.class_id));
  if (acErr && p?.access_ok) access.add("erth209"); // database patch 2 not installed yet: keep old ERTH 209 users working
  try { const { data: ins } = await sb.from("class_instructors").select("class_id").eq("user_id", session.user.id); instructorOf = new Set((ins || []).map((x) => x.class_id)); } catch { instructorOf = new Set(); }
  try { const { data: st } = await sb.from("class_settings").select("*"); settings = Object.fromEntries((st || []).map((x) => [x.class_id, x])); } catch { settings = {}; }
  if (p && !p.blocked) {
    const { data: r } = await sb.from("progress").select("data").eq("user_id", session.user.id).maybeSingle();
    if (r?.data) data = merge(data, r.data);
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {}
  }
}

// keep the best of local and cloud progress
function merge(a, b) {
  const out = blank();
  for (const k of ["cards", "read", "games", "days", "prefs", "sr"]) out[k] = { ...b[k], ...a[k] };
  const ids = new Set([...Object.keys(a.quiz || {}), ...Object.keys(b.quiz || {})]);
  for (const id of ids) {
    const x = (a.quiz || {})[id], y = (b.quiz || {})[id];
    out.quiz[id] = !x ? y : !y ? x : (x.attempts >= y.attempts ? x : y);
  }
  return out;
}

export async function signUp(email, password, name) {
  return sb.auth.signUp({ email, password, options: { data: { name } } });
}
export async function signIn(email, password) {
  const r = await sb.auth.signInWithPassword({ email, password });
  if (!r.error) { session = r.data.session; await loadProfile(); }
  return r;
}
export async function signOut() { await sb.auth.signOut(); session = null; profile = null; access = new Set(); instructorOf = new Set(); settings = {}; }
export async function forgot(email) {
  return sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
}
export async function setNewPassword(pw) { return sb.auth.updateUser({ password: pw }); }
export const hasAccess = (classId) => DEMO || !!profile?.is_admin || access.has(classId) || instructorOf.has(classId);
// "Join a class": type any class code and unlock whichever class it belongs to
export async function joinByCode(code, classIds) {
  let { data: cid, error } = await sb.rpc("redeem_class_by_code", { code });
  if (error && /too_many_attempts/.test(error.message)) return "LOCKED";
  if (error) { for (const id of classIds) { const r = await sb.rpc("redeem_class_code", { cid: id, code }); if (r.data) { cid = id; break; } } }
  if (cid) await loadProfile();
  return cid || null;
}
export async function redeemClass(cid, code) {
  let { data: ok, error } = await sb.rpc("redeem_class_code", { cid, code });
  if (error && /too_many_attempts/.test(error.message)) return { ok: false, locked: true, error };
  if (error && cid === "erth209") ({ data: ok, error } = await sb.rpc("redeem_code", { code })); // older database
  if (ok) await loadProfile();
  return { ok, error };
}

// admin
export async function adminList() {
  const [p, g] = await Promise.all([
    sb.from("profiles").select("*").order("created_at"),
    sb.from("progress").select("user_id,data,updated_at"),
  ]);
  return { profiles: p.data || [], progress: g.data || [], error: p.error || g.error };
}
export const adminBlock = (uid, flag) => sb.rpc("admin_set_blocked", { uid, flag });
export const adminDelete = (uid) => sb.rpc("admin_delete_user", { uid });
export const adminSetCode = (cid, new_code) => sb.rpc("admin_set_class_code", { cid, new_code });
export const adminCodes = () => sb.rpc("admin_get_codes");
export async function adminAccess() { const { data } = await sb.from("class_access").select("user_id,class_id"); return data || []; }

// ---------- progress helpers ----------
export function cardState(id) { return data.cards[id]; }
export function setCard(id, v) { data.cards[id] = v; (data.sr ||= {})[id] = nextState(data.sr[id], v === "know"); save(); }
export const dueCards = (cards) => srsDue(cards, data.sr || {});
export const dueCount = (cards) => dueCards(cards).length;
export function setConf(id, conf) { const q = data.quiz[id]; if (q) { q.conf = conf; save(); } }
export function recordAnswer(id, correct) {
  const q = data.quiz[id] || { attempts: 0, correct: 0, last: null };
  q.attempts++; if (correct) q.correct++; q.last = correct; data.quiz[id] = q; save();
}
export function markRead(lec, sec) { (data.read[lec] ||= {})[sec] = 1; save(); }
export function gameDone(id) { data.games[id] = (data.games[id] || 0) + 1; save(); }

export function lectureStats(lec) {
  const secs = lec.sections || [];
  const read = secs.filter((s) => data.read[lec.id]?.[s.id]).length;
  const cards = lec.cards || [];
  const known = cards.filter((c) => data.cards[c.id] === "know").length;
  const qs = lec.quiz || [];
  const right = qs.filter((q) => data.quiz[q.id]?.last).length;
  const games = (lec.games || []).filter((g) => data.games[lec.id + ":" + g]).length;
  const gameGoal = Math.min(3, (lec.games || []).length); // play any 3 games for full credit
  const parts = [
    [read, secs.length], [known, cards.length], [right, qs.length], [Math.min(games, gameGoal), gameGoal],
  ].filter((p) => p[1] > 0);
  const pct = parts.length ? Math.round((parts.reduce((s, p) => s + p[0] / p[1], 0) / parts.length) * 100) : 0;
  return { read, secs: secs.length, known, cards: cards.length, right, qs: qs.length, games, pct };
}

export function streak() {
  let n = 0; const d = new Date();
  for (;;) {
    const k = d.toISOString().slice(0, 10);
    if (data.days[k]) { n++; d.setDate(d.getDate() - 1); }
    else if (n === 0) { d.setDate(d.getDate() - 1); if (!data.days[d.toISOString().slice(0, 10)]) return 0; }
    else return n;
  }
}

export function xp(lecs) {
  let n = 0;
  for (const l of lecs) { const t = lectureStats(l); n += t.read * 3 + t.known * 2 + t.right * 4 + t.games * 10; }
  const lvl = Math.floor(Math.sqrt(n / 12)) + 1;
  const base = 12 * (lvl - 1) ** 2, next = 12 * lvl ** 2;
  return { xp: n, lvl, pct: Math.round(((n - base) / (next - base)) * 100), next };
}
export function setLast(lecId, tab) { data.last = { lecId, tab }; try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {} }
export const last = () => data.last;

// profile (name, avatar) lives with the progress so it follows the student across devices
export const prefs = () => data.prefs || {};
export function setPrefs(o) { data.prefs = { ...(data.prefs || {}), ...o }; save(); }
export async function setName(n) {
  setPrefs({ name: n });
  if (profile) profile.display_name = n;
  if (sb && session) await sb.rpc("set_my_name", { new_name: n });
}
export const myName = () => prefs().name || profile?.display_name || (session?.user?.email || "").split("@")[0] || "Student";
export async function resetProgress() { const pf = data.prefs; data = blank(); data.prefs = pf; try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {} await push(); }

// the student's own data: what the site holds about them
export function exportData() {
  return { exported: new Date().toISOString(), account: { email: session?.user?.email || null, name: myName(), classes: [...access] }, progress: data };
}
export async function deleteMyAccount() {
  if (!sb) return { error: { message: "Not signed in" } };
  const r = await sb.rpc("delete_my_account");
  if (!r.error) { try { localStorage.removeItem(KEY); } catch {} await sb.auth.signOut(); session = null; profile = null; access = new Set(); }
  return r;
}

/* ---------- protected content (lectures are readable only by members of the class) ---------- */
export async function dbLecture(id) {
  if (!sb || !session) return null;
  try { const { data: r, error } = await sb.from("lecture_content").select("body").eq("lecture_id", id).maybeSingle(); return error ? null : r?.body || null; } catch { return null; }
}
export async function dbExam(classId) {
  if (!sb || !session) return null;
  try { const { data: r, error } = await sb.from("exam_content").select("body").eq("class_id", classId).maybeSingle(); return error ? null : r?.body || null; } catch { return null; }
}
export const publishLecture = (lecture_id, class_id, body) => sb.from("lecture_content").upsert({ lecture_id, class_id, body, updated_at: new Date().toISOString() });
export const publishExam = (class_id, body) => sb.from("exam_content").upsert({ class_id, body, updated_at: new Date().toISOString() });

/* ---------- instructors, codes, exam dates ---------- */
export async function getCodes() {
  let r = await sb.rpc("instructor_get_codes");
  if (r.error && profile?.is_admin) r = await sb.rpc("admin_get_codes");
  return r.data || [];
}
export async function setCode(cid, code) {
  const r = await sb.rpc("instructor_set_code", { cid, new_code: code });
  return r.error && profile?.is_admin ? sb.rpc("admin_set_class_code", { cid, new_code: code }) : r;
}
export const removeFromClass = (uid, cid) => sb.rpc("instructor_remove_student", { uid, cid });
export const setInstructor = (target_email, cid, flag) => sb.rpc("admin_set_instructor", { target_email, cid, flag });
export async function listInstructors() { try { const { data: r } = await sb.from("class_instructors").select("user_id,class_id"); return r || []; } catch { return []; } }
export async function setExam(cid, nm, d) { const r = await sb.rpc("set_class_exam", { cid, nm, d: d || null }); if (!r.error) settings[cid] = { class_id: cid, exam_name: nm, exam_date: d || null }; return r; }
export async function auditLog() { try { const { data: r } = await sb.from("admin_audit").select("*").order("at", { ascending: false }).limit(15); return r || []; } catch { return []; } }
export async function errorLog() { try { const { data: r } = await sb.from("client_errors").select("*").order("at", { ascending: false }).limit(8); return r || []; } catch { return []; } }
export async function feedbackList() { try { const { data: r } = await sb.from("feedback").select("*").order("at", { ascending: false }).limit(20); return r || []; } catch { return []; } }
export const getDomains = async () => { try { const { data: r } = await sb.rpc("admin_get_domains"); return r || ""; } catch { return ""; } };
export const setDomains = (list) => sb.rpc("admin_set_domains", { list });
export const sendFeedback = (cid, r, m) => sb.rpc("submit_feedback", { cid, r, m });
let errCount = 0;
export function reportError(msg, stack) {
  if (!sb || !session || errCount >= 5) return; errCount++;
  sb.rpc("log_client_error", { m: String(msg || ""), s: String(stack || ""), u: location.hash || "" }).then(() => {}, () => {});
}

/* ---------- mastery: a blend of how well cards are remembered and quiz answers are right ---------- */
export function mastery(lec) {
  const sr = data.sr || {}, cs = lec.cards || [], qs = lec.quiz || [];
  const cardM = cs.length ? cs.reduce((t, c) => t + (sr[c.id] ? sr[c.id].box / 5 : 0), 0) / cs.length : null;
  const quizM = qs.length ? qs.filter((q) => data.quiz[q.id]?.last).length / qs.length : null;
  const parts = [cardM, quizM].filter((x) => x !== null);
  return parts.length ? Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 100) : 0;
}
