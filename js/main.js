import * as S from "./store.js";
import { renderGame, DEFAULT_GAMES } from "./games.js";
import { viewAdmin as adminView } from "./admin.js";
import { viewWorkspace, workspaceLabel } from "./staff.js";
import * as Demo from "./demo.js";
import { challengeBody, enrollBody, mfaCard } from "./mfa.js";
import { $, h, md, clean, ic, toast, shuffle, confetti, symTile, symOf, emojiTile, floatXP, countUp, pic } from "./ui.js";
import { buildExtras } from "./classcontent.js";

// This page is not meant to be shown inside another site's frame (clickjacking): break out, or stay blank.
if (window.top !== window.self) { document.documentElement.style.display = "none"; try { window.top.location.href = window.self.location.href; } catch {} }

// accessibility options live on this device (text size, easy-read font, reduced motion)
const A11Y_KEY = "erth209:a11y";
const a11y = () => { try { return JSON.parse(localStorage.getItem(A11Y_KEY)) || {}; } catch { return {}; } };
function applyA11y() {
  const o = a11y(), r = document.documentElement;
  r.dataset.fs = o.fs || "md"; r.dataset.motion = o.motion ? "reduce" : ""; r.dataset.font = o.easy ? "easy" : "";
}
function setA11y(patch) { try { localStorage.setItem(A11Y_KEY, JSON.stringify({ ...a11y(), ...patch })); } catch {} applyA11y(); }

const app = $("#app");
let LECS = [];
let SUBJECTS = [];
let MAN = {};                                  // the course lectures' skeletons (content/manifest.json)
let EXTRA = { lectures: [], extra: {}, announcements: [] }; // what instructors added to the person's classes
let builtVersion = -1, builtDrafts = null;
const EXAMS = {};
const CLASS_COLORS = { erth209: "#2a9d8f", astr207: "#6c5ce7" };
const PALETTES = {
  erth209: ["#2a9d8f", "#e76f51", "#457b9d", "#8d6a9f", "#5f9e4e", "#bc4749", "#277da1", "#c9822b", "#577590"],
  astr207: ["#6c5ce7", "#3d9be9", "#2fa7b5", "#9b5de5", "#4361ee", "#7b2cbf", "#4895ef"],
};
let curCls = null; try { curCls = localStorage.getItem("erth209:cls"); } catch {}
const myClasses = () => SUBJECTS.filter((sj) => S.hasAccess(sj.id));
const clsOf = () => { const m = myClasses(); return m.find((x) => x.id === curCls) || m[0] || null; };
function setCls(id) { curCls = id; try { localStorage.setItem("erth209:cls", id); } catch {} }
const subjOf = (l) => SUBJECTS.find((x) => x.id === l.subject);
const open_ = () => LECS.filter((l) => S.hasAccess(l.subject));

const gamesFor = (x) => [...new Set([...DEFAULT_GAMES, ...(x.games || []), (Array.isArray(x.order) ? x.order.length : x.order) && "order", (Array.isArray(x.sort) ? x.sort.length : x.sort) && "sort", (Array.isArray(x.calc) ? x.calc.length : x.calc) && "calc"].filter(Boolean))];
// a light "skeleton" (ids and counts only) is enough for class and lecture lists and for progress percentages
const skeleton = (m, subject) => ({ id: m.id, title: m.title, chapter: m.chapter, icon: m.icon, subject, sections: m.sections.map((id) => ({ id })), cards: m.cards.map((id) => ({ id })), quiz: m.quiz.map((id) => ({ id })), games: gamesFor(m), _full: false });
// What instructors added to a course lecture is kept apart from the course's own arrays (_base) so it can be rebuilt at any time.
// Lecture lists only need ids and counts until the lecture is opened.
function applyExtras(l) {
  const e = EXTRA.extra[l.id] || { sections: [], cards: [], quiz: [] };
  if (!l._base) l._base = { sections: l.sections, cards: l.cards, quiz: l.quiz };
  const part = (a) => (l._full ? a : a.map((x) => ({ id: x.id })));
  l.sections = [...l._base.sections, ...part(e.sections)]; l.cards = [...l._base.cards, ...part(e.cards)]; l.quiz = [...l._base.quiz, ...part(e.quiz)];
}
const classRows = () => (S.DEMO ? Demo.classRows() : S.classes);
const wantDrafts = () => S.isStaff() && !S.pref("student"); // instructors see their own unpublished items too, marked as drafts
function buildLecs() {
  builtVersion = S.itemsVersion; builtDrafts = wantDrafts();
  EXTRA = buildExtras(S.classItems, classRows(), { showDrafts: builtDrafts, today: new Date().toISOString().slice(0, 10) });
  const keep = new Map(LECS.filter((l) => !l.custom).map((l) => [l.id, l]));
  const base = SUBJECTS.flatMap((sj) => sj.lectures.map((id) => keep.get(id) || (MAN[id] ? skeleton(MAN[id], sj.id) : null))).filter(Boolean);
  const n = {}, color = (l) => { const pal = PALETTES[l.subject] || ["#0d3b66"]; n[l.subject] = n[l.subject] || 0; return pal[n[l.subject]++ % pal.length]; };
  base.forEach((l) => { l.color = color(l); applyExtras(l); });
  EXTRA.lectures.forEach((l) => { l.color = color(l); });
  LECS = [...base, ...EXTRA.lectures];
}
const inflight = {};
const getJson = async (url) => { const r = await fetch(url); if (!r.ok) throw new Error(r.status); return r.json(); };
async function loadFull(l) {
  if (l._full) return;
  inflight[l.id] ||= (async () => {
    // logged-in students read their lectures from the database, where only members of the class can see them;
    // local previews and the first rollout fall back to the published files
    const full = (S.DEMO ? null : await S.dbLecture(l.id)) || (await getJson("content/" + l.id + ".json"));
    const { subject, color } = l; Object.assign(l, full, { subject, color, _full: true }); l.cards ||= []; l.games = gamesFor(full);
    l._base = { sections: l.sections, cards: l.cards, quiz: l.quiz }; applyExtras(l);
  })();
  try { await inflight[l.id]; } finally { delete inflight[l.id]; }
}
const ensureCourse = (cid) => Promise.all([...LECS.filter((l) => l.subject === cid).map(loadFull), loadExams(cid)]);
async function loadExams(sjId) {
  const sj = SUBJECTS.find((x) => x.id === sjId);
  if (!sj?.exams || sjId in EXAMS) return;
  EXAMS[sjId] = null;
  try {
    const e = (S.DEMO ? null : await S.dbExam(sjId)) || (await getJson("content/" + sj.exams + ".json"));
    if (e?.tests?.length) EXAMS[sjId] = e;
  } catch {}
}

async function boot() {
  try { const t = localStorage.getItem("erth209:theme"); if (t) document.documentElement.dataset.theme = t; } catch {}
  applyA11y();
  addEventListener("error", (e) => S.reportError(e.message, e.error?.stack));
  addEventListener("unhandledrejection", (e) => S.reportError(e.reason?.message || e.reason, e.reason?.stack));
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
  await S.initBackend();
  const [subs, man] = await Promise.all([fetch("content/subjects.json").then((r) => r.json()), fetch("content/manifest.json").then((r) => r.json())]);
  SUBJECTS = subs; MAN = man;
  SUBJECTS.forEach((sj) => (sj.color = CLASS_COLORS[sj.id] || "#0d3b66"));
  if (S.DEMO) { S.setDemoContent(() => Demo.items(), (p) => Demo.media(p)); await S.loadClassItems(); }
  buildLecs();
  S.onChange(checkMilestones);
  S.setSummaryProvider(classSummaries);
  watchIdle();
  window.addEventListener("hashchange", route);
  document.addEventListener("keydown", (e) => { if (document.activeElement?.matches("input,select,textarea")) return; if (e.key === "ArrowRight") window.__next?.(); if (e.key === "ArrowLeft") window.__prev?.(); });
  if (S.DEMO && S.isStaff()) Demo.init(LECS);
  route();
  S.pushSummary(true);
}

// instructors, school managers and admins can see other people's data, so an unattended screen signs them out after 30 minutes
const IDLE_MS = 30 * 60 * 1000;
function watchIdle() {
  let last = Date.now();
  const touch = () => { last = Date.now(); };
  ["pointerdown", "keydown", "touchstart", "scroll"].forEach((ev) => addEventListener(ev, touch, { passive: true, capture: true }));
  const check = async () => {
    if (S.DEMO || !S.session || !S.isStaff() || Date.now() - last < IDLE_MS) return;
    await S.signOut(); location.hash = "#/"; route(); toast("Signed out after 30 minutes without activity.");
  };
  setInterval(check, 30000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) check(); });
}

// a few numbers per course for the instructor's and school manager's dashboards (the full progress stays private)
function classSummaries() {
  const mine = new Set(S.classes.filter((c) => c.role === "student").map((c) => c.course_id));
  return SUBJECTS.filter((sj) => mine.has(sj.id)).map((sj) => {
    const ls = LECS.filter((l) => l.subject === sj.id), st = ls.map(S.lectureStats), qids = new Set(ls.flatMap((l) => (l.quiz || []).map((q) => q.id)));
    let qa = 0, qc = 0; for (const [id, q] of Object.entries(S.progress().quiz)) if (qids.has(id)) { qa += q.attempts || 0; qc += q.correct || 0; }
    const sum = (k) => st.reduce((t, x) => t + x[k], 0);
    return { course_id: sj.id, pct: ls.length ? Math.round(sum("pct") / ls.length) : 0, mastery: ls.length ? Math.round(ls.reduce((t, l) => t + S.mastery(l), 0) / ls.length) : 0,
      read_topics: sum("read"), cards_known: sum("known"), cards_total: sum("cards"), quiz_attempts: Math.min(qa, 1e6), quiz_correct: Math.min(qc, 1e6) };
  });
}

function gate() {
  if (S.DEMO) return null;
  if (!S.session) return "auth";
  if (!S.profile) return "setup";
  if (S.profile.blocked) return "blocked";
  if (S.mfaGate) return "mfa";
  return null;
}
let routeSeq = 0;
async function route() {
  const my = ++routeSeq;
  window.__next = window.__prev = null;
  const parts = (location.hash.replace(/^#\/?/, "") || "").split("/");
  if (parts[0] === "reset") return viewReset();
  if (parts[0] === "privacy") return viewPrivacy();
  document.documentElement.style.removeProperty("--c");
  if (parts[0] === "s" && S.hasAccess(parts[1])) setCls(parts[1]);
  if (parts[0] === "l") { const lx = LECS.find((z) => z.id === parts[1]); if (lx && S.hasAccess(lx.subject)) setCls(lx.subject); }
  const g = gate();
  if (parts[0] === "admin" && S.isV2() && !g) { location.replace("#/work"); return; }
  if (g === "auth") return viewAuth();
  if (g === "setup") return authBox("Almost there", h("p", "Your account was created but its profile is missing. The site owner needs to run the latest database patch (supabase/patch1.sql), then press Retry."),
    h(".row", h("button.btn", { onclick: async () => { await S.loadProfile(); route(); } }, "Retry"), h("button.btn.alt", { onclick: async () => { await S.signOut(); route(); } }, "Log out")));
  if (g === "blocked") return viewBlocked();
  if (g === "mfa") return viewMfa();
  const claimed = S.takeInvitesClaimed(); if (claimed) toast("Your invite was accepted. Your Workspace tab is ready.");
  if (builtVersion !== S.itemsVersion || builtDrafts !== wantDrafts()) buildLecs(); // classes or their content changed since the lists were built
  const page = parts[0] || "", need = [];
  if (page === "l") { const lx = LECS.find((z) => z.id === parts[1]); if (lx && S.hasAccess(lx.subject)) need.push(lx); }
  else if (["cards", "practice", "progress", "search", "glossary"].includes(page)) need.push(...pool_());
  else if (page === "admin" && !S.isV2()) need.push(...LECS); // legacy: the older admin screen needs every lecture
  const exSj = page === "s" ? parts[1] : page === "" && myClasses().length === 1 ? myClasses()[0].id : null;
  if (need.some((l) => !l._full) || (exSj && !(exSj in EXAMS))) {
    const t = setTimeout(() => { if (my === routeSeq) app.replaceChildren(h("p.boot", "Loading...")); }, 180);
    try { await Promise.all([...need.map(loadFull), exSj ? loadExams(exSj) : null]); } catch { clearTimeout(t); app.replaceChildren(h("p.boot", "Couldn't load this page. Check your connection and try again.")); return; }
    clearTimeout(t);
    if (my !== routeSeq) return;
  }
  shell(parts);
}

/* ---------- shell ---------- */
function shell(parts) {
  const page = parts[0] || "";
  const admin = S.isAdmin(), staff = S.isStaff(), v2 = S.isV2();
  const cc = clsOf(), x = S.xp(pool_());
  if (cc) document.documentElement.style.setProperty("--c", cc.color);
  app.replaceChildren(
    h("header.top", h(".in",
      h("button.brand", { onclick: () => (location.hash = "#/") }, h("span.logo", ic("star", 18)), "ACEIT"),
      cc && page !== "work" ? h("button.cls", { style: `--tc:${cc.color}`, title: "Your classes", onclick: () => (location.hash = "#/") }, h("span.em", cc.icon), cc.name) : "",
      page === "work" ? h("span", { style: "margin-left:auto" }) : h(".xp", { title: `${x.xp} XP in ${cc ? cc.name : "this class"}` }, ic("fire", 16), "Lv " + x.lvl, h(".bar", h("i", { style: `width:${x.pct}%` }))),
      admin && !S.DEMO ? h("button.chip", { "aria-label": "Switch between admin and student view", onclick: () => { S.setPref("student", !S.pref("student")); route(); } }, ic("eye", 16), S.pref("student") ? "Student view" : "Admin view") : "",
      h("button.chip", { "aria-label": "Toggle dark mode", onclick: toggleTheme }, ic("moon", 16)),
      h("button.chip", { "aria-label": "Search", onclick: () => (location.hash = "#/search") }, ic("zoom", 16)),
      S.DEMO ? "" : h("span.syncdot#syncdot", { role: "status", "aria-label": "Sync status" }),
      S.DEMO ? "" : h("button.avatar", { "aria-label": "Your profile", style: avatarStyle(), onclick: () => (location.hash = "#/profile") }, avatarGlyph(18)),
    )),
    h("main.wrap#view"),
    h("nav.nav" + (page === "work" ? ".ws" : ""), { "aria-label": "Main" },
      nav("home", "Classes", "", page === "" || page === "l" || page === "s"),
      nav("cards", "Cards", "cards", page === "cards"),
      nav("quiz", "Practice", "practice", page === "practice"),
      nav("chart", "Progress", "progress", page === "progress"),
      staff ? (v2 ? nav("users", workspaceLabel(), "work", page === "work") : nav("shield", admin ? "Admin" : "Instructor", "admin", page === "admin")) : "",
    ),
  );
  S.onSync(paintSync); paintSync(S.sync);
  const v = $("#view");
  if (page === "l") return viewLecture(v, parts[1], parts[2] || "notes");
  if (page === "s") return viewSubject(v, parts[1]);
  if (page === "profile") return viewProfile(v);
  if (page === "search") return viewSearch(v);
  if (page === "glossary") return viewGlossary(v);
  if (page === "cards") return viewAllCards(v, parts[1]);
  if (page === "practice") return viewPractice(v);
  if (page === "progress") return viewProgress(v);
  if (page === "work" && staff) return viewWorkspace(v, { LECS, SUBJECTS, EXAMS, route, ensureCourse, refreshExtras: () => S.loadClassItems() }, parts);
  if (page === "admin" && staff) return adminView(v, { LECS, SUBJECTS, route }); // legacy
  viewHome(v);
}
const nav = (icon, label, to, on) => h("button" + (on ? ".on" : ""), { "aria-current": on ? "page" : "false", onclick: () => (location.hash = "#/" + to) }, ic(icon, 22), label);
function setTheme(v) {
  if (v === "auto") { delete document.documentElement.dataset.theme; try { localStorage.removeItem("erth209:theme"); } catch {} return; }
  document.documentElement.dataset.theme = v; try { localStorage.setItem("erth209:theme", v); } catch {}
}
function toggleTheme() {
  const dark = matchMedia("(prefers-color-scheme: dark)").matches;
  const cur = document.documentElement.dataset.theme || (dark ? "dark" : "light");
  const nx = cur === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = nx;
  try { localStorage.setItem("erth209:theme", nx); } catch {}
}

/* ---------- search and glossary (inside the current class only) ---------- */
function viewSearch(v) {
  const cls = clsOf(), LS = pool_();
  const inp = h("input", { type: "search", placeholder: `Search ${cls ? cls.name : "your class"}: a word, a formula, a topic`, "aria-label": "Search", autocomplete: "off" }), out = h("div");
  const run = () => {
    const q = inp.value.trim().toLowerCase(); out.replaceChildren(); if (q.length < 2) { out.append(h(".src", "Type at least 2 letters.")); return; }
    const cardHits = [], noteHits = [];
    LS.forEach((l) => {
      (l.cards || []).forEach((c) => { if ((c.front + " " + c.back).toLowerCase().includes(q)) cardHits.push({ l, c }); });
      (l.sections || []).forEach((sec, idx) => {
        const text = [sec.title, ...(sec.bullets || []), ...(sec.steps || []).flatMap((st) => [st.title || "", ...(st.bullets || [])])].join(" ");
        if (text.toLowerCase().includes(q)) noteHits.push({ l, sec, idx, snip: snippet(text, q) });
      });
    });
    if (!cardHits.length && !noteHits.length) { out.append(h(".card", "Nothing found. Try a shorter word.")); return; }
    if (noteHits.length) out.append(h("h3", { style: "margin:12px 0 4px" }, `\u{1F4D6} Notes (${noteHits.length})`), ...noteHits.slice(0, 12).map(({ l, sec, idx, snip }) => h("button.ev", { onclick: () => { pageIdx[l.id] = idx; location.hash = `#/l/${l.id}/notes`; } }, h("span.k", l.icon), h("div", { style: "flex:1" }, h("b", clean(sec.title)), h(".src", { style: "margin:0" }, l.title), h("div", md(snip))))));
    if (cardHits.length) out.append(h("h3", { style: "margin:12px 0 4px" }, `\u{1F0CF} Terms (${cardHits.length})`), ...cardHits.slice(0, 12).map(({ l, c }) => h(".fb", { style: "margin-top:6px" }, h("b", md(c.front)), h("div", md(c.back)), h(".src", { style: "margin:2px 0 0" }, l.title))));
  };
  inp.oninput = run;
  v.append(h(".hero", h("h1", "\u{1F50D} Search"), h("p", cls ? `Searching ${cls.name} only.` : "Join a class first.")), inp, out); inp.focus(); run();
}
const snippet = (text, q) => { const t = clean(text), i = t.toLowerCase().indexOf(q); const a = Math.max(0, i - 50); return (a ? "..." : "") + t.slice(a, a + 140).replace(/\*\*/g, "") + (t.length > a + 140 ? "..." : ""); };
function viewGlossary(v) {
  const cls = clsOf(), LS = pool_(), all = LS.flatMap((l) => (l.cards || []).map((c) => ({ l, c }))).sort((a, b) => a.c.front.localeCompare(b.c.front));
  const inp = h("input", { type: "search", placeholder: "Filter terms", "aria-label": "Filter terms" }), list = h("div");
  const draw = () => {
    const q = inp.value.trim().toLowerCase(); list.replaceChildren(); let last = "";
    all.filter(({ c }) => !q || (c.front + " " + c.back).toLowerCase().includes(q)).forEach(({ l, c }) => {
      const L = c.front.replace(/[^A-Za-z0-9]/, "").slice(0, 1).toUpperCase() || "#";
      if (L !== last) { last = L; list.append(h("h3", { style: "margin:14px 0 4px;color:var(--ct)" }, L)); }
      list.append(h(".fb", { style: "margin-top:6px" }, h("b", md(c.front)), h("div", md(c.back)), h(".src", { style: "margin:2px 0 0" }, l.title)));
    });
    if (!list.children.length) list.append(h(".src", "No matching terms."));
  };
  inp.oninput = draw;
  v.append(h(".hero", h("h1", "\u{1F4D6} Glossary"), h("p", `${all.length} terms${cls ? " in " + cls.name : ""}, A to Z.`)), inp, list); draw();
}

/* ---------- sync status ---------- */
function paintSync(st) {
  const el = $("#syncdot"); if (!el) return;
  const msg = { saved: "Saved", syncing: "Saving...", offline: "Offline: changes will sync when you reconnect", error: "Could not save yet: retrying" }[st.state] || "";
  el.className = "syncdot " + st.state; el.title = msg; el.setAttribute("aria-label", msg);
}

/* ---------- profile ---------- */
const AV_SYMS = ["globe", "telescope", "rocket", "gem", "volcano", "atom", "orbit", "bolt", "wave", "clock", "trophy", "star"];
const AV_COLS = ["#0d3b66", "#1b6ca8", "#2c7a56", "#7a3b69", "#a8541a", "#4a5568"];
const avatarStyle = () => `background:${S.prefs().avatarColor || AV_COLS[0]};color:#faf0ca`;
const avatarGlyph = (size) => { const sy = S.prefs().avatarSym; return sy ? ic(sy, size) : h("span", S.myName().slice(0, 1).toUpperCase()); };
function feedbackCard() {
  let rating = 0; const msg = h("textarea", { rows: 3, maxlength: 1000, placeholder: "What would make ACEIT better for you? (optional)", "aria-label": "Feedback message", style: "width:100%;font:inherit;padding:10px;border:1px solid var(--line);border-radius:4px;background:var(--card);color:var(--ink)" });
  const stars = h(".row", { style: "margin:6px 0" }); const paint = () => stars.replaceChildren(...[1, 2, 3, 4, 5].map((n) => h("button.chip" + (rating >= n ? ".on" : ""), { "aria-label": n + " out of 5", onclick: () => { rating = n; paint(); } }, "\u2605")));
  paint();
  return h(".card", { style: "margin-top:12px" }, h("h3", "\u{1F4AC} Send feedback"), h(".src", { style: "margin:0" }, "How is ACEIT working for you?"), stars, msg,
    h("button.btn.sm", { style: "margin-top:8px", onclick: async () => { if (!rating) { toast("Pick a star rating first"); return; } const r = await S.sendFeedback(clsOf()?.id || null, rating, msg.value); toast(r.error ? "Could not send: " + r.error.message : "\u{1F64F} Thank you!"); if (!r.error) { msg.value = ""; rating = 0; paint(); } } }, "Send"));
}
function viewProfile(v) {
  const draw = () => {
    v.replaceChildren();
    const pf = S.prefs(), x = S.xp(open_()), st = S.streak(), email = S.session?.user?.email || "";
    const nameIn = h("input", { value: S.myName(), maxlength: 40, "aria-label": "Display name" });
    const nm = h("p.err", { role: "alert", style: "margin:4px 0 0;min-height:0" });
    const pw = h("input", { type: "password", placeholder: "New password (8+ characters)", autocomplete: "new-password", "aria-label": "New password" });
    const pwMsg = h("p.err", { role: "alert", style: "margin:4px 0 0;min-height:0" });
    const cur = document.documentElement.dataset.theme || "auto";
    v.append(h(".hero", h("h1", "Your profile")),
      h(".card", h(".profhead", h("div.avatar.big", { style: avatarStyle() }, avatarGlyph(34)), h("div", h("b", { style: "font-size:1.1rem" }, S.myName()), h(".src", { style: "margin:2px 0" }, email), S.profile?.is_admin ? h("span.pill", { style: "background:#0d3b66" }, "Admin") : h("span.pill", `Level ${x.lvl}`)))),
      h(".card", { style: "margin-top:12px" }, h("h3", "\u{1F3A8} Avatar"), h(".src", { style: "margin:0 0 6px" }, "Pick a symbol and a colour."),
        h(".pgrid", AV_SYMS.map((sy) => h("button" + (pf.avatarSym === sy ? ".on" : ""), { "aria-label": sy, onclick: () => { S.setPrefs({ avatarSym: sy }); draw(); } }, ic(sy, 22)))),
        h(".swatches", AV_COLS.map((cl) => h("button" + ((pf.avatarColor || AV_COLS[0]) === cl ? ".on" : ""), { style: `background:${cl}`, "aria-label": "Colour " + cl, onclick: () => { S.setPrefs({ avatarColor: cl }); draw(); } })))),
      h(".card", { style: "margin-top:12px" }, h("h3", "\u270F\uFE0F Display name"), h(".row", { style: "flex-wrap:nowrap" }, nameIn, h("button.btn.sm", { onclick: async () => { const n = nameIn.value.trim(); if (!n) { nm.textContent = "Enter a name."; return; } await S.setName(n); toast("Name saved"); draw(); } }, "Save")), nm),
      h(".card", { style: "margin-top:12px" }, h("h3", "\u{1F319} Appearance"),
        h(".seg", [["auto", "Auto"], ["light", "Light"], ["dark", "Dark"]].map(([k, t]) => h("button.btn.sm" + (cur === k ? "" : ".alt"), { onclick: () => { setTheme(k); draw(); } }, t)))),
      h(".card", { style: "margin-top:12px" }, h("h3", "\u267F Accessibility"),
        h(".src", { style: "margin:0 0 6px" }, "Saved on this device."),
        h("label", { style: "margin:6px 0 4px" }, "Text size"),
        h(".seg", [["md", "Normal"], ["lg", "Large"], ["xl", "Extra large"]].map(([k, t]) => h("button.btn.sm" + ((a11y().fs || "md") === k ? "" : ".alt"), { onclick: () => { setA11y({ fs: k }); draw(); } }, t))),
        h(".row", { style: "margin-top:10px" },
          h("button.btn.sm" + (a11y().easy ? "" : ".alt"), { "aria-pressed": !!a11y().easy, onclick: () => { setA11y({ easy: !a11y().easy }); draw(); } }, (a11y().easy ? "\u2705 " : "") + "Easy-read font"),
          h("button.btn.sm" + (a11y().motion ? "" : ".alt"), { "aria-pressed": !!a11y().motion, onclick: () => { setA11y({ motion: !a11y().motion }); draw(); } }, (a11y().motion ? "\u2705 " : "") + "Reduce motion"))),
      h(".card", { style: "margin-top:12px" }, h("h3", "\u{1F4DA} My classes"),
        h("div", (S.classes.length ? S.classes : SUBJECTS.filter((sj) => S.hasAccess(sj.id)).map((sj) => ({ course_id: sj.id, name: `${sj.name}: ${sj.title}` }))).map((k) => { const sj = SUBJECTS.find((x) => x.id === k.course_id) || { id: k.course_id, icon: "\u{1F4D8}" };
          return h(".row", { style: "padding:6px 0;flex-wrap:nowrap" }, emojiTile(sj, 34), h("div", { style: "flex:1;min-width:0" }, h("b", k.name), k.school_name ? h(".src", { style: "margin:0" }, [k.school_name, k.term, k.role === "student" ? "" : k.role === "teacher" ? "instructor" : "school manager"].filter(Boolean).join(" · ")) : ""),
            k.role === "student" ? h("button.btn.alt.sm", { "aria-label": "Leave " + k.name, onclick: async () => { if (!confirm(`Leave ${k.name}? You can join again later with the class code.`)) return; const x = await S.leaveClass(k.class_id); toast(x.error ? "Could not leave: " + x.error.message : "You left the class"); route(); } }, "Leave") : ""); })),
        S.DEMO ? "" : h("div", { style: "margin-top:10px" }, joinCard())),
      h(".card", { style: "margin-top:12px" }, h("h3", "\u{1F4CA} Study stats"), h("p", { style: "margin:0" }, `Level ${x.lvl}, ${x.xp} XP` + (st ? `, ${st}-day streak` : "") + ".")),
      S.DEMO ? "" : h(".card", { style: "margin-top:12px" }, h("h3", "\u{1F512} Password"), h(".row", { style: "flex-wrap:nowrap" }, pw, h("button.btn.sm", { onclick: async () => { pwMsg.style.color = ""; if (pw.value.length < 8) { pwMsg.textContent = "Use at least 8 characters."; return; } const r = await S.setNewPassword(pw.value); pwMsg.style.color = r.error ? "" : "var(--ok)"; pwMsg.textContent = r.error ? r.error.message : "Password updated."; if (!r.error) pw.value = ""; } }, "Update")), pwMsg),
      S.DEMO ? "" : mfaCard(draw),
      S.DEMO ? "" : feedbackCard(),
      S.DEMO ? "" : h(".card", { style: "margin-top:12px" }, h("h3", "\u{1F5C4}\uFE0F Your data"), h("p", { style: "margin:0 0 8px;color:var(--mute);font-size:.9rem" }, "You own your study data. Download it or delete your account at any time. ", h("a", { href: "#/privacy" }, "Privacy")),
        h(".row", h("button.btn.alt.sm", { onclick: () => { const url = URL.createObjectURL(new Blob([JSON.stringify(S.exportData(), null, 2)], { type: "application/json" })); const a = h("a", { href: url, download: "aceit-my-data.json" }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000); toast("Downloaded"); } }, "Download my data"),
          S.profile?.is_admin ? "" : h("button.btn.warn.sm", { onclick: async () => { const t = prompt("This permanently deletes your account and progress. Type DELETE to confirm."); if (t !== "DELETE") return; const r = await S.deleteMyAccount(); if (r.error) { toast("Could not delete: " + r.error.message); return; } toast("Account deleted"); location.hash = "#/"; route(); } }, "Delete my account"))),
      h(".card", { style: "margin-top:12px" }, h("h3", "Account"), h(".row",
        S.DEMO ? "" : h("button.btn", { onclick: async () => { await S.signOut(); location.hash = "#/"; route(); } }, ic("logout", 16), "Log out"),
        S.DEMO ? "" : h("button.btn.alt", { title: "Ends your session on every phone and computer", onclick: async () => { if (!confirm("Log out on every device where you are signed in?")) return; await S.signOut("global"); location.hash = "#/"; route(); } }, "Log out everywhere"),
        h("button.btn.alt", { onclick: async () => { if (confirm("Reset all of your progress? This cannot be undone.")) { await S.resetProgress(); toast("Progress reset"); route(); } } }, "Reset my progress"))));
  };
  draw();
}

/* ---------- auth ---------- */
function viewPrivacy() {
  const back = () => { history.length > 1 ? history.back() : (location.hash = "#/"); };
  app.replaceChildren(h("main.auth", { style: "max-width:640px" }, h("button.btn.alt.sm", { onclick: back, style: "margin-bottom:12px" }, ic("left", 16), "Back"),
    h("h1", { style: "letter-spacing:0" }, "Privacy"), h(".card",
      h("h3", "What ACEIT keeps about you"), h("ul", { style: "margin:4px 0 12px;padding-left:18px" }, h("li", "Your email address and the name you choose."), h("li", "Which classes you joined, and which school each class belongs to."), h("li", "Your study progress: topics read, cards reviewed, quiz answers and games played."), h("li", "A short summary of that progress (percent complete, mastery and when you last opened ACEIT).")),
      h("h3", "Who can see it"), h("p", "You can see all of it. The instructors of a class you joined, and the managers of that class's school, can see your name, email, progress and summary for that class so they can help you and see how the class is doing. People in other schools cannot. Other students cannot. The people who run the ACEIT service can see account details when they need to keep it working and safe. Nothing is sold or shared for advertising."),
      h("h3", "Where it is stored"), h("p", "In a cloud database (Supabase) set up for this site. Passwords are stored in hashed form and are never visible to anyone. Everything is sent over an encrypted connection."),
      h("h3", "Your choices"), h("p", "In your profile you can download everything stored about you, change your name, leave a class, or delete your account. Deleting removes your email, progress and class memberships."),
      h("h3", "Questions or requests"), h("p", { style: "margin-bottom:0" }, "Ask your instructor or your school. They can also ask us to remove a class or a student."))));
}
function authBox(title, ...kids) {
  app.replaceChildren(h(".auth", h("h1", { style: "text-align:center" }, "ACEIT"),
    h("p", { style: "text-align:center;color:var(--mute)" }, "Learn it, play it, ace it."), h(".card", h("h2", title), ...kids), h("p", { style: "text-align:center;margin-top:12px" }, h("a", { href: "#/privacy" }, "Privacy"))));
}
function viewAuth() {
  let mode = "in";
  const draw = () => {
    const email = h("input", { type: "email", placeholder: "you@email.com", autocomplete: "email", required: true, id: "em" });
    const pw = h("input", { type: "password", placeholder: mode === "in" ? "Password" : "Password (8+ characters)", autocomplete: mode === "in" ? "current-password" : "new-password", id: "pw" });
    const name = h("input", { placeholder: "Your first name", id: "nm" });
    const err = h("p.err", { role: "alert" });
    const go = h("button.btn", { style: "width:100%;margin-top:14px" }, mode === "in" ? "Log in" : "Create account");
    go.onclick = async () => {
      err.textContent = ""; go.disabled = true;
      if (mode === "up") {
        if (pw.value.length < 8) { err.textContent = "Use at least 8 characters for your password."; go.disabled = false; return; }
        const r = await S.signUp(email.value.trim(), pw.value, name.value.trim());
        if (r.error) err.textContent = r.error.message;
        else if (!r.data.session) { err.style.color = "var(--ok)"; err.textContent = "Check your email to confirm, then log in."; }
        else { await S.loadProfile(); return route(); }
      } else {
        const r = await S.signIn(email.value.trim(), pw.value);
        if (r.error) err.textContent = r.error.message; else return route();
      }
      go.disabled = false;
    };
    const forgot = h("button.btn.alt.sm", { style: "margin-top:10px" }, "Forgot password?");
    forgot.onclick = async () => {
      if (!email.value) { err.textContent = "Type your email above first."; return; }
      const r = await S.forgot(email.value.trim());
      err.style.color = r.error ? "var(--bad)" : "var(--ok)";
      err.textContent = r.error ? r.error.message : "Reset link sent. Check your email.";
    };
    const sw = h("button.btn.alt.sm", { style: "margin:10px 0 0 8px" }, mode === "in" ? "New here? Sign up" : "Have an account? Log in");
    sw.onclick = () => { mode = mode === "in" ? "up" : "in"; draw(); };
    authBox(mode === "in" ? "Log in" : "Create your account",
      mode === "up" ? [h("label", { for: "nm" }, "Name"), name] : "", h("label", { for: "em" }, "Email"), email, h("label", { for: "pw" }, "Password"), pw, err, go,
      h("div", mode === "in" ? [forgot, sw] : [sw]));
  };
  draw();
}
function viewCode() {
  const code = h("input", { placeholder: "Class access code", autocomplete: "off", "aria-label": "Class access code" });
  const err = h("p.err", { role: "alert" });
  const go = h("button.btn", { style: "width:100%;margin-top:14px" }, "Unlock");
  go.onclick = async () => {
    const r = await S.redeem(code.value.trim());
    if (r.ok) { toast("Welcome!"); confetti(); route(); } else err.textContent = "That code isn't right. Ask Madi.";
  };
  authBox("One more step", h("p", "Enter the class access code to continue."), code, err, go,
    h("button.btn.alt.sm", { style: "margin-top:10px", onclick: async () => { await S.signOut(); route(); } }, "Log out"));
}
// two-step login: the code screen after the password, or a required set-up for staff
function viewMfa() {
  const setup = S.mfaGate === "enroll";
  authBox(setup ? "Set up two-step login" : "Two-step login",
    ...(setup ? [h("p", "Instructors, school managers and admins must use two-step login. Set it up once; it takes about a minute."), enrollBody(() => { route(); S.pushSummary(true); })] : challengeBody(() => { route(); S.pushSummary(true); })),
    h("button.btn.alt.sm", { style: "margin-top:10px", onclick: async () => { await S.signOut(); location.hash = "#/"; route(); } }, "Log out"));
}
function viewBlocked() {
  authBox("Access removed", h("p", "Your access to this site was removed by the admin."),
    h("button.btn.alt.sm", { onclick: async () => { await S.signOut(); route(); } }, "Log out"));
}
function viewReset() {
  const pw = h("input", { type: "password", placeholder: "New password (8+ characters)", autocomplete: "new-password", "aria-label": "New password" });
  const err = h("p.err", { role: "alert" });
  const go = h("button.btn", { style: "width:100%;margin-top:14px" }, "Save new password");
  go.onclick = async () => {
    if (pw.value.length < 8) { err.textContent = "Use at least 8 characters."; return; }
    const r = await S.setNewPassword(pw.value);
    if (r.error) err.textContent = r.error.message; else { toast("Password updated"); location.hash = "#/"; }
  };
  authBox("Choose a new password", pw, err, go);
}

/* ---------- home ---------- */
function ring(pct, color) {
  return h(".ring", { style: `--p:${pct};--c:${color}`, role: "img", "aria-label": pct + " percent complete" }, h("span", pct + "%"));
}
// "Alpha University · ASTR 207 Section 1" for a course the student joined through a class
const classLine = (courseId) => { const k = S.classes.find((c) => c.course_id === courseId && c.role === "student") || S.classes.find((c) => c.course_id === courseId); return k && k.school_name ? `${k.school_name} · ${k.name}` : ""; };
// notes from the instructors of the person's classes (newest first)
function announcementsCard(courseId) {
  const rows = classRows(), list = EXTRA.announcements.filter((a) => !courseId || rows.find((c) => c.class_id === a.classId)?.course_id === courseId).slice(0, 3);
  if (!list.length) return "";
  return h(".card.ann", { style: "margin-bottom:12px;border-left:6px solid var(--sun)" }, h("b", { style: "display:flex;gap:8px;align-items:center" }, ic("bell", 16), list.length === 1 ? "From your instructor" : "From your instructors"),
    list.map((a) => h("div", { style: "margin-top:8px" }, h("b", md(a.title)), a.draft ? h("span.pill.bad", { style: "margin-left:8px" }, "Draft") : "", a.text ? h("p", { style: "margin:2px 0 0" }, md(a.text)) : "",
      h(".src", { style: "margin:2px 0 0" }, [a.by, a.at ? new Date(a.at).toLocaleDateString([], { month: "short", day: "numeric" }) : "", rows.filter((c) => c.role !== "manager").length > 1 ? a.className : ""].filter(Boolean).join(" · ")))));
}
function subjectStats(sj) {
  const ls = LECS.filter((l) => l.subject === sj.id);
  return { n: ls.length, pct: ls.length ? Math.round(ls.reduce((t, l) => t + S.lectureStats(l).pct, 0) / ls.length) : 0 };
}
function joinCard() {
  const inp = h("input", { placeholder: "Enter a class code", autocomplete: "off", "aria-label": "Class code" }), err = h("p.err", { role: "alert", style: "margin:4px 0 0" });
  const go = h("button.btn", { style: "--c:#2563eb" }, "Join class");
  const submit = async () => {
    const code = inp.value.trim(); if (!code) return; go.disabled = true; err.textContent = "";
    const r = await S.joinByCode(code, SUBJECTS.map((x) => x.id)); go.disabled = false;
    if (!r.ok) { err.textContent = r.message || S.joinProblem[r.reason] || S.joinProblem.error; return; }
    const sj = SUBJECTS.find((x) => x.id === r.cid); setCls(r.cid); toast(`\u{1F389} Joined ${r.name || (sj ? sj.name : "class")}!`); confetti(); route();
  };
  go.onclick = submit; inp.onkeydown = (e) => { if (e.key === "Enter") submit(); };
  return h(".card", { style: "margin-bottom:14px" }, h("h3", "\u{1F39F}\uFE0F Join a class"), h("p", { style: "margin:0 0 8px;color:var(--mute);font-size:.9rem" }, "Each class has its own code from your instructor."), h(".row", { style: "flex-wrap:nowrap" }, inp, go), err);
}
// three small steps for a brand-new student; disappears once done or dismissed
function onboardCard() {
  const pf = S.prefs(); if (S.DEMO || pf.onboarded) return "";
  const done = [myClasses().length > 0, !!pf.avatarSym, Object.keys(S.progress().quiz).length > 0];
  if (done.every(Boolean)) { S.setPrefs({ onboarded: true }); return ""; }
  const step = (ok, t, go) => h(".row", { style: "padding:5px 0;flex-wrap:nowrap" }, h("span", { style: "width:26px;flex:none" }, ok ? "\u2705" : "\u2B1C"), h("span", { style: "flex:1" + (ok ? ";text-decoration:line-through;color:var(--mute)" : "") }, t), !ok && go ? h("button.btn.sm", { onclick: go }, "Do it") : "");
  const cls = clsOf();
  return h(".card", { style: "margin-bottom:14px;border-left:6px solid var(--c)" }, h("h3", "\u{1F680} Get started in 3 steps"),
    step(done[0], "Join your class with the code from your instructor", () => document.querySelector("input[aria-label='Class code']")?.focus()),
    step(done[1], "Make your avatar yours", () => (location.hash = "#/profile")),
    step(done[2], "Answer your first question", cls ? () => { const l = LECS.find((z) => z.subject === cls.id); if (l) location.hash = `#/l/${l.id}/quiz`; } : null),
    h(".row", { style: "justify-content:flex-end" }, h("button.btn.alt.sm", { onclick: () => { S.setPrefs({ onboarded: true }); route(); } }, "Hide")));
}
function viewHome(v) {
  const st = S.streak(), x = S.xp(open_()), lastp = S.last();
  const lastLec = lastp && open_().find((l) => l.id === lastp.lecId);
  const nm = S.DEMO ? "" : S.myName();
  const mine = SUBJECTS.filter((sj) => S.hasAccess(sj.id));
  v.append(onboardCard());
  if (mine.length === 1) { viewSubject(v, mine[0].id); if (!S.DEMO) v.append(h("div", { style: "margin-top:16px" }, joinCard())); return; }
  v.append(
    h(".hero", h("h1", nm ? `Hi ${nm}! \u{1F44B}` : "Welcome to ACEIT \u{1F44B}"), h("p", st ? `\u{1F525} ${st}-day streak. Keep it going.` : "Pick a class and start a streak today. \u{1F680}")),
    h(".card.row", { style: "margin-bottom:14px;justify-content:space-between" },
      h("div", { style: "flex:1;min-width:150px" }, h("b", `Level ${x.lvl}`), h(".bar", { style: "margin:6px 0" }, h("i", { style: `width:${x.pct}%` })), h(".src", h("span", { "data-count": x.xp }, "0"), ` XP. ${x.next - x.xp} more for level ${x.lvl + 1}`)),
      lastLec ? h("button.btn", { style: `--c:${lastLec.color}`, onclick: () => (location.hash = `#/l/${lastLec.id}/${lastp.tab || "notes"}`) }, "Continue: " + lastLec.title, ic("right", 18)) : ""),
    announcementsCard(null),
    h("h2", "Your classes"),
    mine.length ? "" : h(".card", { style: "margin-bottom:12px" }, h("b", "You haven't joined a class yet"), h("p", { style: "margin:4px 0 0;color:var(--mute)" }, "Enter the class code from your instructor below to get started.")),
    h(".grid", mine.map((sj, i) => {
      const unlocked = true, t = subjectStats(sj);
      return h("button.card.lec", { style: `animation-delay:${i * 60}ms;--tc:${sj.color}`, onclick: () => (location.hash = `#/s/${sj.id}`) },
        emojiTile(sj, 52),
        h("div", { style: "flex:1" }, h("b", `${sj.name}: ${sj.title}`), h("small", t.n ? `${t.n} lectures` : "Coming soon"), classLine(sj.id) ? h("small", { style: "display:block" }, classLine(sj.id)) : ""),
        t.n ? ring(t.pct, sj.color) : "");
    })),
    S.DEMO ? "" : h("div", { style: "margin-top:16px" }, joinCard()));
  v.querySelectorAll("[data-count]").forEach((el) => countUp(el, +el.dataset.count));
}

function viewSubject(v, id) {
  const sj = SUBJECTS.find((x) => x.id === id);
  if (!sj) return viewHome(v);
  v.style.setProperty("--c", sj.color);
  v.append(h(".hero", h(".row", { style: "flex-wrap:nowrap" }, emojiTile(sj, 48), h("div", { style: "flex:1" }, h("h1", `${sj.name}: ${sj.title}`), h("p", classLine(sj.id) || "Pick a lecture")))));
  if (!S.hasAccess(sj.id)) {
    const code = h("input", { placeholder: `${sj.name} class code`, autocomplete: "off", "aria-label": `${sj.name} class code` });
    const err = h("p.err", { role: "alert" });
    const go = h("button.btn", { style: "width:100%;margin-top:12px" }, "Unlock " + sj.name);
    const submit = async () => { go.disabled = true; const r = await S.joinByCode(code.value.trim(), SUBJECTS.map((x) => x.id)); go.disabled = false; if (r.ok && r.cid === sj.id) { toast(`${sj.name} unlocked!`); confetti(); route(); } else if (r.ok) { setCls(r.cid); route(); } else err.textContent = r.message || (r.reason === "wrong" ? "That code isn't right for this class. Ask your instructor." : S.joinProblem[r.reason] || S.joinProblem.error); };
    go.onclick = submit; code.onkeydown = (e) => { if (e.key === "Enter") submit(); };
    return v.append(h(".card", h("h2", "Enter the class code"), h("p", { style: "color:var(--mute)" }, `Each class has its own code. Enter the ${sj.name} code to open it.`), code, err, go));
  }
  const ls = LECS.filter((l) => l.subject === sj.id);
  if (!ls.length) return v.append(h(".card", h("h2", "Coming soon"), h("p", "Lectures for this class are being added.")));
  v.append(announcementsCard(sj.id));
  const ex = EXAMS[sj.id];
  const cfg = S.settings[sj.id], days = cfg?.exam_date ? Math.ceil((new Date(cfg.exam_date + "T00:00:00") - new Date().setHours(0, 0, 0, 0)) / 864e5) : null;
  if (days !== null && days >= 0) {
    const weakest = ls.map((l) => ({ l, m: S.mastery(l) })).sort((a, b) => a.m - b.m).slice(0, 3);
    v.append(h(".card", { style: "margin-bottom:12px;border-left:6px solid var(--sun)" }, h("b", `\u{1F4C5} ${cfg.exam_name || "Exam"} ${days === 0 ? "is today" : days === 1 ? "is tomorrow" : `in ${days} days`}`),
      h(".src", { style: "margin:4px 0 6px" }, "Study plan: start with your weakest lectures."),
      h(".row", weakest.map(({ l, m }) => h("button.chip", { style: `--c:${l.color}`, onclick: () => (location.hash = `#/l/${l.id}/quiz`) }, h("span.em", l.icon), `${l.title} (${m}%)`)))));
  }
  const allCards = ls.flatMap((l) => l.cards || []), due = S.dueCount(allCards);
  v.append(h(".card.review", due ? { style: "border-left:6px solid var(--coral)" } : {},
    h(".row", { style: "justify-content:space-between;flex-wrap:nowrap" }, h("div", h("b", due ? `\u{1F5D3}\uFE0F ${due} card${due === 1 ? "" : "s"} to review today` : "\u2728 You're all caught up"), h(".src", { style: "margin:2px 0 0" }, due ? "Reviewing right on time is the fastest way to remember." : "Cards come back at the best time for your memory.")),
      due ? h("button.btn.sm", { onclick: () => (location.hash = "#/cards/due") }, "Review now") : "")));
  v.append(h(".grid", { style: "margin-top:12px" }, ls.map((l, i) => {
    const s = S.lectureStats(l);
    return h("button.card.lec", { style: `animation-delay:${i * 45}ms;--tc:${l.color}`, onclick: () => (location.hash = `#/l/${l.id}/notes`) },
      emojiTile(l, 52),
      h("div", { style: "flex:1" }, h("b", l.title), h("small", (l.chapter || "") + ` · ${l.sections.length} topics`), l.custom ? h("small", { style: "display:block" }, "Added by your instructor" + (l.draft ? " (draft)" : "")) : "", h(".mastery", { title: "How well you remember this lecture" }, h("i", { style: `width:${S.mastery(l)}%` }), h("span", `Mastery ${S.mastery(l)}%`))),
      ring(s.pct, l.color));
  })));
  if (ex) {
    const run = (t, shuf) => { v.replaceChildren(); const list = shuf ? shuffle(t.questions.slice()) : t.questions.slice(); runQuiz(v, list, t.title, sj.color, () => { v.replaceChildren(); viewSubject(v, id); }); };
    v.append(h("h2", { style: "margin-top:22px" }, "Practice exams"), h("p", { style: "color:var(--mute);margin:0 0 8px" }, ex.intro || "Real exam-style questions. Take them in order like a test, or shuffled."),
      h(".grid", ex.tests.map((t, i) => h(".card", { style: `animation:rise .4s var(--ease) ${i * 50}ms backwards` },
        h(".row", { style: "flex-wrap:nowrap;margin-bottom:6px" }, h(".symtile", { style: `width:44px;height:44px;--tc:${sj.color}` }, "\u{1F4DD}"), h("div", h("b", t.title), h(".src", { style: "margin:0" }, `${t.questions.length} questions`))),
        t.blurb ? h("p", { style: "margin:4px 0 10px;color:var(--mute);font-size:.9rem" }, t.blurb) : "",
        h(".row", h("button.btn.sm", { style: `--c:${sj.color}`, onclick: () => run(t, false) }, "Start in order"), h("button.btn.alt.sm", { onclick: () => run(t, true) }, "Shuffled"))))));
  }
}

const pool_ = () => { const c = clsOf(); return c ? open_().filter((l) => l.subject === c.id) : []; };
function classChips() {
  const subs = myClasses().filter((sj) => LECS.some((l) => l.subject === sj.id)), cur = clsOf();
  if (subs.length < 2) return "";
  return h(".row", { style: "margin:4px 0 8px" }, subs.map((sj) => h("button.chip" + (cur?.id === sj.id ? ".on" : ""), { style: `--c:${sj.color}`, onclick: () => { setCls(sj.id); route(); } }, h("span.em", sj.icon), sj.name)));
}

/* ---------- lecture ---------- */
const TABS = [["notes", "\u{1F4D6}", "Notes"], ["cards", "\u{1F0CF}", "Cards"], ["quiz", "\u2705", "Quiz"], ["games", "\u{1F3AE}", "Games"]];
function viewLecture(v, id, tab) {
  const l = LECS.find((x) => x.id === id);
  if (!l) return viewHome(v);
  if (!S.hasAccess(l.subject)) return viewSubject(v, l.subject);
  S.setLast(id, tab);
  const s = S.lectureStats(l);
  v.style.setProperty("--c", l.color);
  v.append(
    h("button.chip", { style: "margin-top:8px", onclick: () => (location.hash = `#/s/${l.subject}`) }, ic("left", 14), subjOf(l)?.name || "Back"),
    h(".hero", { style: "padding-bottom:0" }, h(".row", { style: "flex-wrap:nowrap" }, emojiTile(l, 48), h("div", { style: "flex:1" }, h("h1", l.title), h("p", l.chapter || "")), ring(s.pct, l.color, 52))),
    h(".tabs", TABS.map(([k, icn, t]) => h("button.tab" + (k === tab ? ".on" : ""), { onclick: () => (location.hash = `#/l/${id}/${k}`) }, h("span.em", icn), t))),
  );
  const body = h("div"); v.append(body);
  if (tab === "notes") notes(body, l);
  if (tab === "cards") cards(body, l.cards, l.color);
  if (tab === "quiz") quizMenu(body, l);
  if (tab === "games") renderGame(body, l, LECS);
}

/* ----- notes: one topic per page, arrows to move ----- */
const BOX = { why: ["\u{1F4A1}", "Why it works"], trick: ["\u{1F9E0}", "Memory trick"], trap: ["\u26A0\uFE0F", "Exam trap (admin only)"] };
function acc(cls, icon, title, content, open) {
  const body = h(".in", content);
  const el = h(".acc." + cls + (open ? ".open" : ""), h("button", { "aria-expanded": !!open }, h("span.ico", icon), title, h("span.chev", ic("down", 18))), h(".body", h("div", body)));
  el.firstChild.onclick = () => { const o = el.classList.toggle("open"); el.firstChild.setAttribute("aria-expanded", o); };
  return el;
}
function table(t) {
  return h(".tw", h("table", h("thead", h("tr", t.head.map((x) => h("th", md(x))))), h("tbody", t.rows.map((r) => h("tr", r.map((c) => h("td", md(c))))))));
}
function lightbox(im) {
  const lb = h(".lightbox", { onclick: () => lb.remove() }, h("button.chip.x", { "aria-label": "Close" }, ic("x", 18), "Close"), pic(im));
  document.body.append(lb);
}
// One box: a picture and its own explanation. Changing the picture (1/3, 2/3...) changes the text with it.
function stepper(sec) {
  const steps = sec.steps?.length ? sec.steps : (sec.images?.length ? sec.images.map((im) => ({ img: im, bullets: [] })) : []);
  if (!steps.length) return "";
  let i = 0, dir = 1;
  const wrap = h(".stepper");
  const draw = () => {
    const st = steps[i], im = st.img, n = steps.length;
    const go = (d) => { dir = d; i = (i + d + n) % n; draw(); };
    const fig = im ? h(".fig",
      h("button.figbtn", { "aria-label": "Enlarge picture", onclick: () => lightbox(im) }, pic({ ...im, alt: im.alt || sec.title }, { loading: "lazy" }), h("span.zoom", ic("zoom", 14), "Enlarge")),
      n > 1 ? [h("button.nv.l", { "aria-label": "Previous", onclick: (e) => { e.stopPropagation(); go(-1); } }, ic("left", 18)), h("button.nv.r", { "aria-label": "Next", onclick: (e) => { e.stopPropagation(); go(1); } }, ic("right", 18))] : "",
      n > 1 ? h("span.cnt", `${i + 1} / ${n}`) : "") : "";
    const txt = h(".steptxt" + (dir < 0 ? ".back" : ""),
      st.title ? h("h3", md(st.title)) : "",
      (st.bullets || []).length ? h("ul.pts", st.bullets.map((x) => h("li", md(x)))) : "");
    wrap.replaceChildren(fig,
      im && n > 1 ? h(".dots", { style: "margin:8px 0 2px" }, steps.map((_, k) => h("i" + (k === i ? ".on" : "")))) : "",
      n > 1 && !im ? h(".row", { style: "justify-content:space-between;margin:6px 0" }, h("button.arrow", { "aria-label": "Previous", onclick: () => go(-1) }, ic("left", 20)), h("span.src", `${i + 1} / ${n}`), h("button.arrow", { "aria-label": "Next", onclick: () => go(1) }, ic("right", 20))) : "",
      txt, S.canSeeRefs() && im?.slide ? h(".src.admin", "Slide " + im.slide) : "");
  };
  draw();
  return wrap;
}
const pageIdx = {};
function notes(b, l) {
  const pages = [...l.sections];
  if (!pages.length && !l.table) return b.append(h(".card", { style: "margin-top:10px" }, h("p", { style: "margin:0" }, "There are no notes in this lecture yet.")));
  if (l.table) pages.push({ id: "_glance", title: l.table.title || "At a glance", slides: "", bullets: [], boxes: [], table: l.table, glance: true });
  let i = Math.min(pageIdx[l.id] || 0, pages.length - 1), dir = 1;
  const readSet = () => S.progress().read[l.id] || {};
  const draw = () => {
    pageIdx[l.id] = i;
    const p = pages[i], refs = S.canSeeRefs();
    const sel = h("select", { "aria-label": "Jump to topic", onchange: (e) => go(+e.target.value) }, pages.map((q, k) => h("option", { value: k, selected: k === i }, `${k + 1}. ${q.title}`)));
    const go = (k, d) => { if (k < 0 || k >= pages.length) return; if (!pages[i].glance && !readSet()[pages[i].id]) floatXP("+3 XP"); if (!pages[i].glance) S.markRead(l.id, pages[i].id); dir = d ?? (k > i ? 1 : -1); i = k; draw(); if (i === pages.length - 1 && pages.every((q) => q.glance || readSet()[q.id])) { confetti(60); } window.scrollTo({ top: 0, behavior: "smooth" }); };
    window.__next = () => go(i + 1); window.__prev = () => go(i - 1);
    const boxes = (p.boxes || []).filter((x) => x.type !== "trap" || refs);
    b.replaceChildren(
      h(".pager", h("button.arrow", { "aria-label": "Previous topic", disabled: i === 0, onclick: () => go(i - 1) }, ic("left", 22)), h(".mid", sel), h("button.arrow", { "aria-label": "Next topic", disabled: i === pages.length - 1, onclick: () => go(i + 1) }, ic("right", 22))),
      h(".dots", pages.map((q, k) => h("i" + (k === i ? ".on" : readSet()[q.id] ? ".done" : "")))),
      h(".card.page" + (dir < 0 ? ".back" : ""),
        h("h2", p.title, refs && p.slides ? h("span.refchip", "Slides " + p.slides) : "", p.custom ? h("span.pill.mute", { style: "font-size:.7rem" }, "Your instructor") : "", p.draft ? h("span.pill.bad", { style: "font-size:.7rem" }, "Draft") : ""),
        i === 0 && l.intro ? h("p", { style: "color:var(--mute);margin:0 0 6px" }, md(l.intro)) : "",
        stepper(p),
        (p.bullets || []).length ? h("ul.pts", p.bullets.map((x) => h("li", md(x)))) : "",
        boxes.map((x) => acc(x.type, BOX[x.type][0], BOX[x.type][1], md(x.text), false)),
        p.table ? (p.glance ? table(p.table) : acc("cmp", "\u{1F4CA}", "Compare table", table(p.table), false)) : "",
        refs && p.sourceNotes ? h(".src.admin", "Source: " + p.sourceNotes.join(" · ")) : "",
      ),
      h(".row", { style: "justify-content:space-between;margin-top:12px" },
        h("button.btn.alt", { disabled: i === 0, onclick: () => go(i - 1) }, ic("left", 18), "Back"),
        i === pages.length - 1 && l.quiz?.length >= 5 ? h("button.btn.alt", { onclick: () => { const qs = shuffle(l.quiz.slice()).slice(0, 5); runQuiz(b, qs, "Quick check", l.color, () => { b.replaceChildren(); notes(b, l); }); } }, "\u26A1 Quick check") : "",
        i === pages.length - 1 ? h("button.btn.ok", { onclick: () => { S.markRead(l.id, pages[i].id); location.hash = `#/l/${l.id}/cards`; } }, "Practice cards", ic("right", 18)) : h("button.btn", { onclick: () => go(i + 1) }, "Next", ic("right", 18))),
    );
  };
  draw();
}

/* ----- flashcards ----- */
export function cards(b, all, color, startMode = "all") {
  if (!all.length) return b.append(h(".card", { style: "margin-top:10px" }, h("p", { style: "margin:0" }, "There are no flashcards in this lecture yet.")));
  let deck = startMode === "due" ? S.dueCards(all) : all.slice(), i = 0, mode = startMode === "due" && deck.length ? "due" : "all";
  if (!deck.length) deck = all.slice();
  const draw = () => {
    b.replaceChildren();
    const known = all.filter((c) => S.cardState(c.id) === "know").length;
    b.append(h(".row", { style: "margin:6px 0" },
      h("button.chip" + (mode === "all" ? ".on" : ""), { onclick: () => { mode = "all"; deck = all.slice(); i = 0; draw(); } }, "All cards"),
      h("button.chip" + (mode === "due" ? ".on" : ""), { onclick: () => { mode = "due"; deck = S.dueCards(all); i = 0; draw(); } }, `\u{1F5D3}\uFE0F Due today (${S.dueCount(all)})`),
      h("button.chip" + (mode === "missed" ? ".on" : ""), { onclick: () => { mode = "missed"; deck = all.filter((c) => S.cardState(c.id) !== "know"); i = 0; draw(); } }, "Still learning"),
      h("button.chip", { onclick: () => { deck = shuffle(deck); i = 0; draw(); } }, "Shuffle"),
      h("button.chip", { onclick: () => (location.hash = "#/glossary") }, "\u{1F4D6} Glossary")),
      h(".bar", { style: `--c:${color}` }, h("i", { style: `width:${all.length ? (known / all.length) * 100 : 0}%` })),
      h(".src", `${known} of ${all.length} known`));
    if (!deck.length) { b.append(h(".card.pop", { style: "margin-top:14px;text-align:center" }, h("h2", "\u{1F389} Nothing left here!"), h("p", "You know every card in this set."))); confetti(70); return; }
    if (i >= deck.length) {
      const missed = all.filter((c) => S.cardState(c.id) !== "know");
      if (!missed.length) confetti();
      b.append(h(".card.pop", { style: "margin-top:14px;text-align:center" }, h("h2", "\u{1F3AF} Round done!"), h("p", `${known} known, ${missed.length} still learning.`),
        missed.length ? h("button.btn", { onclick: () => { mode = "missed"; deck = missed; i = 0; draw(); } }, "Repeat missed cards") : h("p", "\u{1F31F} Perfect round!")));
      return;
    }
    const c = deck[i];
    const front = h(".face.front", h("span.tag", c.custom ? "Term · your instructor" + (c.draft ? " · draft" : "") : "Term"), h("b", md(c.front)), h(".hint", "Tap to reveal")), back = h(".face.back", { "aria-hidden": "true" }, h("span.tag", "Meaning"), h("div", md(c.back)), S.canSeeRefs() && c.src ? h(".src.admin", c.src) : "");
    const fc = h(".fc", { role: "button", tabindex: 0 }, h(".inner", front, back));
    const flip = () => { const f = fc.classList.toggle("flip"); front.setAttribute("aria-hidden", String(f)); back.setAttribute("aria-hidden", String(!f)); };
    let sx = 0, dx = 0, drag = false, moved = false;
    fc.addEventListener("pointerdown", (e) => { drag = true; moved = false; sx = e.clientX; dx = 0; fc.style.transition = "none"; });
    fc.addEventListener("pointermove", (e) => { if (!drag) return; dx = e.clientX - sx; if (Math.abs(dx) > 10) moved = true; if (moved) { fc.style.transform = `translateX(${dx}px) rotate(${dx / 24}deg)`; fc.style.opacity = String(1 - Math.min(Math.abs(dx), 220) / 420); } });
    const end = () => { if (!drag) return; drag = false; fc.style.transition = "transform .25s, opacity .25s";
      if (dx > 90) { fc.classList.add("fly-r"); setTimeout(() => mark("know"), 300); }
      else if (dx < -90) { fc.classList.add("fly-l"); setTimeout(() => mark("learning"), 300); }
      else { fc.style.transform = ""; fc.style.opacity = ""; } };
    fc.addEventListener("pointerup", end); fc.addEventListener("pointercancel", end);
    fc.onclick = () => { if (moved) { moved = false; return; } flip(); }; fc.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flip(); } };
    const mark = (v) => { if (v === "know") floatXP("+2 XP \u2B50"); S.setCard(c.id, v); i++; draw(); };
    window.__next = () => { i = Math.min(i + 1, deck.length); draw(); };
    window.__prev = () => { i = Math.max(i - 1, 0); draw(); };
    b.append(h(".pager", { style: "margin-top:12px" }, h("button.arrow", { "aria-label": "Previous card", disabled: i === 0, onclick: window.__prev }, ic("left", 22)),
      h(".mid.src", { style: "text-align:center;margin:0" }, `Card ${i + 1} of ${deck.length}`), h("button.arrow", { "aria-label": "Next card", onclick: window.__next }, ic("right", 22))),
      fc, h(".swipehint", "Tap to flip. Swipe right if you know it, left if you're still learning."), h(".row", { style: "justify-content:center;margin-top:8px" },
        h("button.btn.warn", { onclick: () => mark("learning") }, "\u{1F615} Still learning"), h("button.btn.ok", { onclick: () => mark("know") }, "\u{1F60E} I know it")));
  };
  draw();
}

/* ----- quiz ----- */
// "how sure were you?" turns every answer into feedback about what the student really knows
function confRow(qid) {
  const row = h(".conf", h("span", "How sure were you?"));
  [["guess", "\u{1F3B2} Guessed"], ["unsure", "\u{1F914} Unsure"], ["sure", "\u{1F4AA} Sure"]].forEach(([k, t]) => row.append(h("button.chip", { onclick: (e) => { S.setConf(qid, k); row.querySelectorAll("button").forEach((x) => x.classList.remove("on")); e.currentTarget.classList.add("on"); } }, t)));
  return row;
}
function quizMenu(b, l) {
  const qs = l.quiz;
  if (!qs?.length) return b.append(h(".card", "No questions yet."));
  const pr = S.progress().quiz, wrong = qs.filter((q) => pr[q.id]?.last === false).sort((x, y) => (pr[y.id]?.conf === "sure") - (pr[x.id]?.conf === "sure"));
  const back = () => { b.replaceChildren(); quizMenu(b, l); };
  b.append(h(".card", h("h2", "Quiz: " + l.title), h("p", `${qs.length} questions in exam style. You get instant feedback and an explanation for every answer.`),
    h(".row",
      h("button.btn", { onclick: () => runQuiz(b, shuffle(qs.slice()), l.title, l.color, back) }, "Start quiz"),
      h("button.btn.alt", { disabled: !wrong.length, onclick: () => runQuiz(b, wrong.slice(), "Review mistakes", l.color, back) }, `Review mistakes (${wrong.length})`))));
}
export function runQuiz(b, list, title, color, back) {
  let i = 0, score = 0, combo = 0; const miss = [];
  const draw = () => {
    b.replaceChildren();
    if (i >= list.length) {
      const pct = score / list.length;
      if (pct >= 0.8) confetti(pct === 1 ? 140 : 80);
      b.append(h(".card.pop", { style: "text-align:center;--c:" + color }, h("h2", "\u{1F3C1} " + title + " complete"), h(".score", `${score}/${list.length}`),
        h("p", pct === 1 ? "\u{1F3C6} Perfect score!" : pct >= 0.7 ? "\u{1F4AA} Strong work." : "\u{1F331} Good start. Review the mistakes and try again."),
        miss.length ? h("div", { style: "text-align:left" }, h("h3", "Missed"), miss.map((q) => h(".fb", md(q.q.split("\n")[0]), h(".src", "Answer: " + clean(q.options[q.answer]))))) : "",
        h("button.btn", { style: "margin-top:12px", onclick: back }, "Done")));
      return;
    }
    const q = list[i]; let picked = null;
    const fb = h("div", { "aria-live": "polite" });
    const opts = q.options.map((o, k) => {
      const bt = h("button.opt", h("b", "abcde"[k]), h("span", md(o)));
      bt.onclick = () => {
        if (picked !== null) return; picked = k;
        const ok = k === q.answer; if (ok) { score++; combo++; floatXP(combo >= 3 ? `+4 XP \u{1F525}x${combo}` : "+4 XP"); } else { miss.push(q); combo = 0; }
        S.recordAnswer(q.id, ok);
        fb.append(confRow(q.id));
        opts.forEach((x, j) => { if (j === q.answer) x.classList.add("ok"); else if (j === k) x.classList.add("no"); });
        fb.append(h(".fb", h("b", ok ? "\u{1F389} Correct! " : "\u{1F914} Not quite. "), combo >= 3 ? h("span.combo", `\u{1F525} ${combo} in a row! `) : "", md(q.why), S.canSeeRefs() ? h(".src.admin", "Source: " + q.source) : ""),
          h("button.btn", { style: "margin-top:10px", onclick: () => { i++; draw(); } }, i + 1 === list.length ? "See score" : "Next", ic("right", 18)));
      };
      return bt;
    });
    b.append(h(".src", `${title} · Question ${i + 1} of ${list.length}`), h(".bar", { style: `--c:${color}` }, h("i", { style: `width:${(i / list.length) * 100}%` })),
      h(".card", { style: "margin-top:10px" }, q.custom ? h(".src", { style: "margin:0 0 6px" }, "From your instructor" + (q.draft ? " (draft)" : "")) : "", q.img ? h(".qimg", { role: "button", tabindex: 0, "aria-label": "Enlarge picture", onclick: () => lightbox(q.img) }, pic({ ...q.img, alt: q.img.alt || "Figure for the question" }, { loading: "lazy" })) : "", h(".q", md(q.q)), opts, fb));
  };
  draw();
}

function viewAllCards(v, startMode) {
  const draw = () => {
    v.replaceChildren(h(".hero", h("h1", "Flashcards"), h("p", "Mix every lecture, or tap a lecture to focus on it.")));
    const LS = pool_(), body = h("div"), chips = h(".row", { style: "margin:6px 0" });
    const show = (sel) => {
      chips.replaceChildren(h("button.chip" + (!sel ? ".on" : ""), { onclick: () => show(null) }, "All lectures"),
        ...LS.map((l) => h("button.chip" + (sel === l ? ".on" : ""), { onclick: () => show(l) }, [ic(symOf(l), 15), l.title])));
      body.replaceChildren(); cards(body, sel ? sel.cards : shuffle(LS.flatMap((l) => l.cards)), sel ? sel.color : "var(--c)", startMode === "due" && !sel ? "due" : "all");
    };
    v.append(classChips(draw), chips, body); show(null);
  };
  draw();
}

function viewPractice(v) {
  let sel = null;
  const draw = () => {
    const LS = pool_(), all = LS.flatMap((l) => (l.quiz || []).map((q) => ({ ...q, lec: l.id })));
    v.replaceChildren(h(".hero", h("h1", "Practice exam"), h("p", "Mixed questions, shuffled like the real thing. Pick lectures or take them all.")), classChips(() => { sel = null; draw(); }));
    const pool = sel ? all.filter((q) => sel.has(q.lec)) : all;
    v.append(h(".row", { style: "margin-bottom:10px" }, h("button.chip" + (!sel ? ".on" : ""), { onclick: () => { sel = null; draw(); } }, "All lectures"),
      LS.map((l) => h("button.chip" + (sel?.has(l.id) ? ".on" : ""), { onclick: () => { sel = sel || new Set(); sel.has(l.id) ? sel.delete(l.id) : sel.add(l.id); if (!sel.size) sel = null; draw(); } }, [ic(symOf(l), 15), l.title]))),
      h(".card", h("p", `${pool.length} questions available.`),
        h(".row", [10, 20, 40, pool.length].filter((n, k, a) => n <= pool.length && a.indexOf(n) === k).map((n) =>
          h("button.btn", { style: "--c:#2563eb", onclick: () => { v.replaceChildren(); runQuiz(v, shuffle(pool.slice()).slice(0, n), "Practice exam", "var(--brand)", draw); } }, n === pool.length ? `All ${n}` : `${n} questions`)))));
  };
  draw();
}

/* ---------- progress, badges, milestones ---------- */
function computeBadges() {
  const pr = S.progress(), st = S.streak(), x = S.xp(open_());
  return [
    ["3-day streak", st >= 3, "\u{1F525}"], ["First topic read", Object.keys(pr.read).length > 0, "\u{1F4D6}"],
    ["10 cards known", Object.values(pr.cards).filter((c) => c === "know").length >= 10, "\u{1F0CF}"],
    ["10 questions right", Object.values(pr.quiz).filter((c) => c.last).length >= 10, "\u2705"],
    ["First game", Object.keys(pr.games).length > 0, "\u{1F3AE}"], ["Lecture 100%", open_().some((l) => S.lectureStats(l).pct === 100), "\u{1F3C6}"],
    ["Level 5", x.lvl >= 5, "\u2B50"],
  ];
}
let checking = false;
function checkMilestones() {
  if (checking || S.DEMO) return; checking = true;
  try {
    const x = S.xp(open_()), pf = S.prefs(), now = computeBadges().filter((b) => b[1]).map((b) => b[0]);
    if (pf.lvl == null) { S.setPrefs({ lvl: x.lvl, badges: now }); return; }
    if (x.lvl > pf.lvl) { toast(`\u{1F389} Level ${x.lvl}! Nice work.`); confetti(110); S.setPrefs({ lvl: x.lvl }); }
    const fresh = now.filter((n) => !(pf.badges || []).includes(n));
    if (fresh.length) { setTimeout(() => { toast(`\u{1F3C5} Badge unlocked: ${fresh[0]}`); confetti(50); }, 900); S.setPrefs({ badges: now }); }
  } finally { checking = false; }
}
function confBlock(LS) {
  const pr = S.progress().quiz, qs = LS.flatMap((l) => (l.quiz || []).map((q) => ({ l, q, st: pr[q.id] }))).filter((x) => x.st);
  const sure = qs.filter((x) => x.st.conf === "sure"), sureOk = sure.filter((x) => x.st.last).length;
  const trap = qs.filter((x) => x.st.conf === "sure" && x.st.last === false);
  if (!sure.length) return "";
  return h(".card", { style: "margin-top:14px" }, h("h3", "\u{1F3AF} How well you know what you know"),
    h("p", { style: "margin:0 0 6px" }, `When you said "sure", you were right ${Math.round((sureOk / sure.length) * 100)}% of the time.`),
    trap.length ? h("div", h("b", { style: "font-size:.9rem" }, "Sure but wrong: look at these first"), ...trap.slice(0, 5).map((x) => h(".fb", { style: "margin-top:6px" }, h("b", x.l.title + ": "), md(x.q.q.split(String.fromCharCode(10))[0])))) : h(".src", "No overconfident mistakes. Nice calibration."));
}
function viewProgress(v) {
  const draw = () => {
    v.replaceChildren();
    const LS = pool_(), st = S.streak(), x = S.xp(LS);
    const total = LS.length ? Math.round(LS.reduce((s, l) => s + S.lectureStats(l).pct, 0) / LS.length) : 0;
    const weak = LS.flatMap((l) => (l.quiz || []).filter((q) => { const p = S.progress().quiz[q.id]; return p && p.attempts && p.correct / p.attempts < 0.6; }).map((q) => ({ l, q })));
    const pr = S.progress();
    const badges = computeBadges();
    v.append(h(".hero", h("h1", "My progress")), classChips(draw),
      h(".card.row", ring(total, "var(--brand)", 76), h("div", h("b", "Overall completion"), h("p", { style: "margin:0;color:var(--mute)" }, `Level ${x.lvl} · ${x.xp} XP` + (st ? ` · ${st}-day streak` : "")))),
      h("h2", { style: "margin-top:18px" }, "By lecture"),
      h(".grid", LS.map((l) => { const s = S.lectureStats(l); return h(".card", h(".row", { style: "justify-content:space-between;flex-wrap:nowrap" }, h("b", [ic(symOf(l), 15), l.title]), ring(s.pct, l.color, 44)),
        h(".src", `Notes ${s.read}/${s.secs} · Cards ${s.known}/${s.cards} · Quiz ${s.right}/${s.qs}`)); })),
      confBlock(LS),
      h("h2", { style: "margin-top:18px" }, "Weak topics"),
      weak.length ? weak.map(({ l, q }) => h(".fb", h("b", l.title + ": "), md(q.q.split(String.fromCharCode(10))[0]))) : h("p", "No weak topics yet. Take a quiz and they'll show up here."),
      h("h2", { style: "margin-top:18px" }, "Badges"), h("div", badges.map(([t, on, icn]) => h("span.badge" + (on ? "" : ".lock"), icn, t))));
  };
  draw();
}

/* ---------- admin ---------- */
boot().catch((e) => { app.replaceChildren(h("p.boot", "Something went wrong: " + e.message)); console.error(e); });
