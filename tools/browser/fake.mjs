// A pretend Supabase for browser tests: answers the app's REST and function calls from a small in-memory database,
// so the real (non-demo) code paths can be tested without touching the real project.
const REF = "rhxmzqjdysdslurdwocj", HOST = REF + ".supabase.co";
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
export const jwt = (uid, aal = "aal1") => `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: uid, role: "authenticated", aal, exp: Math.floor(Date.now() / 1000) + 36000 })}.sig`;
const userJson = (uid, email, factors = []) => ({ id: uid, aud: "authenticated", role: "authenticated", email, app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z", factors });
export const seedSession = (page, uid, email, o = {}) => page.evaluateOnNewDocument((key, s) => { try { localStorage.setItem(key, JSON.stringify(s)); } catch {} }, `sb-${REF}-auth-token`, {
  access_token: jwt(uid, o.aal || "aal1"), token_type: "bearer", expires_in: 36000, expires_at: Math.floor(Date.now() / 1000) + 36000, refresh_token: "r",
  user: userJson(uid, email, o.factors || []),
});

const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS", "access-control-expose-headers": "*" };
const err = (message, code = "P0001", status = 400) => ({ status, body: { code, details: null, hint: null, message } });
const missing = (fn) => ({ status: 404, body: { code: "PGRST202", details: null, hint: null, message: `Could not find the function public.${fn} in the schema cache` } });

// db: { v2, profile, classes, roles, legacyAccess, joins: {code: result | {error}}, rpc: {name: value | fn}, tables: {name: rows}, progress, log: [] }
export async function fakeSupabase(page, db) {
  db.log ||= []; db.summaryPosts ||= []; db.progressPosts ||= []; db.rpcCalls ||= [];
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const u = new URL(req.url());
    if (u.hostname !== HOST) { if (!/^(localhost|127\.0\.0\.1)$/.test(u.hostname) && u.protocol.startsWith("http")) (db.external ||= []).push(req.url()); return req.continue(); }
    if (req.method() === "OPTIONS") return req.respond({ status: 204, headers: CORS });
    const path = u.pathname, q = u.searchParams, method = req.method();
    let r = { status: 200, body: [] };
    const body = req.postData() ? (() => { try { return JSON.parse(req.postData()); } catch { return null; } })() : null;
    db.log.push(`${method} ${path}${u.search}`);
    if (path.startsWith("/rest/v1/rpc/")) {
      const fn = path.split("/").pop(); db.rpcCalls.push({ fn, body });
      if (db.rpc && fn in db.rpc) { const v = typeof db.rpc[fn] === "function" ? db.rpc[fn](body) : db.rpc[fn]; r = v && v.__err ? err(v.__err) : { status: v === null || v === undefined ? 204 : 200, body: v }; }
      else if (fn === "my_classes" || fn === "my_roles") r = db.v2 === false ? missing(fn) : { status: 200, body: fn === "my_classes" ? db.classes || [] : db.roles || [] };
      else if (fn === "claim_invites") r = db.v2 === false ? missing(fn) : { status: 200, body: db.claimed || 0 };
      else if (fn === "join_class") { if (db.v2 === false) r = missing(fn); else { let j = (db.joins || {})[body?.code]; if (typeof j === "function") j = j(body); r = j === undefined ? { status: 200, body: null } : j && j.__err ? err(j.__err) : { status: 200, body: j }; } }
      else if (fn === "mfa_required") r = { status: 200, body: !!db.mfaRequired };
      else if (["leave_class", "log_client_error", "set_my_name"].includes(fn)) r = { status: 204, body: null };
      else r = { status: 404, body: { code: "PGRST202", message: "Mock has no function " + fn } };
    } else if (path === "/rest/v1/profiles") r = { status: 200, body: db.profile ? [db.profile] : [] };
    else if (path === "/rest/v1/progress") { if (method === "GET") r = { status: 200, body: db.progress ? [{ data: db.progress }] : [] }; else { db.progressPosts.push(body); r = { status: 201, body: null }; } }
    else if (path === "/rest/v1/progress_summary") { if (method === "GET") r = { status: 200, body: [] }; else { db.summaryPosts.push(body); r = { status: db.summaryFails ? 400 : 201, body: db.summaryFails ? { message: "nope" } : null }; } }
    else if (path === "/rest/v1/class_items") {
      const m = /^in\.\((.*)\)$/.exec(q.get("class_id") || ""), ids = m ? m[1].split(",") : null, eq = /^eq\.(.*)$/.exec(q.get("class_id") || "");
      r = db.noItemsTable ? { status: 404, body: { code: "42P01", message: "relation public.class_items does not exist" } } : { status: 200, body: (db.items || []).filter((i) => (ids ? ids.includes(i.class_id) : eq ? i.class_id === eq[1] : true)) };
    }
    else if (path.startsWith("/storage/v1/")) {
      const rest = path.slice("/storage/v1/".length);
      db.uploads ||= []; db.removed ||= []; db.copies ||= []; db.downloads ||= [];
      if (rest.startsWith("object/class-media/") && method === "POST" && db.mediaFull) r = { status: 403, body: { statusCode: "403", error: "Unauthorized", message: "new row violates row-level security policy" } };
      else if (rest.startsWith("object/class-media/") && method === "POST") { const p = decodeURIComponent(rest.slice("object/class-media/".length)); db.uploads.push({ path: p, size: (req.postData() || "").length, type: req.headers()["content-type"] }); r = { status: 200, body: { Key: "class-media/" + p, Id: "id-" + db.uploads.length } }; }
      else if (rest.startsWith("object/class-media/") && method === "GET") { const p = decodeURIComponent(rest.slice("object/class-media/".length)); db.downloads.push(p); r = (db.missingMedia || []).includes(p) ? { status: 404, body: { statusCode: "404", error: "not_found", message: "Object not found" } } : { raw: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64"), type: "image/png" }; }
      else if (rest === "object/class-media" && method === "DELETE") { db.removed.push(...(body?.prefixes || [])); r = { status: 200, body: (body?.prefixes || []).map((name) => ({ name })) }; }
      else if (rest === "object/copy" && method === "POST") { db.copies.push(body); r = { status: 200, body: { Key: "class-media/" + body?.destinationKey } }; }
      else if (rest.startsWith("object/list/class-media") && method === "POST") r = { status: 200, body: (db.listing || {})[body?.prefix] || [] };
      else r = { status: 404, body: { message: "Mock has no storage call " + method + " " + rest } };
    }
    else if (path === "/rest/v1/class_access") r = { status: 200, body: db.legacyAccess || [] };
    else if (path === "/rest/v1/class_instructors") r = { status: 200, body: db.legacyInstructors || [] };
    else if (["/rest/v1/class_settings", "/rest/v1/lecture_content", "/rest/v1/exam_content"].includes(path)) r = { status: 200, body: [] };
    else if (path.startsWith("/rest/v1/")) r = { status: 200, body: (db.tables || {})[path.split("/").pop()] || [] };
    else if (path === "/auth/v1/user") r = { status: 200, body: userJson(db.uid, db.profile?.email, db.factors || []) };
    else if (path === "/auth/v1/factors" && method === "POST") { db.factors = [...(db.factors || []), { id: "f-new", status: "unverified", factor_type: "totp", friendly_name: body?.friendly_name }]; r = { status: 200, body: { id: "f-new", type: "totp", friendly_name: body?.friendly_name, totp: { qr_code: "data:image/svg+xml;utf-8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10'/>", secret: "JBSWY3DPEHPK3PXP", uri: "otpauth://totp/ACEIT" } } }; }
    else if (/^\/auth\/v1\/factors\/[^/]+\/challenge$/.test(path)) r = { status: 200, body: { id: "c1", type: "totp", expires_at: Math.floor(Date.now() / 1000) + 300 } };
    else if (/^\/auth\/v1\/factors\/[^/]+\/verify$/.test(path)) {
      const fid = path.split("/")[4];
      if (body?.code !== "123456") r = { status: 400, body: { code: "mfa_verification_failed", error_code: "mfa_verification_failed", message: "Invalid TOTP code entered" } };
      else { db.factors = (db.factors || []).map((f) => (f.id === fid ? { ...f, status: "verified" } : f)); db.aal = "aal2"; r = { status: 200, body: { access_token: jwt(db.uid, "aal2"), token_type: "bearer", expires_in: 36000, refresh_token: "r2", user: userJson(db.uid, db.profile?.email, db.factors) } }; }
    }
    else if (/^\/auth\/v1\/factors\/[^/]+$/.test(path) && method === "DELETE") { const fid = path.split("/")[4]; db.factors = (db.factors || []).filter((f) => f.id !== fid); db.unenrolled = fid; r = { status: 200, body: { id: fid } }; }
    else if (path.startsWith("/auth/v1/settings")) r = { status: 200, body: { mailer_autoconfirm: db.autoconfirm ?? true, external: {} } };
    else if (path.startsWith("/auth/v1/")) r = { status: 200, body: {} };
    if (r.raw) return req.respond({ status: 200, headers: { ...CORS, "content-type": r.type }, body: r.raw });
    req.respond({ status: r.status, headers: { ...CORS, "content-type": "application/json" }, body: r.body === null ? "" : JSON.stringify(r.body) });
  });
}
