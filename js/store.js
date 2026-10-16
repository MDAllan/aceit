import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../config.js";

export const DEMO = !SUPABASE_ANON_KEY;
export let sb = null;
export let session = null;
export let profile = null;

const KEY = "erth209:progress:v1";
let data = load();
let timer = null;

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || blank(); } catch { return blank(); }
}
function blank() { return { cards: {}, quiz: {}, read: {}, games: {}, days: {} }; }
export const progress = () => data;

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {}
  const d = new Date().toISOString().slice(0, 10);
  data.days[d] = 1;
  clearTimeout(timer);
  timer = setTimeout(push, 1500);
}

async function push() {
  if (!sb || !session || !profile?.access_ok || profile.blocked) return;
  await sb.from("progress").upsert({ user_id: session.user.id, data, updated_at: new Date().toISOString() });
}

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
  const { data: p } = await sb.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
  profile = p;
  if (p?.access_ok && !p.blocked) {
    const { data: r } = await sb.from("progress").select("data").eq("user_id", session.user.id).maybeSingle();
    if (r?.data) data = merge(data, r.data);
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {}
  }
}

// keep the best of local and cloud progress
function merge(a, b) {
  const out = blank();
  for (const k of ["cards", "read", "games", "days"]) out[k] = { ...b[k], ...a[k] };
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
export async function signOut() { await sb.auth.signOut(); session = null; profile = null; }
export async function forgot(email) {
  return sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
}
export async function setNewPassword(pw) { return sb.auth.updateUser({ password: pw }); }
export async function redeem(code) {
  const { data: ok, error } = await sb.rpc("redeem_code", { code });
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
export const adminCode = (new_code) => sb.rpc("admin_change_code", { new_code });

// ---------- progress helpers ----------
export function cardState(id) { return data.cards[id]; }
export function setCard(id, v) { data.cards[id] = v; save(); }
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
  const parts = [
    [read, secs.length], [known, cards.length], [right, qs.length], [games, (lec.games || []).length],
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
