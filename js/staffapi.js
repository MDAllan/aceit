// Everything the Workspace asks the database. Every call returns { data } or { error } with a message a person can read.
// In the ?demo preview the same calls are answered from js/demo.js, so the screens behave the same way.
import * as S from "./store.js";
import * as D from "./demo.js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../config.js";

const friendly = (e) => {
  const m = e?.message || String(e || "");
  if (/classes_code_uq|duplicate key/.test(m)) return "That code is already used by another class. Try a different one.";
  if (/admin only/.test(m)) return "Only the platform admin can do that.";
  if (/school managers only/.test(m)) return "Only school managers can do that.";
  if (/instructors only/.test(m)) return "Only this class's instructors can do that.";
  if (/last admin/.test(m)) return "You can't remove the last admin.";
  if (/must confirm their email/.test(m)) return "That person has to confirm their email first.";
  if (/no account with that email/.test(m)) return "There is no account with that email yet. Invite them instead, or ask them to sign up first.";
  if (/not licensed/.test(m)) return "This school isn't licensed for that course yet.";
  if (/code too short/.test(m)) return "Use at least 6 characters for a code.";
  if (/does not look like an email/.test(m)) return "That doesn't look like an email address.";
  if (/PGRST202|PGRST205|Could not find the (function|table)|does not exist/.test(m + (e?.code || ""))) return `The database upgrade has not been installed yet (supabase/${/class_item|review_queue|school_approval|class_media/.test(m) ? "RUN-ME-3" : "RUN-ME-2"}.sql).`;
  return m;
};
async function call(name, args) {
  const r = S.DEMO ? await D.rpc(name, args) : await S.sb.rpc(name, args);
  return r.error ? { error: new Error(friendly(r.error)) } : { data: r.data };
}
const rows = async (name, args) => { const r = await call(name, args); return r.error ? { error: r.error, data: [] } : { data: r.data || [] }; };

/* ----- reading ----- */
export const mySchools = () => rows("staff_schools");
export const classesOf = (sid, kid) => rows("staff_classes", { sid: sid || null, kid: kid || null });
export const roster = (kid) => rows("class_roster", { kid });
export const questionStats = (kid) => rows("class_question_stats", { kid });
export const schoolPeople = (sid) => rows("staff_people", { sid });
export const pendingInvites = (sid) => rows("list_invites", { sid: sid || null });
export const admins = () => rows("list_admins");
export async function studentProgress(userId) {
  if (S.DEMO) return D.progressOf(userId);
  const { data } = await S.sb.from("progress").select("data").eq("user_id", userId).maybeSingle();
  return data?.data || null;
}
export async function findAccounts(q) {
  q = q.trim().toLowerCase().replace(/[%,()]/g, ""); if (q.length < 2) return [];
  if (S.DEMO) return D.findPeople(q);
  const { data } = await S.sb.from("profiles").select("id,email,display_name,blocked,is_admin").or(`email.ilike.%${q}%,display_name.ilike.%${q}%`).order("email").limit(12);
  return data || [];
}
export async function auditLines(sid) {
  if (S.DEMO) return D.auditLines(sid);
  let q = S.sb.from("admin_audit").select("*").order("at", { ascending: false }).limit(40);
  if (sid) q = q.eq("school_id", sid);
  const { data } = await q; return data || [];
}
export async function errorLines() { if (S.DEMO) return D.errorLines(); const { data } = await S.sb.from("client_errors").select("*").order("at", { ascending: false }).limit(10); return data || []; }
export async function feedbackFor(kid) {
  if (S.DEMO) return D.feedbackFor(kid);
  const { data } = await S.sb.from("feedback").select("*").eq("class_uuid", kid).order("at", { ascending: false }).limit(20); return data || [];
}
export async function confirmEmailFlag() { const r = await call("admin_get_confirm_email"); return !!r.data; }
// what Supabase itself says about sign-up (is "Confirm email" really on?). null when it cannot be read.
export async function authSettings() {
  if (S.DEMO) return { autoconfirm: false };
  try { const r = await fetch(SUPABASE_URL + "/auth/v1/settings", { headers: { apikey: SUPABASE_ANON_KEY } }); const j = await r.json(); return { autoconfirm: !!j.mailer_autoconfirm }; } catch { return null; }
}

/* ----- changing things ----- */
export const createSchool = (nm, rg, seats) => call("admin_create_school", { nm, rg: rg || "", seats: seats || null });
export const updateSchool = (sid, nm, rg, is_active, seats) => call("admin_update_school", { sid, nm, rg: rg || "", is_active, seats: seats || null });
export const deleteSchool = (sid, delete_accounts) => call("admin_delete_school", { sid, delete_accounts: !!delete_accounts });
export const licenseCourse = (sid, cid, flag) => call("admin_set_school_course", { sid, cid, flag });
export const createClass = (sid, cid, nm, tm, seats, new_code) => call("create_class", { sid, cid, nm, tm: tm || "", seats: seats || null, new_code: new_code || "" });
export const updateClass = (kid, nm, tm, seats, expires, closed) => call("update_class", { kid, nm, tm: tm || "", seats: seats || null, expires: expires || null, closed: !!closed });
export const setCode = (kid, new_code) => call("set_class_code", { kid, new_code: new_code || "" });
export const setExam = (kid, nm, d) => call("set_class_exam", { kid, nm: nm || "", d: d || null });
export const removeStudent = (uid, kid) => call("remove_student", { uid, kid });
export const invite = (target_email, rl, sid, kid) => call("invite_user", { target_email, rl, sid: sid || null, kid: kid || null });
export const revokeInvite = (iid) => call("revoke_invite", { iid });
export const removeTeacher = (uid, kid) => call("remove_teacher", { uid, kid });
export const removeManager = (uid, sid) => call("remove_manager", { uid, sid });
export const setAdmin = (target_email, flag) => call("admin_set_admin", { target_email, flag });
export const setConfirmEmail = (flag) => call("admin_set_confirm_email", { flag });
export const mfaRequiredFlag = async () => (await call("mfa_required")).data === true;
export const setRequireMfa = (flag) => call("admin_set_require_mfa", { flag });
export const blockAccount = (uid, flag) => call("admin_set_blocked", { uid, flag });
export const deleteAccount = (uid) => call("admin_delete_user", { uid });
/* ----- what the class's staff add: notes, flashcards, questions, lectures, announcements ----- */
export async function items(kid) {
  if (S.DEMO) return { data: D.itemsOf(kid) };
  const r = await S.sb.from("class_items").select("*").eq("class_id", kid).order("position");
  return r.error ? { error: new Error(friendly(r.error)), data: [] } : { data: r.data || [] };
}
export const saveItem = (kid, k, ref, b, item_id, pos) => call("save_class_item", { kid, k, ref: ref || null, b, item_id: item_id || null, pos: pos ?? null });
// expected_at: the updated_at of the version the manager looked at (see set_class_item_status in supabase/patch7.sql)
export const setItemStatus = (item_id, new_status, with_children, expected_at) => call("set_class_item_status", { item_id, new_status, with_children: !!with_children, ...(expected_at ? { expected_at } : {}) });
export const deleteItem = (item_id) => call("delete_class_item", { item_id });
export const reorderItems = (kid, ids) => call("reorder_class_items", { kid, ids });
export const copyItems = (from_kid, to_kid) => call("copy_class_items", { from_kid, to_kid });
export const setApproval = (sid, flag) => call("set_school_approval", { sid, flag });
export const reviewQueue = (sid) => rows("review_queue", { sid });

/* ----- pictures: the class's private storage (see supabase/patch7.sql) ----- */
const BUCKET = "class-media";
const randomName = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, "0")).join("");
export async function uploadPicture(kid, blob) {
  if (S.DEMO) return D.uploadPicture(kid, blob);
  const ext = blob.type === "image/png" ? "png" : blob.type === "image/jpeg" ? "jpg" : "webp", path = `${kid}/${randomName()}.${ext}`;
  const r = await S.sb.storage.from(BUCKET).upload(path, blob, { contentType: blob.type, upsert: false });
  return r.error ? { error: new Error(uploadProblem(r.error.message)) } : { path };
}
// the storage service words a refused insert as a row-level-security error: here that means the class already holds 400 pictures (or the sign-in ran out)
const uploadProblem = (m) => /size|exceed/i.test(m) ? "That picture is too large (the limit is 1 MB)."
  : /row.level security|unauthori[sz]ed|forbidden/i.test(m) ? "The picture could not be added. A class can hold 400 pictures, so delete ones you no longer use. If that is not the reason, sign in again and retry."
  : m;
export async function removePictures(paths) { const list = (paths || []).filter(Boolean); if (!list.length) return; if (S.DEMO) return D.removePictures(list); try { await S.sb.storage.from(BUCKET).remove(list); } catch {} }
// copies the files named by copy_class_items; answers how many could not be copied
export async function copyPictures(pairs) {
  if (S.DEMO) { D.copyPictures(pairs); return 0; }
  let failed = 0; for (const p of pairs || []) { const r = await S.sb.storage.from(BUCKET).copy(p.old_path, p.new_path).catch(() => ({ error: true })); if (r.error) failed++; }
  return failed;
}
// every picture of a class (used when a school leaves)
export async function removeClassFolder(kid) {
  if (S.DEMO) return;
  try { const { data } = await S.sb.storage.from(BUCKET).list(kid, { limit: 1000 }); await removePictures((data || []).map((f) => `${kid}/${f.name}`)); } catch {}
}
export const getDomains = async () => (await call("admin_get_domains")).data || "";
export const setDomains = (list) => call("admin_set_domains", { list });
