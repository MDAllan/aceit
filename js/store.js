import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../config.js";
import { nextState, dueCards as srsDue, dayNum } from "./srs.js";

const LOCAL = ["localhost", "127.0.0.1"].includes(location.hostname);
// ?demo on localhost skips login for local testing; ?admin (or ?role=admin|manager|instructor) previews a staff view with sample data
export const DEMO = !SUPABASE_ANON_KEY || (LOCAL && location.search.includes("demo"));
export const demoRole = () => (!LOCAL ? "" : (location.search.match(/role=(\w+)/) || [])[1] || (location.search.includes("admin") ? "admin" : ""));
export const canSeeRefs = () => (DEMO ? demoRole() === "admin" : !!profile?.is_admin && !pref("student"));
export const isAdmin = () => (DEMO ? demoRole() === "admin" : !!profile?.is_admin);
export const isManager = () => (DEMO ? demoRole() === "manager" : managed.length > 0);
export const isTeacher = () => (DEMO ? demoRole() === "instructor" : classes.some((c) => c.role === "teacher") || (model === "legacy" && instructorOf.size > 0)); // legacy: instructors of the older per-course model
export const isStaff = () => isAdmin() || isManager() || isTeacher();
export const isInstructor = isStaff; // older name
export const isV2 = () => DEMO || model === "v2"; // the schools upgrade is installed (or this is the local preview)
export function pref(k) { try { return localStorage.getItem("erth209:" + k) === "1"; } catch { return false; } }
export function setPref(k, v) { try { localStorage.setItem("erth209:" + k, v ? "1" : "0"); } catch {} }
export let sb = null;
export let session = null;
export let profile = null;
export let access = new Set();
export let instructorOf = new Set();
export let classes = [];   // everything the signed-in person studies in, teaches or manages: { class_id, course_id, name, term, school_id, school_name, role, exam_name, exam_date, archived }
export let managed = [];   // schools the person manages: { school_id, school_name }
export let model = "legacy"; // "v2" once the schools upgrade (supabase/RUN-ME-2.sql) is installed in the database
export let settings = (() => { const m = typeof location !== "undefined" && /localhost|127\.0\.0\.1/.test(location.hostname) && location.search.match(/exam=(\d{4}-\d{2}-\d{2})/); return m ? { astr207: { class_id: "astr207", exam_name: "Midterm", exam_date: m[1] } } : {}; })(); // ?exam=YYYY-MM-DD previews the countdown on localhost

const KEY = "erth209:progress:v1";
let data = load();
let timer = null;

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || blank(); } catch { return blank(); }
}
function blank() { return { cards: {}, quiz: {}, read: {}, games: {}, days: {}, prefs: {}, sr: {}, stats: {} }; }
export const progress = () => data;

const subs = [];
export const onChange = (fn) => subs.push(fn);
export const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export function save(studied = false) {
  if (studied) { data.days[localDay()] = 1; noteStudyTime(); }
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {}
  clearTimeout(timer);
  timer = setTimeout(push, 1500);
  subs.forEach((f) => { try { f(); } catch {} });
}

export let sync = { state: "saved", at: null };
const syncSubs = []; export const onSync = (fn) => syncSubs.push(fn);
const setSync = (state) => { sync = { state, at: state === "saved" ? Date.now() : sync.at }; syncSubs.forEach((f) => { try { f(sync); } catch {} }); };
let retry = null;
async function push() {
  if (!sb || !session || !profile || profile.blocked || mfaGate) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) { setSync("offline"); return; }
  setSync("syncing");
  try {
    const r = await sb.from("progress").upsert({ user_id: session.user.id, data, updated_at: new Date().toISOString() });
    if (r.error) throw r.error;
    setSync("saved"); clearTimeout(retry);
    pushSummary();
  } catch { setSync("error"); clearTimeout(retry); retry = setTimeout(push, 15000); } // keep the work and try again
}
// A few numbers per course (not the full progress) so instructors and school managers can see how a class is doing
// without downloading every student's progress. main.js supplies the numbers once it knows the lecture lists.
let summaryFn = null, lastSummary = "";
export const setSummaryProvider = (fn) => { summaryFn = fn; };
export async function pushSummary(force) {
  if (!sb || !session || !profile || profile.blocked || mfaGate || model !== "v2" || !summaryFn) return;
  try {
    const rows = summaryFn(); if (!rows.length) return;
    const key = JSON.stringify(rows); if (key === lastSummary && !force) return;
    const now = new Date().toISOString();
    const r = await sb.from("progress_summary").upsert(rows.map((x) => ({ ...x, user_id: session.user.id, last_active: now })), { onConflict: "user_id,course_id" });
    if (!r.error) lastSummary = key;
  } catch {}
}
if (typeof addEventListener === "function") { addEventListener("online", () => push()); addEventListener("offline", () => setSync("offline")); }

export async function initBackend() {
  if (DEMO) return;
  const { createClient } = await import("./vendor/supabase.js"); // served by this site (see tools/vendor.mjs), not by a CDN
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
  if (p?.deletion_requested_at) { // logging back in within the grace period cancels a scheduled account deletion
    const r = await sb.rpc("cancel_account_deletion");
    if (!r.error && r.data) { p.deletion_requested_at = null; deletionCancelled = true; }
  }
  if (p && !p.blocked) await sb.rpc("claim_invites").then((r) => { if (r.data > 0) invitesClaimed = r.data; }, () => {}); // roles from email invites are applied once the email is confirmed
  await loadClasses();
  await refreshMfaGate();
  if (p && !p.blocked) {
    const { data: r } = await sb.from("progress").select("data").eq("user_id", session.user.id).maybeSingle();
    if (r?.data) data = merge(data, r.data);
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {}
  }
}

/* ---------- two-step login (authenticator app) ---------- */
// mfaGate: "challenge" = the account has an authenticator app but this sign-in has not used it yet;
//          "enroll" = the platform requires two-step login for staff and this staff member has not set it up.
export let mfaGate = null, mfaRequired = false, mfaLevel = "aal1";
export async function refreshMfaGate() {
  mfaGate = null; mfaRequired = false; mfaLevel = "aal1";
  if (DEMO || !sb || !session) return;
  try {
    mfaLevel = (await sb.auth.mfa.getAuthenticatorAssuranceLevel()).data?.currentLevel || "aal1";
    mfaRequired = (await sb.rpc("mfa_required")).data === true;
    if (mfaLevel === "aal2") return;
    const verified = (await sb.auth.mfa.listFactors()).data?.totp || [];
    if (verified.length) mfaGate = "challenge";
    else if (mfaRequired && isStaff()) mfaGate = "enroll";
  } catch {}
}
export const mfa = {
  factors: async () => (await sb.auth.mfa.listFactors()).data?.totp || [], // the authenticator apps that are switched on
  async start() { // a QR code and key to put into the app; tidies up a set-up that was never finished
    const all = (await sb.auth.mfa.listFactors()).data?.all || [];
    for (const f of all.filter((x) => x.status === "unverified")) await sb.auth.mfa.unenroll({ factorId: f.id });
    return sb.auth.mfa.enroll({ factorType: "totp", friendlyName: "ACEIT " + new Date().toISOString().slice(0, 16) });
  },
  async confirm(factorId, code) { // proves the person has the app; the session becomes two-step
    const c = await sb.auth.mfa.challenge({ factorId }); if (c.error) return c;
    const v = await sb.auth.mfa.verify({ factorId, challengeId: c.data.id, code: String(code).replace(/\s/g, "") });
    if (!v.error) await refreshMfaGate();
    return v;
  },
  remove: (factorId) => sb.auth.mfa.unenroll({ factorId }),
};
export const setRequireMfa = (flag) => sb.rpc("admin_set_require_mfa", { flag });

export let deletionCancelled = false; // set when this login cancelled a scheduled account deletion (shown once as a welcome-back message)
export const takeDeletionCancelled = () => { const f = deletionCancelled; deletionCancelled = false; return f; };
export let invitesClaimed = 0; // set when this login turned an email invite into a role (shown once as a welcome message)
export const takeInvitesClaimed = () => { const n = invitesClaimed; invitesClaimed = 0; return n; };

// Which classes the person belongs to, and in what role (student, teacher or manager). Uses the schools model; falls back to the older
// per-course tables when the database upgrade (supabase/RUN-ME-2.sql) has not been run yet, so nobody is locked out in between.
export async function loadClasses() {
  const [c, r] = await Promise.all([sb.rpc("my_classes"), sb.rpc("my_roles")]);
  if (!c.error) {
    model = "v2"; classes = c.data || []; managed = (r.data || []).filter((x) => x.role === "manager");
    access = new Set(classes.map((x) => x.course_id));
    instructorOf = new Set(classes.filter((x) => x.role !== "student").map((x) => x.course_id));
    settings = examByCourse(classes);
    await loadClassItems();
    return;
  }
  model = "legacy"; classes = []; managed = []; // legacy
  const { data: ac, error: acErr } = await sb.from("class_access").select("class_id").eq("user_id", session.user.id); // legacy
  access = new Set((ac || []).map((x) => x.class_id));
  if (acErr && profile?.access_ok) access.add("erth209"); // legacy: database patch 2 not installed yet, keep old ERTH 209 users working
  try { const { data: ins } = await sb.from("class_instructors").select("class_id").eq("user_id", session.user.id); instructorOf = new Set((ins || []).map((x) => x.class_id)); } catch { instructorOf = new Set(); } // legacy
  try { const { data: st } = await sb.from("class_settings").select("*"); settings = Object.fromEntries((st || []).map((x) => [x.class_id, x])); } catch { settings = {}; } // legacy
}
/* ---------- what instructors added to the person's classes (notes, cards, questions, lectures, announcements) ---------- */
export let classItems = [], itemsVersion = 0; // itemsVersion goes up whenever the list is reloaded, so the screens know to rebuild
let demoItems = null, demoMedia = null;
export const setDemoContent = (items, media) => { demoItems = items; demoMedia = media; };
export async function loadClassItems() {
  itemsVersion++;
  if (DEMO) { classItems = demoItems ? demoItems() : []; return; }
  const ids = [...new Set(classes.map((c) => c.class_id))];
  if (!sb || !session || model !== "v2" || !ids.length || mfaGate) { classItems = []; return; }
  const r = await sb.from("class_items").select("id,class_id,kind,lecture_ref,position,status,body,author_name,created_at,updated_at").in("class_id", ids);
  classItems = r.error ? [] : r.data || []; // an error means the database upgrade for this feature is not installed yet: nothing was added
}
// the picture file of an item, from the class's private storage, as an address the page can show (cached for the session)
const mediaCache = new Map();
// a picture is a plain file inside a class's folder, named the way the app names them (the database refuses anything else); the storage library
// does not encode the path it is given, so anything odd is never sent
const MEDIA_PATH = /^[A-Za-z0-9-]{1,64}[/][A-Za-z0-9_-]{8,64}[.](webp|jpg|png)$/;
export function mediaUrl(path) {
  if (DEMO) return Promise.resolve(demoMedia ? demoMedia(path) : null);
  if (!sb || !path || !MEDIA_PATH.test(path)) return Promise.resolve(null);
  if (!mediaCache.has(path)) mediaCache.set(path, sb.storage.from("class-media").download(path).then((r) => (r.error || !/^image[/]/.test(r.data.type || "") ? null : URL.createObjectURL(r.data)), () => null));
  return mediaCache.get(path);
}

// one exam date per course for the student countdown: the nearest upcoming one, otherwise the most recent
function examByCourse(rows) {
  const today = new Date().toISOString().slice(0, 10), out = {};
  for (const c of rows) {
    if (!c.exam_date) continue;
    const cur = out[c.course_id], up = c.exam_date >= today;
    if (!cur || (up && (cur.exam_date < today || c.exam_date < cur.exam_date)) || (!up && cur.exam_date < today && c.exam_date > cur.exam_date)) out[c.course_id] = { class_id: c.course_id, exam_name: c.exam_name, exam_date: c.exam_date };
  }
  return out;
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
  out.stats = mergeStats(a.stats, b.stats);
  return out;
}
// numbers keep the larger value, lists of days / decks / terms are joined
function mergeStats(a = {}, b = {}) {
  const out = { ...b };
  for (const [k, v] of Object.entries(a)) {
    const w = b[k];
    out[k] = typeof v === "number" ? Math.max(v, typeof w === "number" ? w : 0) : v && typeof v === "object" ? mergeStats(v, w && typeof w === "object" ? w : {}) : v;
  }
  return out;
}

export async function signUp(email, password, name, terms) {
  return sb.auth.signUp({ email, password, options: { data: { name, ...(terms ? { terms_version: terms.terms, privacy_version: terms.privacy } : {}) } } });
}
export async function signIn(email, password) {
  const r = await sb.auth.signInWithPassword({ email, password });
  if (!r.error) { session = r.data.session; await loadProfile(); }
  return r;
}
// "local" ends this device's session only; "global" ends every device's
export async function signOut(scope = "local") { await sb.auth.signOut({ scope }); classItems = []; session = null; profile = null; access = new Set(); instructorOf = new Set(); settings = {}; classes = []; managed = []; lastSummary = ""; mfaGate = null; mfaLevel = "aal1"; }
export async function forgot(email) {
  return sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
}
export async function setNewPassword(pw) { return sb.auth.updateUser({ password: pw }); }
export const hasAccess = (classId) => DEMO || !!profile?.is_admin || access.has(classId) || instructorOf.has(classId);
// "Join a class": type any class code and join whichever class it belongs to.
// Answers { ok: true, cid (course id), name } or { ok: false, reason } with reason one of
// wrong, too_many_attempts, class_closed, code_expired, class_full, school_full, school_inactive, error.
export async function joinByCode(code, classIds) {
  const r = await sb.rpc("join_class", { code });
  if (!r.error) {
    if (!r.data) return { ok: false, reason: "wrong" };
    await loadClasses();
    return { ok: true, cid: r.data.course_id, classId: r.data.class_id, name: r.data.name };
  }
  const why = (/too_many_attempts|class_closed|code_expired|class_full|school_full|school_inactive/.exec(r.error.message) || [])[0];
  if (why) return { ok: false, reason: why };
  if (r.error.code !== "PGRST202") return { ok: false, reason: "error", message: r.error.message };
  // legacy: the schools upgrade is not installed yet, use the older per-course functions
  let { data: cid, error } = await sb.rpc("redeem_class_by_code", { code }); // legacy
  if (error && /too_many_attempts/.test(error.message)) return { ok: false, reason: "too_many_attempts" };
  if (error) { for (const id of classIds) { const x = await sb.rpc("redeem_class_code", { cid: id, code }); if (x.data) { cid = id; break; } } } // legacy
  if (cid) { await loadProfile(); return { ok: true, cid }; }
  return { ok: false, reason: "wrong" };
}
export const joinProblem = {
  wrong: "That code doesn't match any class. Check it and try again.",
  too_many_attempts: "Too many wrong tries. Please wait 10 minutes and try again.",
  class_closed: "That class is closed to new students. Ask your instructor.",
  code_expired: "That code has expired. Ask your instructor for a new one.",
  class_full: "That class is full. Ask your instructor.",
  school_full: "Your school has reached its student limit. Ask your instructor.",
  school_inactive: "Your school's account is paused. Ask your instructor.",
  error: "Something went wrong. Please try again.",
};
export async function leaveClass(kid) { const r = await sb.rpc("leave_class", { kid }); if (!r.error) await loadClasses(); return r; }

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
export const adminSetCode = (cid, new_code) => sb.rpc("admin_set_class_code", { cid, new_code }); // legacy: used by the older admin screen until the schools upgrade is installed
export const adminCodes = () => sb.rpc("admin_get_codes"); // legacy: used by the older admin screen until the schools upgrade is installed
export async function adminAccess() { const { data } = await sb.from("class_access").select("user_id,class_id"); return data || []; } // legacy: used by the older admin screen until the schools upgrade is installed

// ---------- progress helpers ----------
export function cardState(id) { return data.cards[id]; }
export function setCard(id, v) { data.cards[id] = v; (data.sr ||= {})[id] = nextState(data.sr[id], v === "know"); stats().cardsReviewed = (stats().cardsReviewed || 0) + 1; save(true); }
export const dueCards = (cards) => srsDue(cards, data.sr || {});
export const dueCount = (cards) => dueCards(cards).length;
export function setConf(id, conf) { const q = data.quiz[id]; if (q) { q.conf = conf; save(); } }
export function recordAnswer(id, correct) {
  const q = data.quiz[id] || { attempts: 0, correct: 0, last: null };
  const wasWeak = q.attempts >= 2 && q.correct / q.attempts < 0.6; // a weak question that climbs back above 60% is a comeback
  q.attempts++; if (correct) q.correct++; q.last = correct; data.quiz[id] = q;
  if (wasWeak && q.correct / q.attempts >= 0.6) stats().comebacks = (stats().comebacks || 0) + 1;
  save(true);
}
export function markRead(lec, sec) { (data.read[lec] ||= {})[sec] = 1; save(true); }
export function gameDone(id) { data.games[id] = (data.games[id] || 0) + 1; save(true); }

/* ---------- numbers behind the badges (they live in the progress record, so they follow the student across devices) ---------- */
export const stats = () => (data.stats ||= {});
export function bump(k, n = 1) { const s = stats(); s[k] = (s[k] || 0) + n; save(); }
export function setMax(k, v) { const s = stats(); if (v > (s[k] || 0)) { s[k] = v; save(); return true; } return false; }
// counts each key once: mark("decksDone", lectureId) is true the first time and false after that
export function mark(map, key) { const m = (stats()[map] ||= {}); if (m[key]) return false; m[key] = 1; save(); return true; }
export const count = (map) => Object.keys(stats()[map] || {}).length;
function noteStudyTime() {
  const h = new Date().getHours(), s = stats();
  if (h >= 22 || h < 4) (s.nightDays ||= {})[localDay()] = 1; else if (h < 8) (s.earlyDays ||= {})[localDay()] = 1;
}
// one finished game: how many games were played, the sprint personal best and how often it was beaten
export function gameResult(id, game, score, total) {
  const s = stats();
  s.gamesPlayed = (s.gamesPlayed || 0) + 1;
  if (total > 0 && score > 0) s.gameCorrect = (s.gameCorrect || 0) + score;
  let beat = false;
  if (game === "speed") {
    const pb = (s.sprintPB ||= {}), old = pb[id] || 0;
    if (score > old) { pb[id] = score; if (old > 0) { s.sprintBeats = (s.sprintBeats || 0) + 1; beat = true; } }
    s.sprintBest = Math.max(s.sprintBest || 0, score);
  }
  s.lastGame = { lec: id, game, score: total > 0 ? score : null, total: total > 0 ? total : null, day: localDay() };
  save(); return { beat };
}
// one finished quiz: best percentage (quizzes of at least 5 questions) and every correct answer counts toward "answers right"
export function quizResult(score, total) {
  if (total >= 5) setMax("quizBest", Math.round((score / total) * 100));
}

export const lectureStats = (lec) => statsFrom(data, lec);
// the same numbers for any progress record (staff open a student's progress to see where they are)
export function statsFrom(d, lec) {
  d = { cards: {}, quiz: {}, read: {}, games: {}, ...d };
  const secs = lec.sections || [];
  const read = secs.filter((s) => d.read?.[lec.id]?.[s.id]).length;
  const cards = lec.cards || [];
  const known = cards.filter((c) => d.cards?.[c.id] === "know").length;
  const qs = lec.quiz || [];
  const right = qs.filter((q) => d.quiz?.[q.id]?.last).length;
  const games = (lec.games || []).filter((g) => d.games?.[lec.id + ":" + g]).length;
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
    const k = localDay(d);
    if (data.days[k]) { n++; d.setDate(d.getDate() - 1); }
    else if (n === 0) { d.setDate(d.getDate() - 1); if (!data.days[localDay(d)]) return 0; }
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
  return { exported: new Date().toISOString(), account: { email: session?.user?.email || null, name: myName(), classes: classes.length ? classes.map((c) => ({ class: c.name, school: c.school_name, term: c.term, role: c.role })) : [...access] }, progress: data };
}
export async function deleteMyAccount() {
  if (!sb) return { error: { message: "Not signed in" } };
  const r = await sb.rpc("delete_my_account");
  if (!r.error) { try { localStorage.removeItem(KEY); } catch {} await sb.auth.signOut(); session = null; profile = null; access = new Set(); classes = []; managed = []; }
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
// legacy (until the schools upgrade is installed): the older admin screen reads and sets one code per course
export async function getCodes() {
  let r = await sb.rpc("instructor_get_codes"); // legacy
  if (r.error && profile?.is_admin) r = await sb.rpc("admin_get_codes"); // legacy
  return r.data || [];
}
export async function setCode(cid, code) {
  const r = await sb.rpc("instructor_set_code", { cid, new_code: code }); // legacy
  return r.error && profile?.is_admin ? sb.rpc("admin_set_class_code", { cid, new_code: code }) : r; // legacy
}
export const removeFromClass = (uid, cid) => sb.rpc("instructor_remove_student", { uid, cid }); // legacy: used by the older admin screen until the schools upgrade is installed
export const setInstructor = (target_email, cid, flag) => sb.rpc("admin_set_instructor", { target_email, cid, flag }); // legacy: used by the older admin screen until the schools upgrade is installed
export async function listInstructors() { try { const { data: r } = await sb.from("class_instructors").select("user_id,class_id"); return r || []; } catch { return []; } } // legacy: used by the older admin screen until the schools upgrade is installed
export async function setExam(cid, nm, d) { const r = await sb.rpc("set_class_exam", { cid, nm, d: d || null }); if (!r.error) settings[cid] = { class_id: cid, exam_name: nm, exam_date: d || null }; return r; } // legacy: used by the older admin screen until the schools upgrade is installed
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
export const mastery = (lec) => masteryFrom(data, lec);
export function masteryFrom(d, lec) {
  const sr = d.sr || {}, cs = lec.cards || [], qs = lec.quiz || [];
  const cardM = cs.length ? cs.reduce((t, c) => t + (sr[c.id] ? sr[c.id].box / 5 : 0), 0) / cs.length : null;
  const quizM = qs.length ? qs.filter((q) => d.quiz?.[q.id]?.last).length / qs.length : null;
  const parts = [cardM, quizM].filter((x) => x !== null);
  return parts.length ? Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 100) : 0;
}
