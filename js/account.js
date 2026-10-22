// Everything about the person's account that is not study progress: Terms agreement, changing email, deleting the account,
// customer-service questions and the admin's tools for them. Every call answers { data } or { error: { message } }.
import * as S from "./store.js";

const missing = (e) => /PGRST202|PGRST205|Could not find the (function|table)|does not exist/.test((e?.message || "") + (e?.code || ""));
export const UPDATE_MSG = "This part needs a database update that has not been installed yet. The site owner can install it (supabase/RUN-ME-4.sql).";
async function call(name, args) {
  if (S.DEMO) return demoRpc(name, args);
  if (!S.sb) return { error: { message: "You are not signed in." } };
  try {
    const r = await S.sb.rpc(name, args);
    if (r.error) return { error: { message: missing(r.error) ? UPDATE_MSG : r.error.message, missing: missing(r.error) } };
    return { data: r.data };
  } catch (e) { return { error: { message: e?.message || "Something went wrong." } }; }
}

/* ---------- Terms of Service and Privacy Policy ---------- */
// what the person agreed to: the database record when it exists, otherwise the copy kept with their progress
export const agreed = () => ({ terms: S.profile?.terms_version ?? S.prefs().terms?.v ?? null, privacy: S.profile?.privacy_version ?? S.prefs().terms?.pv ?? null });
export const needsTerms = (termsV, privacyV) => { const a = agreed(); return a.terms !== termsV || a.privacy !== privacyV; };
export async function acceptTerms(termsV, privacyV) {
  S.setPrefs({ terms: { v: termsV, pv: privacyV, at: new Date().toISOString() } }); // kept either way
  const r = await call("accept_terms", { tv: termsV, pv: privacyV });
  if (!r.error && S.profile) { S.profile.terms_version = termsV; S.profile.privacy_version = privacyV; S.profile.terms_accepted_at = new Date().toISOString(); }
  return r.error && !r.error.missing ? r : { data: true };
}

/* ---------- forgot password, change email, delete account ---------- */
export const sendReset = async (email) => (S.DEMO ? { data: true } : S.forgot(email));
export async function checkPassword(pw) { // proves it is really the owner (signs in again; the session is replaced by an identical one)
  if (S.DEMO) return { data: true };
  const r = await S.sb.auth.signInWithPassword({ email: S.session?.user?.email || "", password: pw });
  return r.error ? { error: { message: "That password is not right." } } : { data: true };
}
export async function sendEmailCode() {
  if (S.DEMO) return { data: true };
  const r = await S.sb.auth.signInWithOtp({ email: S.session?.user?.email || "", options: { shouldCreateUser: false } });
  return r.error ? { error: { message: r.error.message } } : { data: true };
}
export async function checkEmailCode(code) {
  if (S.DEMO) return /^\d{6,8}$/.test(code) ? { data: true } : { error: { message: "Enter the code from the email." } };
  const r = await S.sb.auth.verifyOtp({ email: S.session?.user?.email || "", token: String(code).replace(/\s/g, ""), type: "email" });
  return r.error ? { error: { message: "That code is not right or has expired." } } : { data: true };
}
export async function changeEmail(newEmail) {
  if (S.DEMO) return { data: true };
  const r = await S.sb.auth.updateUser({ email: newEmail });
  return r.error ? { error: { message: r.error.message } } : { data: true };
}
// schedules the deletion (22 days) and signs the person out; logging in again before then cancels it
export async function requestDeletion() {
  const r = await call("request_account_deletion");
  if (r.error) return r;
  const date = r.data ? new Date(r.data) : new Date(Date.now() + 22 * 864e5);
  if (!S.DEMO) { await S.signOut(); }
  return { data: { date } };
}

/* ---------- customer service ---------- */
export const askQuestion = (topic, message) => call("submit_question", { topic, message });
export const myQuestions = async () => { const r = await call("my_questions"); return r.error ? { data: [], error: r.error } : { data: r.data || [] }; };
export const adminQuestions = async (statusFilter = null) => { const r = await call("admin_questions", { status_filter: statusFilter }); return r.error ? { data: [], error: r.error } : { data: r.data || [] }; };
export const setQuestionStatus = (qid, newStatus, note = null) => call("admin_set_question_status", { qid, new_status: newStatus, note });

/* ---------- admin: instructors ---------- */
export const instructorClasses = async (uid) => { const r = await call("admin_instructor_classes", { uid }); return r.error ? { data: [], error: r.error } : { data: r.data || [] }; };
export const setInstructorOf = (uid, kid, flag) => call("admin_set_instructor_of", { uid, kid, flag });

/* ---------- the local preview answers these from memory ---------- */
const demo = { questions: [], deleted: null, teach: {} };
function demoRpc(name, args) {
  switch (name) {
    case "accept_terms": return { data: null };
    case "request_account_deletion": demo.deleted = new Date(Date.now() + 22 * 864e5); return { data: demo.deleted.toISOString() };
    case "submit_question": demo.questions.unshift({ id: demo.questions.length + 1, at: new Date().toISOString(), user_id: "me", email: "student@example.com", name: S.myName(), topic: args.topic, message: args.message, status: "open", admin_note: null }); return { data: null };
    case "my_questions": return { data: demo.questions.map((q) => ({ id: q.id, at: q.at, topic: q.topic, message: q.message, status: q.status, admin_note: q.admin_note, handled_at: null })) };
    case "admin_questions": return { data: demo.questions.filter((q) => !args.status_filter || q.status === args.status_filter) };
    case "admin_set_question_status": { const q = demo.questions.find((x) => x.id === args.qid); if (q) { q.status = args.new_status; q.admin_note = args.note || null; } return { data: null }; }
    case "admin_instructor_classes": return { data: (demo.teach[args.uid] || []).map((k) => ({ class_id: k, class_name: "Demo class", school_name: "Demo school" })) };
    case "admin_set_instructor_of": { const l = (demo.teach[args.uid] ||= []); if (args.flag) { if (!l.includes(args.kid)) l.push(args.kid); } else demo.teach[args.uid] = l.filter((k) => k !== args.kid); return { data: null }; }
    default: return { error: { message: "This is not available in the preview." } };
  }
}
